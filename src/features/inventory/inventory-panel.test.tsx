import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createApiClient } from '@/api/client';
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
import { inventoryMessages } from './inventory-messages';
import { InventoryPanel } from './inventory-panel';

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
        element: <InventoryPanel />,
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

  it('equips and unequips a purchased item with pending and confirmed states', async () => {
    const store = createClassroomEquipmentStore({
      classroomId: CLASSROOM_ID,
      itemMetadata: { ...CAP_METADATA, [LAMP_ID]: { slot: 'desk_decor' } },
      setSlotDelayMs: 40,
      initialPurchases: [
        makePurchase(),
        makePurchase({
          id: '00000000-0000-4000-8000-000000002002',
          shopItemId: LAMP_ID,
          shopItemCode: 'desk-lamp',
          shopItemName: 'Lámpara de escritorio',
          shopItemKind: 'DESK_UPGRADE',
        }),
      ],
    });
    mswServer.use(...store.handlers);

    const { view } = renderInventoryRoute();

    const headGroup = await screen.findByRole('group', { name: 'Cabeza' });
    const select = within(headGroup).getByRole('combobox');
    fireEvent.change(select, { target: { value: CAP_ID } });

    const equipButton = within(headGroup).getByRole('button', {
      name: inventoryMessages.actions.equip,
    });
    fireEvent.click(equipButton);

    // Pending state shown while request is in flight
    expect(
      await within(headGroup).findByRole('button', {
        name: inventoryMessages.states.pending,
      }),
    ).toBeDisabled();

    // Confirmed state + equipped badge
    expect(await within(headGroup).findByRole('status')).toHaveTextContent(
      inventoryMessages.states.confirmed,
    );
    expect(
      within(headGroup).getByText(
        `${inventoryMessages.actions.equipped}: Gorra azul`,
      ),
    ).toBeInTheDocument();
    expect(store.getSlots().head?.shopItemId).toBe(CAP_ID);

    // Unequip flow
    const unequipButton = within(headGroup).getByRole('button', {
      name: inventoryMessages.actions.unequip,
    });
    fireEvent.click(unequipButton);

    await waitFor(() => {
      expect(
        within(headGroup).getByText(inventoryMessages.actions.noItem),
      ).toBeInTheDocument();
    });
    expect(store.getSlots().head).toBeNull();
    await expectAccessible(view.container);
  });

  it('shows 403 error for unowned item and leaves equipped state unchanged', async () => {
    const store = createClassroomEquipmentStore({
      classroomId: CLASSROOM_ID,
      itemMetadata: { ...CAP_METADATA, [GLASSES_ID]: { slot: 'head' } },
      initialPurchases: [
        makePurchase(),
        makePurchase({
          id: '00000000-0000-4000-8000-000000002003',
          shopItemId: GLASSES_ID,
          shopItemCode: 'glasses-star',
          shopItemName: 'Lentes estrella',
          shopItemKind: 'AVATAR_ACCESSORY',
        }),
      ],
      initialSlots: {
        head: {
          slot: 'head',
          shopItemId: CAP_ID,
          shopItemCode: 'cap-blue',
          shopItemName: 'Gorra azul',
          kind: 'AVATAR_ACCESSORY',
        },
      },
    });
    mswServer.use(...store.handlers);

    renderInventoryRoute();

    const headGroup = await screen.findByRole('group', { name: 'Cabeza' });
    expect(
      within(headGroup).getByText(
        `${inventoryMessages.actions.equipped}: Gorra azul`,
      ),
    ).toBeInTheDocument();

    // Simulate server rejecting with 403 (e.g. item not owned)
    store.failNext('setSlot', {
      status: 403,
      body: {
        code: 'FORBIDDEN',
        message: 'Item not owned',
        correlationId: 'req-403-not-owned',
      },
    });

    const select = within(headGroup).getByRole('combobox') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: GLASSES_ID } });
    fireEvent.click(
      within(headGroup).getByRole('button', {
        name: inventoryMessages.actions.equip,
      }),
    );

    const alert = await within(headGroup).findByRole('alert');
    expect(alert).toHaveTextContent(inventoryMessages.errors.notOwned);

    // Equipped state remains Gorra azul and select reverts to confirmed CAP_ID
    expect(
      within(headGroup).getByText(
        `${inventoryMessages.actions.equipped}: Gorra azul`,
      ),
    ).toBeInTheDocument();
    expect(select.value).toBe(CAP_ID);
    expect(store.getSlots().head?.shopItemId).toBe(CAP_ID);
  });

  it('handles uncertain 500 error without changing equipped state and reconciles', async () => {
    const store = createClassroomEquipmentStore({
      classroomId: CLASSROOM_ID,
      itemMetadata: CAP_METADATA,
      initialPurchases: [makePurchase()],
    });
    mswServer.use(...store.handlers);

    renderInventoryRoute();

    const headGroup = await screen.findByRole('group', { name: 'Cabeza' });
    store.failNext('setSlot', {
      status: 500,
      body: {
        code: 'INTERNAL_ERROR',
        message: 'Server error',
        correlationId: 'req-500',
      },
    });

    const select = within(headGroup).getByRole('combobox') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: CAP_ID } });
    fireEvent.click(
      within(headGroup).getByRole('button', {
        name: inventoryMessages.actions.equip,
      }),
    );

    const alert = await within(headGroup).findByRole('alert');
    expect(alert).toHaveTextContent(inventoryMessages.errors.uncertain);
    expect(
      within(headGroup).getByText(inventoryMessages.actions.noItem),
    ).toBeInTheDocument();
    expect(select.value).toBe('');
    await waitFor(() => {
      expect(store.getCounts().getEquipment).toBeGreaterThanOrEqual(2);
    });
  });

  describe('slot resolution from catalog metadata', () => {
    const glasses = () =>
      makePurchase({
        id: '00000000-0000-4000-8000-000000002003',
        shopItemId: GLASSES_ID,
        shopItemCode: 'glasses-star',
        shopItemName: 'Lentes estrella',
      });

    function optionNames(group: HTMLElement): string[] {
      return within(group)
        .queryAllByRole('option')
        .map((o) => o.textContent ?? '');
    }

    it('offers a face accessory only under the Cara slot', async () => {
      const store = createClassroomEquipmentStore({
        classroomId: CLASSROOM_ID,
        itemMetadata: { ...CAP_METADATA, [GLASSES_ID]: { slot: 'face' } },
        initialPurchases: [makePurchase(), glasses()],
      });
      mswServer.use(...store.handlers);

      renderInventoryRoute();

      const faceGroup = await screen.findByRole('group', { name: 'Cara' });
      const headGroup = screen.getByRole('group', { name: 'Cabeza' });
      const backGroup = screen.getByRole('group', { name: 'Espalda' });
      expect(optionNames(faceGroup)).toContain('Lentes estrella');
      expect(optionNames(faceGroup)).not.toContain('Gorra azul');
      expect(optionNames(headGroup)).toContain('Gorra azul');
      expect(optionNames(headGroup)).not.toContain('Lentes estrella');
      expect(optionNames(backGroup)).not.toContain('Lentes estrella');
      expect(optionNames(backGroup)).not.toContain('Gorra azul');
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
          glasses(),
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

      await screen.findByRole('group', { name: 'Cabeza' });
      const offered = screen
        .getAllByRole('group')
        .flatMap((group) => optionNames(group));
      expect(offered).toContain('Gorra azul');
      for (const hidden of [
        'Lentes estrella',
        'Cola rara',
        'Fantasma',
        'Lámpara incompatible',
      ]) {
        expect(offered).not.toContain(hidden);
      }
    });

    it('shows the load error state when the catalog fails to load', async () => {
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

      expect(
        await screen.findByText(inventoryMessages.errors.loadError),
      ).toBeInTheDocument();
      expect(screen.queryByRole('group', { name: 'Cabeza' })).toBeNull();
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

        const headGroup = await screen.findByRole('group', { name: 'Cabeza' });
        store.failNext('setSlot', {
          status,
          body: { code, message: 'rejected', correlationId: `req-${status}` },
        });
        fireEvent.change(within(headGroup).getByRole('combobox'), {
          target: { value: CAP_ID },
        });
        fireEvent.click(
          within(headGroup).getByRole('button', {
            name: inventoryMessages.actions.equip,
          }),
        );

        expect(await within(headGroup).findByRole('alert')).toHaveTextContent(
          message,
        );
        expect(store.getSlots().head).toBeNull();
      },
    );
  });
});
