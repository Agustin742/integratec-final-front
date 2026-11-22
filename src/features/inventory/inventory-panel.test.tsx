import type { ComponentProps } from 'react';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createApiClient } from '@/api/client';
import { classroomEquipmentQueryKey } from '@/api/query-keys';
import { ApiQueryProvider, createAppQueryClient } from '@/api/query-client';
import { fakeSession } from '@/app/router/fake-session';
import { SessionProvider } from '@/session/provider';
import { profile } from '@/session/test-fixtures';
import { expectAccessible } from '@/test/accessibility';
import {
  createClassroomDetailHandler,
  createClassroomEquipmentStore,
  TEST_API_BASE_URL,
  type ShopStorePurchase,
} from '@/test/msw/handlers';
import { mswServer } from '@/test/msw/server';
import { render } from '@/test/render';
import { getSlotLabel, inventoryMessages } from './inventory-messages';
import { InventoryPanel } from './inventory-panel';
import type { EquipmentStateDto } from './inventory-schema';

const CLASSROOM_ID = '00000000-0000-4000-8000-000000000057';
const STUDENT_ID = '00000000-0000-4000-8000-000000007001';
const CAP_ID = '00000000-0000-4000-8000-000000001001';
const GLASSES_ID = '00000000-0000-4000-8000-000000001002';
const LAMP_ID = '00000000-0000-4000-8000-000000001003';
const BROKEN_ID = '00000000-0000-4000-8000-000000001004';
const GHOST_ID = '00000000-0000-4000-8000-000000001005';

const CAP_METADATA = { [CAP_ID]: { slot: 'head' } };

function makePurchase(
  overrides: Partial<ShopStorePurchase> = {},
): ShopStorePurchase {
  return {
    id: '00000000-0000-4000-8000-000000002001',
    classroomId: CLASSROOM_ID,
    studentId: STUDENT_ID,
    shopItemId: CAP_ID,
    shopItemCode: 'cap-blue',
    shopItemName: 'Gorra azul',
    shopItemKind: 'AVATAR_ACCESSORY',
    pointTransactionId: '00000000-0000-4000-8000-000000003001',
    pricePaid: 100,
    createdAt: '2026-11-20T10:00:00.000Z',
    ...overrides,
  };
}

function renderInventoryRoute(
  options: {
    readonly role?: 'STUDENT' | 'TEACHER' | 'PARENT';
    readonly panelProps?: ComponentProps<typeof InventoryPanel>;
  } = {},
) {
  const role = options.role ?? 'STUDENT';
  const client = createApiClient({
    baseUrl: TEST_API_BASE_URL,
  });
  const queryClient = createAppQueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const session = fakeSession(
    {
      status: 'authenticated',
      user: { ...profile, id: 'student-user-1' },
    },
    client,
  );

  mswServer.use(
    createClassroomDetailHandler(CLASSROOM_ID, {
      myRole: role,
      capabilities:
        role === 'STUDENT' ? ['participate_activities'] : ['publish_content'],
    }),
  );

  const router = createMemoryRouter(
    [
      {
        path: '/classrooms/:classroomId',
        element: <InventoryPanel {...options.panelProps} />,
      },
    ],
    { initialEntries: [`/classrooms/${CLASSROOM_ID}`] },
  );

  const view = render(
    <SessionProvider service={session.service}>
      <ApiQueryProvider client={queryClient}>
        <RouterProvider router={router} />
      </ApiQueryProvider>
    </SessionProvider>,
  );

  return { view, queryClient };
}

