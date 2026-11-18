import { QueryClient } from '@tanstack/react-query';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from 'vitest';
import { createAppRoutes } from '@/app/router/routes';
import { createSession } from '@/session/controller';
import { SessionProvider } from '@/session/provider';
import { expectAccessible } from '@/test/accessibility';
import {
  TEST_API_BASE_URL,
  createLoginHandler,
  createLogoutHandler,
  createOwnProfileStore,
  type OwnProfileStore,
} from '@/test/msw/handlers';
import { mswServer } from '@/test/msw/server';
import { render } from '@/test/render';
import '@/app/pages/profile-page';
import { profileMessages } from './messages';

beforeAll(() => {
  mswServer.listen({ onUnhandledFrame: 'error' });
});

beforeEach(() => {
  window.sessionStorage.clear();
  vi.stubEnv('VITE_APP_ENV', 'test');
  vi.stubEnv('VITE_API_BASE_URL', TEST_API_BASE_URL);
  vi.stubEnv('VITE_REALTIME_URL', 'wss://realtime.example.invalid');
});

afterEach(() => {
  mswServer.resetHandlers();
  window.sessionStorage.clear();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

afterAll(() => {
  mswServer.close();
});

const copy = profileMessages;

async function renderProfile(
  store: OwnProfileStore,
  options: { readonly signIn?: boolean; readonly path?: string } = {},
) {
  mswServer.use(createLoginHandler(), ...store.handlers);
  const session = createSession({ baseUrl: TEST_API_BASE_URL });
  if (options.signIn ?? true) {
    const result = await session.controller.login({
      email: 'ana@example.com',
      password: 'ClaveSegura2026',
    });
    expect(result.ok).toBe(true);
  }
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const router = createMemoryRouter(createAppRoutes(), {
    initialEntries: [options.path ?? '/profile'],
  });
  const view = render(
    <SessionProvider service={session}>
      <RouterProvider router={router} />
    </SessionProvider>,
    { queryClient },
  );
  return { router, session, queryClient, ...view };
}

const nameSection = () =>
  screen.getByRole('region', { name: copy.displayName.heading });
const avatarSection = () =>
  screen.getByRole('region', { name: copy.avatar.heading });
const group = (name: string) => screen.getByRole('group', { name });
const radio = (groupName: string, label: string) =>
  within(group(groupName)).getByRole('radio', { name: label });
const nameInput = () =>
  within(nameSection()).getByLabelText(copy.displayName.label);
const saveStatus = (section: HTMLElement) =>
  section.querySelector('[data-save-status]')?.getAttribute('data-save-status');

async function waitForProfile() {
  await screen.findByRole('region', { name: copy.avatar.heading });
}

function selectChoice(groupName: string, label: string) {
  fireEvent.click(radio(groupName, label));
}

const validationDetail = (field: string) => ({
  code: 'VALIDATION_FAILED' as const,
  message: 'Validation failed',
  details: [{ field, messages: [`${field} was rejected by the server`] }],
  correlationId: 'corr-test-validation',
});

describe('Profile page (/profile)', () => {
  test('loads the confirmed profile with the saved name and avatar, accessibly', async () => {
    const store = createOwnProfileStore({
      initial: {
        displayName: 'Sofía Martínez',
        email: 'sofia@ejemplo.com',
        avatar: {
          bodyId: 'female',
          hairId: 'original',
          topId: 'tshirt',
          hairColor: '#E5AD58',
          clothingColor: '#75B7DA',
        },
      },
    });
    const { container } = await renderProfile(store);

    expect(await screen.findByText(copy.loading)).toBeInTheDocument();
    await waitForProfile();

    expect(nameInput()).toHaveValue('Sofía Martínez');
    expect(screen.getByText('sofia@ejemplo.com')).toBeInTheDocument();
    expect(radio(copy.avatar.groups.bodyId, 'Femenino')).toBeChecked();
    expect(radio(copy.avatar.groups.hairId, 'Clásico')).toBeChecked();
    expect(radio(copy.avatar.groups.topId, 'Remera')).toBeChecked();
    expect(radio(copy.avatar.groups.hairColor, 'Rubio')).toBeChecked();
    expect(radio(copy.avatar.groups.clothingColor, 'Celeste')).toBeChecked();
    expect(
      screen.getByRole('img', {
        name: /Femenino, Clásico, Rubio, Remera, Celeste/,
      }),
    ).toBeInTheDocument();
    expect(saveStatus(nameSection())).toBe('saved');
    expect(saveStatus(avatarSection())).toBe('saved');
    expect(screen.getByText(copy.avatar.previewSaved)).toBeInTheDocument();
    await expectAccessible(container);
  });

  test('offers only the options of the contract for the selected body', async () => {
    await renderProfile(createOwnProfileStore());
    await waitForProfile();

    // male: afro/dreads and hoodie/tank
    expect(within(group('Peinado')).getAllByRole('radio')).toHaveLength(2);
    expect(within(group('Prenda superior')).getAllByRole('radio')).toHaveLength(
      2,
    );
    selectChoice('Cuerpo', 'Femenino');
    expect(
      within(group('Peinado')).getByRole('radio', { name: 'Clásico' }),
    ).toBeInTheDocument();
    expect(
      within(group('Peinado')).queryByRole('radio', { name: 'Rastas' }),
    ).not.toBeInTheDocument();
    expect(within(group('Prenda superior')).getAllByRole('radio')).toHaveLength(
      3,
    );
  });

  test('edits and saves the display name with pending and confirmed states', async () => {
    const requests: unknown[] = [];
    const store = createOwnProfileStore({
      onProfileRequest: (body) => {
        requests.push(body);
      },
    });
    await renderProfile(store);
    await waitForProfile();

    const submit = within(nameSection()).getByRole('button', {
      name: copy.displayName.submit,
    });
    expect(submit).toBeDisabled();

    fireEvent.change(nameInput(), { target: { value: '  Ana María  ' } });
    await waitFor(() => expect(saveStatus(nameSection())).toBe('unsaved'));
    expect(submit).toBeEnabled();

    fireEvent.click(submit);
    await waitFor(() => expect(saveStatus(nameSection())).toBe('saving'));
    await waitFor(() => expect(saveStatus(nameSection())).toBe('saved'));

    expect(requests).toEqual([{ displayName: 'Ana María' }]);
    expect(store.read().displayName).toBe('Ana María');
    expect(nameInput()).toHaveValue('Ana María');
    expect(within(nameSection()).getByRole('status')).toHaveTextContent(
      copy.displayName.confirmed,
    );
    // The shell shows the confirmed name without a reload.
    expect(screen.getByText('Ana María', { selector: 'span' })).toBeVisible();
  });

  test.each([
    ['', copy.displayName.validation.required],
    ['   ', copy.displayName.validation.required],
    ['x'.repeat(101), copy.displayName.validation.tooLong],
    ['Ana\u2028López', copy.displayName.validation.invalidCharacters],
    ['\u200B\u2800', copy.displayName.validation.notVisible],
  ])(
    'rejects the invalid display name %j before any request',
    async (value, message) => {
      const requests: unknown[] = [];
      const store = createOwnProfileStore({
        onProfileRequest: (body) => {
          requests.push(body);
        },
      });
      await renderProfile(store);
      await waitForProfile();

      fireEvent.change(nameInput(), { target: { value } });
      fireEvent.submit(nameInput().closest('form')!);

      expect(await within(nameSection()).findByText(message)).toBeVisible();
      expect(nameInput()).toHaveAttribute('aria-invalid', 'true');
      expect(requests).toEqual([]);
      expect(store.read().displayName).toBe('Ana López');
    },
  );

  test('keeps the draft and the saved state when the server rejects the name (400)', async () => {
    const store = createOwnProfileStore();
    await renderProfile(store);
    await waitForProfile();
    store.failNext('profile', {
      status: 400,
      body: validationDetail('displayName'),
    });

    fireEvent.change(nameInput(), { target: { value: 'Nombre rechazado' } });
    fireEvent.click(
      within(nameSection()).getByRole('button', {
        name: copy.displayName.submit,
      }),
    );

    expect(
      await within(nameSection()).findByText(
        'displayName was rejected by the server',
      ),
    ).toBeVisible();
    expect(nameInput()).toHaveValue('Nombre rechazado');
    expect(saveStatus(nameSection())).toBe('failed');
    expect(store.read().displayName).toBe('Ana López');
    // The shell still shows the last confirmed name.
    expect(screen.getByText('Ana López', { selector: 'span' })).toBeVisible();
  });

  test('saves a new base avatar and reflects the server-confirmed choice', async () => {
    const requests: unknown[] = [];
    const store = createOwnProfileStore({
      onAvatarRequest: (body) => {
        requests.push(body);
      },
    });
    await renderProfile(store);
    await waitForProfile();

    selectChoice('Cuerpo', 'Femenino');
    selectChoice('Peinado', 'Clásico');
    selectChoice('Color de pelo', 'Rosa');
    selectChoice('Prenda superior', 'Remera');
    selectChoice('Color de la prenda', 'Verde');

    expect(saveStatus(avatarSection())).toBe('unsaved');
    expect(screen.getByText(copy.avatar.previewDraft)).toBeInTheDocument();
    expect(
      screen.getByRole('img', {
        name: /Femenino, Clásico, Rosa, Remera, Verde/,
      }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: copy.avatar.submit }));
    await waitFor(() => expect(saveStatus(avatarSection())).toBe('saved'));

    expect(requests).toEqual([
      {
        bodyId: 'female',
        hairId: 'original',
        topId: 'tshirt',
        hairColor: '#C77DAA',
        clothingColor: '#7EBA8B',
      },
    ]);
    expect(store.read().avatar).toEqual(requests[0]);
    expect(screen.getByText(copy.avatar.previewSaved)).toBeInTheDocument();
    expect(avatarSection()).toHaveTextContent(copy.avatar.confirmed);
  });

  test('adjusts hair and top when the body makes them unavailable and says so', async () => {
    await renderProfile(createOwnProfileStore());
    await waitForProfile();

    selectChoice('Peinado', 'Rastas');
    selectChoice('Cuerpo', 'Femenino');

    expect(radio('Peinado', 'Afro')).toBeChecked();
    expect(screen.getByText(copy.avatar.adjusted)).toBeVisible();
  });

  test('discarding a draft restores the saved avatar without reporting a failure', async () => {
    const store = createOwnProfileStore();
    await renderProfile(store);
    await waitForProfile();

    selectChoice('Color de pelo', 'Rosa');
    expect(saveStatus(avatarSection())).toBe('unsaved');
    fireEvent.click(screen.getByRole('button', { name: copy.avatar.discard }));

    await waitFor(() => expect(saveStatus(avatarSection())).toBe('saved'));
    expect(radio('Color de pelo', 'Castaño')).toBeChecked();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(store.read().avatar.hairColor).toBe('#6C4D48');
  });

  test('403 on the avatar shows a safe message and preserves draft and saved avatar', async () => {
    const store = createOwnProfileStore();
    await renderProfile(store);
    await waitForProfile();
    store.failNext('avatar', {
      status: 403,
      body: {
        code: 'FORBIDDEN',
        message: 'Avatar access adapter denied use.',
        correlationId: 'corr-test-403',
      },
    });

    selectChoice('Color de la prenda', 'Amarillo');
    fireEvent.click(screen.getByRole('button', { name: copy.avatar.submit }));

    const alert = await within(avatarSection()).findByRole('alert');
    expect(alert).toHaveTextContent(copy.errors.forbidden);
    expect(alert).not.toHaveTextContent('adapter');
    expect(radio('Color de la prenda', 'Amarillo')).toBeChecked();
    expect(saveStatus(avatarSection())).toBe('failed');
    expect(screen.getByText(copy.avatar.previewDraft)).toBeInTheDocument();
    expect(store.read().avatar.clothingColor).toBe('#5B4F96');
  });

  test('400 on the avatar marks the rejected field and keeps the draft', async () => {
    const store = createOwnProfileStore();
    await renderProfile(store);
    await waitForProfile();
    store.failNext('avatar', { status: 400, body: validationDetail('hairId') });

    selectChoice('Peinado', 'Rastas');
    fireEvent.click(screen.getByRole('button', { name: copy.avatar.submit }));

    expect(
      await within(group('Peinado')).findByText(
        'hairId was rejected by the server',
      ),
    ).toBeVisible();
    expect(radio('Peinado', 'Rastas')).toBeChecked();
    expect(store.read().avatar.hairId).toBe('afro');
  });

  test('a write whose response is lost is reconciled and reported as saved when it did persist', async () => {
    const store = createOwnProfileStore();
    await renderProfile(store);
    await waitForProfile();
    store.failNext('avatar', 'drop-response');

    selectChoice('Color de pelo', 'Cobrizo');
    fireEvent.click(screen.getByRole('button', { name: copy.avatar.submit }));

    await waitFor(() => expect(saveStatus(avatarSection())).toBe('saved'));
    expect(store.read().avatar.hairColor).toBe('#AF6D63');
    expect(
      within(avatarSection()).queryByRole('alert'),
    ).not.toBeInTheDocument();
  });

  test('an uncertain write that did not persist keeps the draft and never claims success', async () => {
    const store = createOwnProfileStore();
    await renderProfile(store);
    await waitForProfile();
    store.failNext('avatar', 'network');

    selectChoice('Color de pelo', 'Cobrizo');
    fireEvent.click(screen.getByRole('button', { name: copy.avatar.submit }));

    const alert = await within(avatarSection()).findByRole('alert');
    expect(alert).toHaveTextContent(copy.errors.networkUncertain);
    expect(radio('Color de pelo', 'Cobrizo')).toBeChecked();
    expect(saveStatus(avatarSection())).toBe('failed');
    expect(store.read().avatar.hairColor).toBe('#6C4D48');
  });

  test('persists after a reload: a fresh session reads what the server saved', async () => {
    const store = createOwnProfileStore();
    const first = await renderProfile(store);
    await waitForProfile();

    fireEvent.change(nameInput(), { target: { value: 'Nombre persistido' } });
    selectChoice('Color de pelo', 'Rubio');
    fireEvent.click(
      within(nameSection()).getByRole('button', {
        name: copy.displayName.submit,
      }),
    );
    await waitFor(() => expect(saveStatus(nameSection())).toBe('saved'));
    fireEvent.click(screen.getByRole('button', { name: copy.avatar.submit }));
    await waitFor(() => expect(saveStatus(avatarSection())).toBe('saved'));
    first.unmount();

    // Same server state, brand new client memory (reload or another device).
    await renderProfile(store, { signIn: false });
    await waitForProfile();
    expect(nameInput()).toHaveValue('Nombre persistido');
    expect(radio('Color de pelo', 'Rubio')).toBeChecked();
  });

  test('a failed load is an error with retry, not an empty profile', async () => {
    const store = createOwnProfileStore();
    const view = await renderProfile(store);
    // The session already verified itself; make the page's own read fail.
    store.failNextRead({
      status: 500,
      body: {
        code: 'INTERNAL_ERROR',
        message: 'boom',
        correlationId: 'corr-test-500',
      },
    });
    view.queryClient.clear();
    await view.router.navigate('/');
    await view.router.navigate('/profile');

    const retry = await screen.findByRole('button', { name: /reintentar/i });
    expect(screen.getByText(copy.loadError.title)).toBeVisible();
    expect(
      screen.queryByRole('region', { name: copy.avatar.heading }),
    ).not.toBeInTheDocument();

    fireEvent.click(retry);
    await waitForProfile();
    expect(nameInput()).toHaveValue('Ana López');
  });

  test('asks before leaving with an unsaved draft and stays when declined', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const view = await renderProfile(createOwnProfileStore());
    await waitForProfile();

    fireEvent.change(nameInput(), { target: { value: 'Borrador' } });
    await waitFor(() => expect(saveStatus(nameSection())).toBe('unsaved'));
    await view.router.navigate('/');

    await waitFor(() => expect(confirm).toHaveBeenCalledTimes(1));
    expect(view.router.state.location.pathname).toBe('/profile');
    expect(nameInput()).toHaveValue('Borrador');

    confirm.mockReturnValue(true);
    await view.router.navigate('/');
    await waitFor(() => expect(view.router.state.location.pathname).toBe('/'));
  });

  test('the shell links to the profile page', async () => {
    const view = await renderProfile(createOwnProfileStore(), {
      path: '/',
    });
    const link = await screen.findByRole('link', { name: 'Mi perfil' });
    fireEvent.click(link);
    await waitForProfile();
    expect(view.router.state.location.pathname).toBe('/profile');
  });

  test('does not claim success when reconciliation fails offline even if the cached value matches', async () => {
    const store = createOwnProfileStore();
    await renderProfile(store);
    await waitForProfile();

    store.failNext('profile', 'network');
    store.failNextRead('network');

    fireEvent.change(nameInput(), { target: { value: '  Ana López  ' } });
    fireEvent.click(
      within(nameSection()).getByRole('button', {
        name: copy.displayName.submit,
      }),
    );

    const alert = await within(nameSection()).findByRole('alert');
    expect(alert).toHaveTextContent(copy.errors.networkUncertain);
    expect(saveStatus(nameSection())).toBe('failed');
    expect(nameSection()).not.toHaveTextContent(copy.displayName.confirmed);
  });

  test('disables name and avatar inputs while a save is in flight', async () => {
    let releaseProfile!: () => void;
    let releaseAvatar!: () => void;
    const store = createOwnProfileStore({
      onProfileRequest: () =>
        new Promise<void>((resolve) => {
          releaseProfile = resolve;
        }),
      onAvatarRequest: () =>
        new Promise<void>((resolve) => {
          releaseAvatar = resolve;
        }),
    });
    await renderProfile(store);
    await waitForProfile();

    fireEvent.change(nameInput(), { target: { value: 'Ana María' } });
    fireEvent.click(
      within(nameSection()).getByRole('button', {
        name: copy.displayName.submit,
      }),
    );
    await waitFor(() => expect(saveStatus(nameSection())).toBe('saving'));
    expect(nameInput()).toBeDisabled();

    releaseProfile();
    await waitFor(() => expect(saveStatus(nameSection())).toBe('saved'));
    expect(nameInput()).toBeEnabled();

    selectChoice('Color de pelo', 'Rubio');
    fireEvent.click(screen.getByRole('button', { name: copy.avatar.submit }));
    await waitFor(() => expect(saveStatus(avatarSection())).toBe('saving'));
    expect(radio('Color de pelo', 'Rubio')).toBeDisabled();
    expect(radio('Cuerpo', 'Masculino')).toBeDisabled();

    releaseAvatar();
    await waitFor(() => expect(saveStatus(avatarSection())).toBe('saved'));
    expect(radio('Color de pelo', 'Rubio')).toBeEnabled();
  });

  test('logging out during an in-flight profile save aborts cleanly without unhandled rejection', async () => {
    let releaseProfile!: () => void;
    let releaseAvatar!: () => void;
    const store = createOwnProfileStore({
      onProfileRequest: () =>
        new Promise<void>((resolve) => {
          releaseProfile = resolve;
        }),
      onAvatarRequest: () =>
        new Promise<void>((resolve) => {
          releaseAvatar = resolve;
        }),
    });
    const view = await renderProfile(store);
    mswServer.use(createLogoutHandler());
    await waitForProfile();

    const rejections: unknown[] = [];
    const onUnhandled = (reason: unknown) => {
      rejections.push(reason);
    };
    process.on('unhandledRejection', onUnhandled);
    try {
      fireEvent.change(nameInput(), { target: { value: 'Ana En Vuelo' } });
      fireEvent.click(
        within(nameSection()).getByRole('button', {
          name: copy.displayName.submit,
        }),
      );
      await waitFor(() => expect(saveStatus(nameSection())).toBe('saving'));

      selectChoice('Color de pelo', 'Rubio');
      fireEvent.click(screen.getByRole('button', { name: copy.avatar.submit }));
      await waitFor(() => expect(saveStatus(avatarSection())).toBe('saving'));

      await view.session.controller.logout();
      releaseProfile();
      releaseAvatar();
      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(rejections).toEqual([]);
    } finally {
      process.off('unhandledRejection', onUnhandled);
    }
  });
});
