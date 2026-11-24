import {
  act,
  fireEvent,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { createApiClient } from '@/api/client';
import { ApiQueryProvider, createAppQueryClient } from '@/api/query-client';
import type { components } from '@/api/schema.generated';
import { fakeSession } from '@/app/router/fake-session';
import { SessionProvider } from '@/session/provider';
import { profile } from '@/session/test-fixtures';
import { expectAccessible } from '@/test/accessibility';
import {
  createClassroomDetailHandler,
  createClassroomShopStore,
  TEST_API_BASE_URL,
  type ShopStoreCatalogItem,
} from '@/test/msw/handlers';
import { mswServer } from '@/test/msw/server';
import { render } from '@/test/render';
import { ShopPanel } from './shop-panel';

vi.mock('./item-preview-renderer', () => ({
  renderGlbThumbnail: vi.fn(() =>
    Promise.resolve('data:image/png;base64,AAAA'),
  ),
}));

const CLASSROOM_ID = '00000000-0000-4000-8000-000000000048';
const ITEM_CAP_ID = '00000000-0000-4000-8000-000000001001';
const ITEM_LAMP_ID = '00000000-0000-4000-8000-000000001002';
const ITEM_UPCOMING_ID = '00000000-0000-4000-8000-000000001003';
const ITEM_CLASSROOM_ID = '00000000-0000-4000-8000-000000001004';

type Capability =
  components['schemas']['ClassroomContextResponseDto']['capabilities'][number];

function makeItem(
  overrides: Partial<ShopStoreCatalogItem> = {},
): ShopStoreCatalogItem {
  return {
    id: ITEM_CAP_ID,
    code: 'cap-classic',
    name: 'Gorra clásica',
    description: 'Accesorio deportivo para el avatar.',
    kind: 'AVATAR_ACCESSORY',
    price: 100,
    isImplemented: true,
    createdAt: '2026-11-18T10:00:00.000Z',
    ...overrides,
  };
}

function renderShopRoute(options: {
  readonly role?: 'STUDENT' | 'TEACHER' | 'PARENT';
  readonly capabilities?: readonly Capability[];
}) {
  const role = options.role ?? 'STUDENT';
  const capabilities: Capability[] =
    options.capabilities !== undefined
      ? [...options.capabilities]
      : role === 'STUDENT'
        ? ['participate_activities']
        : role === 'TEACHER'
          ? ['publish_content', 'configure_classroom']
          : ['message_teacher'];

  mswServer.use(
    createClassroomDetailHandler(CLASSROOM_ID, {
      myRole: role,
      capabilities,
    }),
  );

  const client = createApiClient({ baseUrl: TEST_API_BASE_URL });
  const queryClient = createAppQueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const session = fakeSession(
    { status: 'authenticated', user: { ...profile, id: 'student-user-1' } },
    client,
  );

  const router = createMemoryRouter(
    [
      {
        path: '/classrooms/:classroomId/panels/shop',
        element: <ShopPanel />,
      },
    ],
    { initialEntries: [`/classrooms/${CLASSROOM_ID}/panels/shop`] },
  );

  const rendered = render(
    <SessionProvider service={session.service}>
      <ApiQueryProvider client={queryClient}>
        <RouterProvider router={router} />
      </ApiQueryProvider>
    </SessionProvider>,
  );

  return { ...rendered, queryClient };
}

describe('ShopPanel (#48)', () => {
  beforeAll(() => mswServer.listen());
  afterEach(() => mswServer.resetHandlers());
  afterAll(() => mswServer.close());

  it('shows balance, filters catalog, hides buy action on unimplemented/owned items, confirms purchase, and updates balance & history', async () => {
    const store = createClassroomShopStore({
      classroomId: CLASSROOM_ID,
      initialBalance: 250,
      initialItems: [
        makeItem(),
        makeItem({
          id: ITEM_LAMP_ID,
          code: 'desk-lamp',
          name: 'Lámpara de escritorio',
          description: 'Iluminación cálida para tu banco.',
          kind: 'DESK_UPGRADE',
          price: 180,
          createdAt: '2026-11-18T11:00:00.000Z',
        }),
        makeItem({
          id: ITEM_UPCOMING_ID,
          code: 'pet-collar',
          name: 'Collar de mascota',
          description: 'Accesorio próximamente.',
          kind: 'PET_ACCESSORY',
          price: 90,
          isImplemented: false,
          createdAt: '2026-11-18T12:00:00.000Z',
        }),
        makeItem({
          id: ITEM_CLASSROOM_ID,
          code: 'chalkboard-theme',
          name: 'Pizarrón espacial',
          description: 'Tema compartido del aula.',
          kind: 'CLASSROOM_ITEM',
          price: 300,
          ownedByClassroom: true,
          createdAt: '2026-11-18T13:00:00.000Z',
        }),
      ],
    });
    mswServer.use(...store.handlers);

    renderShopRoute({ role: 'STUDENT' });

    expect(
      await screen.findByRole('heading', { name: 'Tienda del aula' }),
    ).toBeVisible();
    expect(await screen.findByText('250 puntos')).toBeVisible();
    expect(await screen.findByText('Gorra clásica')).toBeVisible();
    expect(screen.getByText('Próximamente')).toBeVisible();
    expect(screen.getByText('Desbloqueado en el aula')).toBeVisible();

    // Only the 2 purchasable items render a Buy button
    expect(screen.getAllByRole('button', { name: 'Comprar' })).toHaveLength(2);

    // Filter by category
    fireEvent.change(screen.getByLabelText('Categoría'), {
      target: { value: 'AVATAR_ACCESSORY' },
    });
    await waitFor(() => {
      expect(
        screen.queryByText('Lámpara de escritorio'),
      ).not.toBeInTheDocument();
    });

    // Open confirmation dialog and buy Gorra clásica (100 pts)
    fireEvent.click(screen.getByRole('button', { name: 'Comprar' }));
    const dialog = await screen.findByRole('dialog', {
      name: 'Confirmar compra',
    });
    expect(within(dialog).getByText('Gorra clásica')).toBeVisible();
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Confirmar compra' }),
    );

    // Dialog closes, balance updates to 150 puntos, item shows Ya lo tenés
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(await screen.findByText('150 puntos')).toBeVisible();
    expect(await screen.findByText('Ya lo tenés')).toBeVisible();

    // Switch to Mis compras tab and verify purchase history
    const purchasesTab = screen.getByRole('tab', { name: 'Mis compras' });
    fireEvent.mouseDown(purchasesTab, { button: 0 });
    fireEvent.click(purchasesTab);
    expect(await screen.findByText('Pagado: 100 puntos')).toBeVisible();
    expect(screen.getByText('Gorra clásica')).toBeVisible();
  });

  it('guards against rapid double clicks so only one purchase request is sent', async () => {
    const store = createClassroomShopStore({
      classroomId: CLASSROOM_ID,
      initialBalance: 300,
      purchaseDelayMs: 60,
      initialItems: [makeItem({ price: 100 })],
    });
    mswServer.use(...store.handlers);

    renderShopRoute({ role: 'STUDENT' });
    fireEvent.click(await screen.findByRole('button', { name: 'Comprar' }));
    const dialog = await screen.findByRole('dialog', {
      name: 'Confirmar compra',
    });
    const confirmBtn = within(dialog).getByRole('button', {
      name: 'Confirmar compra',
    });

    fireEvent.click(confirmBtn);
    fireEvent.click(confirmBtn);
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(store.getCounts().purchase).toBe(1);
    expect(store.getBalance()).toBe(200);
  });

  it('explains insufficient balance 409 clearly without changing balance or showing negatives', async () => {
    const store = createClassroomShopStore({
      classroomId: CLASSROOM_ID,
      initialBalance: 40,
      initialItems: [makeItem({ price: 100 })],
    });
    mswServer.use(...store.handlers);

    renderShopRoute({ role: 'STUDENT' });
    expect(await screen.findByText('40 puntos')).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: 'Comprar' }));
    const dialog = await screen.findByRole('dialog', {
      name: 'Confirmar compra',
    });
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Confirmar compra' }),
    );

    expect(
      await within(dialog).findByText(
        'No tenés puntos suficientes para comprar este artículo. Tu saldo no fue modificado.',
      ),
    ).toBeVisible();
    expect(store.getBalance()).toBe(40);
    expect(screen.queryByText(/-\d+\s+puntos/)).not.toBeInTheDocument();
  });

  it('reconciles uncertain dropped response when server already committed (no double charge)', async () => {
    const store = createClassroomShopStore({
      classroomId: CLASSROOM_ID,
      initialBalance: 250,
      initialItems: [makeItem({ price: 100 })],
    });
    store.failNext('purchase', 'drop-response');
    mswServer.use(...store.handlers);

    renderShopRoute({ role: 'STUDENT' });
    fireEvent.click(await screen.findByRole('button', { name: 'Comprar' }));
    const dialog = await screen.findByRole('dialog', {
      name: 'Confirmar compra',
    });
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Confirmar compra' }),
    );

    // Reconciliation discovers item is now owned and closes cleanly without second POST
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(await screen.findByText('Ya lo tenés')).toBeVisible();
    expect(await screen.findByText('150 puntos')).toBeVisible();
    expect(store.getCounts().purchase).toBe(1);
    expect(store.getBalance()).toBe(150);
  });

  it('preserves the exact same Idempotency-Key on explicit retry after an uncommitted 503', async () => {
    const store = createClassroomShopStore({
      classroomId: CLASSROOM_ID,
      initialBalance: 200,
      initialItems: [makeItem({ price: 100 })],
    });
    store.failNext('purchase', {
      status: 503,
      body: {
        code: 'SERVICE_UNAVAILABLE',
        message: 'Temporary outage',
        correlationId: 'req-503',
      },
    });
    mswServer.use(...store.handlers);

    renderShopRoute({ role: 'STUDENT' });
    fireEvent.click(await screen.findByRole('button', { name: 'Comprar' }));
    const dialog = await screen.findByRole('dialog', {
      name: 'Confirmar compra',
    });
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Confirmar compra' }),
    );

    expect(
      await within(dialog).findByText(
        'No pudimos confirmar el resultado de la compra',
      ),
    ).toBeVisible();

    const retryBtn = within(dialog).getByRole('button', {
      name: 'Reintentar con la misma solicitud',
    });
    fireEvent.click(retryBtn);

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    const keys = store.getReceivedIdempotencyKeys();
    expect(keys).toHaveLength(2);
    expect(keys[0]).toBe(keys[1]);
    expect(store.getBalance()).toBe(100);
  });

  it('hides purchase UI from teachers and never issues student-only shop requests', async () => {
    const store = createClassroomShopStore({
      classroomId: CLASSROOM_ID,
      role: 'TEACHER',
      initialItems: [makeItem()],
    });
    mswServer.use(...store.handlers);

    renderShopRoute({ role: 'TEACHER' });
    expect(
      await screen.findByText('Tienda disponible solo para estudiantes'),
    ).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'Comprar' }),
    ).not.toBeInTheDocument();
    expect(store.getCounts().items).toBe(0);
    expect(store.getCounts().wallet).toBe(0);
  });

  it('shows unavailable balance (never 0) on wallet failure and preserves catalog with StaleDataNotice', async () => {
    const store = createClassroomShopStore({
      classroomId: CLASSROOM_ID,
      initialBalance: 250,
      initialItems: [makeItem()],
    });
    store.failNext('wallet', {
      status: 503,
      body: {
        code: 'SERVICE_UNAVAILABLE',
        message: 'Wallet down',
        correlationId: 'req-wallet-503',
      },
    });
    mswServer.use(...store.handlers);

    const view = renderShopRoute({ role: 'STUDENT' });
    expect(
      await screen.findByText('Saldo no disponible en este momento'),
    ).toBeVisible();
    expect(screen.queryByText('0 puntos')).not.toBeInTheDocument();
    expect(await screen.findByText('Gorra clásica')).toBeVisible();

    // Transient 503 on catalog refetch keeps items visible with StaleDataNotice
    store.failNext('items', {
      status: 503,
      body: {
        code: 'SERVICE_UNAVAILABLE',
        message: 'Shop down',
        correlationId: 'req-shop-503',
      },
    });
    await act(async () => {
      await view.queryClient.invalidateQueries();
    });
    expect(
      await screen.findByText('Mostrando el último catálogo conocido'),
    ).toBeVisible();
    expect(screen.getByText('Gorra clásica')).toBeVisible();
  });

  it('has no accessibility violations in the student shop catalog', async () => {
    const store = createClassroomShopStore({
      classroomId: CLASSROOM_ID,
      initialBalance: 250,
      initialItems: [
        makeItem(),
        makeItem({
          id: ITEM_UPCOMING_ID,
          code: 'pet-collar',
          name: 'Collar de mascota',
          description: 'Accesorio próximamente.',
          kind: 'PET_ACCESSORY',
          price: 90,
          isImplemented: false,
          createdAt: '2026-11-18T12:00:00.000Z',
        }),
      ],
    });
    mswServer.use(...store.handlers);

    const view = renderShopRoute({ role: 'STUDENT' });
    expect(await screen.findByText('Gorra clásica')).toBeVisible();
    await expectAccessible(view.container);
  });
  it('shows what each item is: a rendered preview for accessories and an illustration otherwise, with the price as a card', async () => {
    const store = createClassroomShopStore({
      classroomId: CLASSROOM_ID,
      initialBalance: 250,
      initialItems: [
        makeItem({ metadata: { slot: 'head', assetId: 'cap' } }),
        makeItem({
          id: ITEM_LAMP_ID,
          code: 'desk-lamp',
          name: 'Lámpara de escritorio',
          kind: 'DESK_UPGRADE',
          price: 180,
          metadata: { assetId: 'desk_lamp' },
        }),
      ],
    });
    mswServer.use(...store.handlers);

    renderShopRoute({ role: 'STUDENT' });

    expect(
      await screen.findByRole('img', { name: 'Vista previa de Gorra clásica' }),
    ).toHaveAttribute('src', 'data:image/png;base64,AAAA');
    expect(
      screen.getByRole('img', { name: 'Ilustración de Lámpara de escritorio' }),
    ).toBeInTheDocument();
    const cards = screen.getAllByRole('listitem');
    expect(cards).toHaveLength(2);
    expect(within(cards[0]).getByText('100 puntos')).toBeVisible();
    expect(
      within(cards[0]).getByRole('button', { name: 'Comprar' }),
    ).toBeVisible();
  });
});