describe('InventoryPanel', () => {
  beforeAll(() => {
    mswServer.listen();
  });

  afterEach(() => {
    mswServer.resetHandlers();
  });

  afterAll(() => {
    mswServer.close();
  });

  it('restricts access to students and does not fetch equipment for teachers', async () => {
    const store = createClassroomEquipmentStore({
      classroomId: CLASSROOM_ID,
      role: 'TEACHER',
      initialPurchases: [],
    });
    mswServer.use(...store.handlers);

    renderInventoryRoute({ role: 'TEACHER' });

    expect(
      await screen.findByText(inventoryMessages.panel.studentOnlyTitle),
    ).toBeInTheDocument();
    expect(store.getCounts().getEquipment).toBe(0);
    expect(store.getCounts().purchases).toBe(0);
  });

  it('shows empty state when the student has no purchased items', async () => {
    const store = createClassroomEquipmentStore({
      classroomId: CLASSROOM_ID,
      initialPurchases: [],
    });
    mswServer.use(...store.handlers);

    const { view } = renderInventoryRoute();

    expect(
      await screen.findByText(inventoryMessages.empty.title),
    ).toBeInTheDocument();
    await expectAccessible(view.container);
  });

  function tiles(group: HTMLElement): HTMLElement[] {
    return within(group).queryAllByRole('radio');
  }

  function tileNames(group: HTMLElement): string[] {
    return tiles(group).map((tile) => tile.dataset.itemName ?? '');
  }

  function tile(group: HTMLElement, name: string): HTMLElement {
    const found = tiles(group).find((t) => t.dataset.itemName === name);
    if (!found) {
      throw new Error(`No tile named ${name}`);
    }
    return found;
  }

  function slotSection(group: HTMLElement): HTMLElement {
    return group.closest('section') as HTMLElement;
  }

  function lampPurchase(overrides: Partial<ShopStorePurchase> = {}) {
    return makePurchase({
      id: '00000000-0000-4000-8000-000000002002',
      shopItemId: LAMP_ID,
      shopItemCode: 'desk-lamp',
      shopItemName: 'Lámpara de escritorio',
      shopItemKind: 'DESK_UPGRADE',
      ...overrides,
    });
  }

  function glassesPurchase() {
    return makePurchase({
      id: '00000000-0000-4000-8000-000000002003',
      shopItemId: GLASSES_ID,
      shopItemCode: 'glasses-star',
      shopItemName: 'Lentes estrella',
    });
  }

  const EQUIPPED_CAP = {
    head: {
      slot: 'head',
      shopItemId: CAP_ID,
      shopItemCode: 'cap-blue',
      shopItemName: 'Gorra azul',
      kind: 'AVATAR_ACCESSORY',
    },
  } as const;

  describe('grid selector', () => {
    it('renders one named radiogroup per slot with the owned items as radio tiles', async () => {
      const store = createClassroomEquipmentStore({
        classroomId: CLASSROOM_ID,
        itemMetadata: {
          ...CAP_METADATA,
          [GLASSES_ID]: { slot: 'head' },
          [LAMP_ID]: { slot: 'desk_decor' },
        },
        initialPurchases: [makePurchase(), glassesPurchase(), lampPurchase()],
      });
      mswServer.use(...store.handlers);

      const { view } = renderInventoryRoute();

      const headGroup = await screen.findByRole('radiogroup', {
        name: 'Cabeza',
      });
      expect(screen.getAllByRole('radiogroup')).toHaveLength(2);
      expect(
        screen.getByRole('radiogroup', { name: 'Decoración del escritorio' }),
      ).toBeInTheDocument();
      expect(tileNames(headGroup)).toEqual(['Gorra azul', 'Lentes estrella']);
      expect(screen.queryByRole('combobox')).toBeNull();
      expect(screen.queryByRole('option')).toBeNull();
      await expectAccessible(view.container);
    });

    it('equips a tile on selection with a pending tile, then marks it checked with "Equipado"', async () => {
      const store = createClassroomEquipmentStore({
        classroomId: CLASSROOM_ID,
        itemMetadata: CAP_METADATA,
        setSlotDelayMs: 40,
        initialPurchases: [makePurchase()],
      });
      mswServer.use(...store.handlers);

      renderInventoryRoute();

      const headGroup = await screen.findByRole('radiogroup', {
        name: 'Cabeza',
      });
      const cap = tile(headGroup, 'Gorra azul');
      expect(cap).toHaveAttribute('aria-checked', 'false');
      expect(
        within(headGroup).queryByText(inventoryMessages.actions.equipped),
      ).toBeNull();

      fireEvent.click(cap);

      // One request per selection; further selections are ignored while pending
      // but the tile stays focusable (aria-disabled, not disabled).
      await waitFor(() => {
        expect(cap).toHaveAttribute('aria-disabled', 'true');
      });
      expect(
        within(slotSection(headGroup)).getByRole('status'),
      ).toHaveTextContent(inventoryMessages.states.pending);
      fireEvent.click(cap);

      await waitFor(() => {
        expect(cap).toHaveAttribute('aria-checked', 'true');
      });
      expect(cap).not.toHaveAttribute('aria-disabled', 'true');
      expect(
        within(cap).getByText(inventoryMessages.actions.equipped),
      ).toBeInTheDocument();
      expect(store.getSlots().head?.shopItemId).toBe(CAP_ID);
      expect(store.getCounts().setSlot).toBe(1);
    });

    it('renders each tile as a native button so Space and Enter activate it', async () => {
      const store = createClassroomEquipmentStore({
        classroomId: CLASSROOM_ID,
        itemMetadata: CAP_METADATA,
        initialPurchases: [makePurchase()],
      });
      mswServer.use(...store.handlers);

      renderInventoryRoute();

      const headGroup = await screen.findByRole('radiogroup', {
        name: 'Cabeza',
      });
      const cap = tile(headGroup, 'Gorra azul');
      expect(cap.tagName).toBe('BUTTON');
      expect(cap).toHaveAttribute('type', 'button');
    });

    it('uses a roving tabindex and moves focus with the arrow keys without equipping', async () => {
      const store = createClassroomEquipmentStore({
        classroomId: CLASSROOM_ID,
        itemMetadata: { ...CAP_METADATA, [GLASSES_ID]: { slot: 'head' } },
        initialPurchases: [makePurchase(), glassesPurchase()],
        initialSlots: {
          head: {
            slot: 'head',
            shopItemId: GLASSES_ID,
            shopItemCode: 'glasses-star',
            shopItemName: 'Lentes estrella',
            kind: 'AVATAR_ACCESSORY',
          },
        },
      });
      mswServer.use(...store.handlers);

      renderInventoryRoute();

      const headGroup = await screen.findByRole('radiogroup', {
        name: 'Cabeza',
      });
      const cap = tile(headGroup, 'Gorra azul');
      const glasses = tile(headGroup, 'Lentes estrella');
      // The equipped tile is the single tab stop.
      expect(glasses).toHaveAttribute('tabindex', '0');
      expect(cap).toHaveAttribute('tabindex', '-1');

      glasses.focus();
      fireEvent.keyDown(glasses, { key: 'ArrowRight' });
      // Wraps around to the first tile.
      expect(cap).toHaveFocus();
      expect(cap).toHaveAttribute('tabindex', '0');
      expect(glasses).toHaveAttribute('tabindex', '-1');
      fireEvent.keyDown(cap, { key: 'ArrowLeft' });
      expect(glasses).toHaveFocus();
      fireEvent.keyDown(glasses, { key: 'Home' });
      expect(cap).toHaveFocus();
      fireEvent.keyDown(cap, { key: 'End' });
      expect(glasses).toHaveFocus();

      expect(store.getCounts().setSlot).toBe(0);
      expect(store.getSlots().head?.shopItemId).toBe(GLASSES_ID);
    });

    it('unequips with the explicit "Desequipar" action, shown only when something is equipped', async () => {
      const store = createClassroomEquipmentStore({
        classroomId: CLASSROOM_ID,
        itemMetadata: CAP_METADATA,
        initialPurchases: [makePurchase()],
        initialSlots: { ...EQUIPPED_CAP },
      });
      mswServer.use(...store.handlers);

      renderInventoryRoute();

      const headGroup = await screen.findByRole('radiogroup', {
        name: 'Cabeza',
      });
      const headSection = slotSection(headGroup);
      expect(tile(headGroup, 'Gorra azul')).toHaveAttribute(
        'aria-checked',
        'true',
      );
      expect(screen.getAllByRole('button')).toHaveLength(1);

      fireEvent.click(
        within(headSection).getByRole('button', {
          name: inventoryMessages.actions.unequip,
        }),
      );

      await waitFor(() => {
        expect(tile(headGroup, 'Gorra azul')).toHaveAttribute(
          'aria-checked',
          'false',
        );
      });
      expect(store.getSlots().head).toBeNull();
      expect(
        within(headSection).queryByRole('button', {
          name: inventoryMessages.actions.unequip,
        }),
      ).toBeNull();
      expect(
        within(headSection).getByText(inventoryMessages.actions.noItem),
      ).toBeInTheDocument();
    });

    it('shows a hint instead of controls when a slot has no owned items', async () => {
      const store = createClassroomEquipmentStore({
        classroomId: CLASSROOM_ID,
        itemMetadata: CAP_METADATA,
        initialPurchases: [makePurchase()],
      });
      mswServer.use(...store.handlers);

      renderInventoryRoute();

      await screen.findByRole('radiogroup', { name: 'Cabeza' });
      expect(screen.getAllByRole('radiogroup')).toHaveLength(1);
      expect(
        screen.getAllByText(inventoryMessages.empty.slotHint),
      ).toHaveLength(3);
      expect(screen.getByRole('heading', { name: 'Cara' })).toBeInTheDocument();
    });

    it('keeps the live region mounted and announces the confirmation, then clears it', async () => {
      const store = createClassroomEquipmentStore({
        classroomId: CLASSROOM_ID,
        itemMetadata: CAP_METADATA,
        initialPurchases: [makePurchase()],
      });
      mswServer.use(...store.handlers);

      renderInventoryRoute();

      const headGroup = await screen.findByRole('radiogroup', {
        name: 'Cabeza',
      });
      const section = slotSection(headGroup);
      const region = within(section).getByRole('status');
      expect(region).toBeEmptyDOMElement();

      fireEvent.click(tile(headGroup, 'Gorra azul'));

      await waitFor(() => {
        expect(region).toHaveTextContent(inventoryMessages.states.confirmed);
      });
      // The same node is updated, never unmounted.
      expect(within(section).getByRole('status')).toBe(region);
      expect(region).not.toHaveAttribute('aria-live');
      expect(region).not.toHaveAttribute('aria-label');

      await waitFor(
        () => {
          expect(region).toBeEmptyDOMElement();
        },
        { timeout: 6000 },
      );
    }, 10000);

    it('announces the rejection in the same live region and keeps it until the next interaction', async () => {
      const store = createClassroomEquipmentStore({
        classroomId: CLASSROOM_ID,
        itemMetadata: { ...CAP_METADATA, [GLASSES_ID]: { slot: 'head' } },
        initialPurchases: [makePurchase(), glassesPurchase()],
        initialSlots: { ...EQUIPPED_CAP },
      });
      mswServer.use(...store.handlers);

      renderInventoryRoute();

      const headGroup = await screen.findByRole('radiogroup', {
        name: 'Cabeza',
      });
      const section = slotSection(headGroup);
      const region = within(section).getByRole('status');
      store.failNext('setSlot', {
        status: 403,
        body: {
          code: 'FORBIDDEN',
          message: 'Item not owned',
          correlationId: 'req-403-not-owned',
        },
      });

      fireEvent.click(tile(headGroup, 'Lentes estrella'));

      await waitFor(() => {
        expect(region).toHaveTextContent(inventoryMessages.errors.notOwned);
      });
      expect(within(section).getByRole('status')).toBe(region);
      expect(within(section).queryByRole('alert')).toBeNull();
      // Equipped state is unchanged.
      expect(tile(headGroup, 'Gorra azul')).toHaveAttribute(
        'aria-checked',
        'true',
      );
      expect(tile(headGroup, 'Lentes estrella')).toHaveAttribute(
        'aria-checked',
        'false',
      );
      expect(store.getSlots().head?.shopItemId).toBe(CAP_ID);

      // Next interaction replaces the message.
      fireEvent.click(tile(headGroup, 'Lentes estrella'));
      await waitFor(() => {
        expect(region).toHaveTextContent(inventoryMessages.states.confirmed);
      });
      expect(region).not.toHaveTextContent(inventoryMessages.errors.notOwned);
    });

    it('handles an uncertain 500 without changing the equipped state and reconciles', async () => {
      const store = createClassroomEquipmentStore({
        classroomId: CLASSROOM_ID,
        itemMetadata: CAP_METADATA,
        initialPurchases: [makePurchase()],
      });
      mswServer.use(...store.handlers);

      renderInventoryRoute();

      const headGroup = await screen.findByRole('radiogroup', {
        name: 'Cabeza',
      });
      store.failNext('setSlot', {
        status: 500,
        body: {
          code: 'INTERNAL_ERROR',
          message: 'Server error',
          correlationId: 'req-500',
        },
      });
      fireEvent.click(tile(headGroup, 'Gorra azul'));

      const section = slotSection(headGroup);
      await waitFor(() => {
        expect(within(section).getByRole('status')).toHaveTextContent(
          inventoryMessages.errors.uncertain,
        );
      });
      expect(tile(headGroup, 'Gorra azul')).toHaveAttribute(
        'aria-checked',
        'false',
      );
      expect(
        within(section).getByText(inventoryMessages.actions.noItem),
      ).toBeInTheDocument();
      await waitFor(() => {
        expect(store.getCounts().getEquipment).toBeGreaterThanOrEqual(2);
      });
    });

    it.each([
      [409, 'CONFLICT', inventoryMessages.errors.conflict],
      [404, 'NOT_FOUND', inventoryMessages.errors.notFound],
      [429, 'TOO_MANY_REQUESTS', inventoryMessages.errors.rateLimited],
    ] as const)(
      'shows the right message when the equip endpoint answers %i',
      async (status, code, message) => {
        const store = createClassroomEquipmentStore({
          classroomId: CLASSROOM_ID,
          itemMetadata: CAP_METADATA,
          initialPurchases: [makePurchase()],
        });
        mswServer.use(...store.handlers);

        renderInventoryRoute();

        const headGroup = await screen.findByRole('radiogroup', {
          name: 'Cabeza',
        });
        store.failNext('setSlot', {
          status,
          body: { code, message: 'rejected', correlationId: `req-${status}` },
        });
        fireEvent.click(tile(headGroup, 'Gorra azul'));

        await waitFor(() => {
          expect(
            within(slotSection(headGroup)).getByRole('status'),
          ).toHaveTextContent(message);
        });
        expect(store.getSlots().head).toBeNull();
      },
    );
  });

  describe('focus', () => {
    it('does not steal focus on mount when embedded (shop dialog tab)', async () => {
      const store = createClassroomEquipmentStore({
        classroomId: CLASSROOM_ID,
        itemMetadata: CAP_METADATA,
        initialPurchases: [makePurchase()],
      });
      mswServer.use(...store.handlers);

      renderInventoryRoute({ panelProps: { classroomId: CLASSROOM_ID } });

      await screen.findByRole('radiogroup', { name: 'Cabeza' });
      expect(
        screen.getByRole('heading', { name: inventoryMessages.panel.heading }),
      ).not.toHaveFocus();
      expect(document.body).toHaveFocus();
    });

    it('focuses the heading on mount only when asked to (standalone route)', async () => {
      const store = createClassroomEquipmentStore({
        classroomId: CLASSROOM_ID,
        itemMetadata: CAP_METADATA,
        initialPurchases: [makePurchase()],
      });
      mswServer.use(...store.handlers);

      renderInventoryRoute({ panelProps: { focusHeadingOnMount: true } });

      await screen.findByRole('radiogroup', { name: 'Cabeza' });
      await waitFor(() => {
        expect(
          screen.getByRole('heading', {
            name: inventoryMessages.panel.heading,
          }),
        ).toHaveFocus();
      });
    });
  });

  describe('concurrent equips and paging', () => {
    it('keeps both slots equipped when responses land out of order', async () => {
      const store = createClassroomEquipmentStore({
        classroomId: CLASSROOM_ID,
        itemMetadata: { ...CAP_METADATA, [LAMP_ID]: { slot: 'desk_decor' } },
        // The head response (stale snapshot without the lamp) lands last.
        setSlotDelaysMs: { head: 120, desk_decor: 10 },
        refetchDelayMs: 400,
        initialPurchases: [makePurchase(), lampPurchase()],
      });
      mswServer.use(...store.handlers);

      const { queryClient } = renderInventoryRoute();

      const headGroup = await screen.findByRole('radiogroup', {
        name: 'Cabeza',
      });
      const deskGroup = screen.getByRole('radiogroup', {
        name: 'Decoración del escritorio',
      });
      fireEvent.click(tile(headGroup, 'Gorra azul'));
      fireEvent.click(tile(deskGroup, 'Lámpara de escritorio'));

      // Head confirmation is the last response to land.
      await waitFor(() => {
        expect(
          within(slotSection(headGroup)).getByRole('status'),
        ).toHaveTextContent(inventoryMessages.states.confirmed);
      });
      expect(tile(deskGroup, 'Lámpara de escritorio')).toHaveAttribute(
        'aria-checked',
        'true',
      );
      expect(tile(headGroup, 'Gorra azul')).toHaveAttribute(
        'aria-checked',
        'true',
      );
      const cached = queryClient.getQueryData<EquipmentStateDto>(
        classroomEquipmentQueryKey('student-user-1', CLASSROOM_ID),
      );
      expect(cached?.slots.head?.shopItemId).toBe(CAP_ID);
      expect(cached?.slots.desk_decor?.shopItemId).toBe(LAMP_ID);
    });

    it('offers a purchase that lives on the second purchases page', async () => {
      const filler = Array.from({ length: 100 }, (_, i) =>
        makePurchase({
          id: `00000000-0000-4000-8000-0000000${String(30000 + i)}`,
          shopItemId: `00000000-0000-4000-8000-0000000${String(40000 + i)}`,
          shopItemCode: `filler-${i}`,
          shopItemName: `Relleno ${i}`,
        }),
      );
      const store = createClassroomEquipmentStore({
        classroomId: CLASSROOM_ID,
        itemMetadata: { ...CAP_METADATA, [LAMP_ID]: { slot: 'desk_decor' } },
        initialPurchases: [...filler, lampPurchase()],
      });
      mswServer.use(...store.handlers);

      renderInventoryRoute();

      const deskGroup = await screen.findByRole('radiogroup', {
        name: 'Decoración del escritorio',
      });
      await waitFor(() => {
        expect(tileNames(deskGroup)).toContain('Lámpara de escritorio');
      });
    });

    it('resolves the slot of an item that lives on the second catalog page', async () => {
      const store = createClassroomEquipmentStore({
        classroomId: CLASSROOM_ID,
        itemMetadata: { ...CAP_METADATA, [LAMP_ID]: { slot: 'desk_decor' } },
        pageSizeCap: 1,
        initialPurchases: [makePurchase(), lampPurchase()],
      });
      mswServer.use(...store.handlers);

      renderInventoryRoute();

      const deskGroup = await screen.findByRole('radiogroup', {
        name: 'Decoración del escritorio',
      });
      const headGroup = screen.getByRole('radiogroup', { name: 'Cabeza' });
      await waitFor(() => {
        expect(tileNames(deskGroup)).toContain('Lámpara de escritorio');
      });
      expect(tileNames(headGroup)).toContain('Gorra azul');
    });
  });

  describe('slot resolution from catalog metadata', () => {
    it('offers a face accessory only under the Cara slot', async () => {
      const store = createClassroomEquipmentStore({
        classroomId: CLASSROOM_ID,
        itemMetadata: { ...CAP_METADATA, [GLASSES_ID]: { slot: 'face' } },
        initialPurchases: [makePurchase(), glassesPurchase()],
      });
      mswServer.use(...store.handlers);

      renderInventoryRoute();

      const faceGroup = await screen.findByRole('radiogroup', {
        name: 'Cara',
      });
      const headGroup = screen.getByRole('radiogroup', { name: 'Cabeza' });
      expect(tileNames(faceGroup)).toEqual(['Lentes estrella']);
      expect(tileNames(headGroup)).toEqual(['Gorra azul']);
      expect(screen.queryByRole('radiogroup', { name: 'Espalda' })).toBeNull();
    });

    it('does not offer items without a valid catalog slot or missing from the catalog', async () => {
      const store = createClassroomEquipmentStore({
        classroomId: CLASSROOM_ID,
        itemMetadata: {
          ...CAP_METADATA,
          [GLASSES_ID]: {},
          [BROKEN_ID]: { slot: 'tail' },
          [LAMP_ID]: { slot: 'head' },
        },
        omitFromCatalog: [GHOST_ID],
        initialPurchases: [
          makePurchase(),
          glassesPurchase(),
          makePurchase({
            id: '00000000-0000-4000-8000-000000002004',
            shopItemId: BROKEN_ID,
            shopItemName: 'Cola rara',
          }),
          makePurchase({
            id: '00000000-0000-4000-8000-000000002005',
            shopItemId: GHOST_ID,
            shopItemName: 'Fantasma',
          }),
          makePurchase({
            id: '00000000-0000-4000-8000-000000002006',
            shopItemId: LAMP_ID,
            shopItemName: 'Lámpara incompatible',
            shopItemKind: 'DESK_UPGRADE',
          }),
        ],
      });
      mswServer.use(...store.handlers);

      renderInventoryRoute();

      await screen.findByRole('radiogroup', { name: 'Cabeza' });
      const offered = screen
        .getAllByRole('radiogroup')
        .flatMap((group) => tileNames(group));
      expect(offered).toEqual(['Gorra azul']);
    });

    it('shows the load error state with a short title distinct from its description', async () => {
      const store = createClassroomEquipmentStore({
        classroomId: CLASSROOM_ID,
        itemMetadata: CAP_METADATA,
        initialPurchases: [makePurchase()],
      });
      store.failNext('catalog', {
        status: 500,
        body: {
          code: 'INTERNAL_ERROR',
          message: 'boom',
          correlationId: 'req-catalog-500',
        },
      });
      mswServer.use(...store.handlers);

      renderInventoryRoute();

      const title = await screen.findByText(inventoryMessages.errors.loadTitle);
      expect(title.tagName).toMatch(/^H[1-6]$/);
      // The description (the API's user message) is not a copy of the title.
      expect(title.parentElement).not.toHaveTextContent(
        inventoryMessages.errors.loadError,
      );
      expect(screen.queryByRole('radiogroup')).toBeNull();
    });
  });

  describe('slot labels', () => {
    it('falls back to a human label and never shows a raw slot key', () => {
      expect(getSlotLabel('head')).toBe('Cabeza');
      expect(getSlotLabel('mystery_slot')).toBe(inventoryMessages.slotFallback);
      expect(getSlotLabel('constructor')).toBe(inventoryMessages.slotFallback);
    });
  });
});
