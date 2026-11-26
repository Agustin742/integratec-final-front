import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { expect, test, vi } from 'vitest';
import { fakeSession } from '@/app/router/fake-session';
import { createAppRoutes } from '@/app/router/routes';
import { messages as appMessages } from '@/app/messages';
import { isHairAllowed, isTopAllowed } from '@/features/profile/avatar-options';
import { resolveAccessory } from '@/features/world/avatar/accessory-catalog';
import { SessionProvider } from '@/session/provider';
import { expectAccessible } from '@/test/accessibility';
import { render } from '@/test/render';
import { pitchMessages as copy } from './messages';
import {
  PITCH_AUTONOMY_SWATCHES,
  PITCH_BEATS,
  PITCH_CAST,
  PITCH_FOCUS_SPECS,
  PITCH_SHOP_ITEMS,
} from './pitch-script';

vi.mock('../world/world-canvas', () => ({
  WorldCanvas: ({
    label,
    scopeKey,
    framing,
  }: {
    label: string;
    scopeKey?: string;
    framing?: string;
  }) => (
    <div
      role="region"
      aria-label={label}
      data-scope={scopeKey}
      data-framing={framing}
    />
  ),
}));

async function renderPitchRoute() {
  const { service } = fakeSession({ status: 'unauthenticated' });
  const router = createMemoryRouter(createAppRoutes(), {
    initialEntries: ['/pitch'],
  });
  let view!: ReturnType<typeof render>;
  await act(async () => {
    view = render(
      <SessionProvider service={service}>
        <RouterProvider router={router} />
      </SessionProvider>,
    );
    if (!router.state.initialized) {
      await new Promise<void>((resolve) => {
        const unsubscribe = router.subscribe((state) => {
          if (state.initialized) {
            unsubscribe();
            resolve();
          }
        });
      });
    }
  });
  return { router, ...view };
}

async function renderPitchDeck() {
  const result = await renderPitchRoute();
  fireEvent.click(
    await screen.findByRole('button', { name: copy.intro.start }),
  );
  return result;
}

test('all cast avatars, shop packs, autonomy presets, and equipped accessory codes satisfy the avatar catalog contracts', () => {
  for (const avatar of Object.values(PITCH_CAST)) {
    expect(isHairAllowed(avatar)).toBe(true);
    expect(isTopAllowed(avatar)).toBe(true);
  }

  for (const item of PITCH_SHOP_ITEMS) {
    for (const group of [
      item.equipped,
      item.lucasEquipped,
      item.mateoEquipped,
    ]) {
      for (const [slot, code] of Object.entries(group)) {
        if (!code) continue;
        const spec = resolveAccessory(code);
        expect(spec).not.toBeNull();
        expect(spec?.slot).toBe(slot);
      }
    }
  }

  for (const swatch of PITCH_AUTONOMY_SWATCHES) {
    expect(
      isHairAllowed({
        ...PITCH_CAST.sofia,
        hairId: swatch.sofiaHair,
        topId: swatch.sofiaTop,
      }),
    ).toBe(true);
    expect(
      isTopAllowed({
        ...PITCH_CAST.sofia,
        hairId: swatch.sofiaHair,
        topId: swatch.sofiaTop,
      }),
    ).toBe(true);
    expect(
      isHairAllowed({
        ...PITCH_CAST.docente,
        hairId: swatch.docenteHair,
        topId: swatch.docenteTop,
      }),
    ).toBe(true);
    expect(
      isTopAllowed({
        ...PITCH_CAST.docente,
        hairId: swatch.docenteHair,
        topId: swatch.docenteTop,
      }),
    ).toBe(true);

    for (const group of [
      swatch.sofiaEquipped,
      swatch.lucasEquipped,
      swatch.mateoEquipped,
      swatch.docenteEquipped,
    ]) {
      for (const [slot, code] of Object.entries(group)) {
        if (!code) continue;
        const spec = resolveAccessory(code);
        expect(spec).not.toBeNull();
        expect(spec?.slot).toBe(slot);
      }
    }
  }

  for (const beat of PITCH_BEATS) {
    for (const actor of Object.values(beat.actors)) {
      if (!actor?.equipped) continue;
      for (const [slot, code] of Object.entries(actor.equipped)) {
        if (!code) continue;
        const spec = resolveAccessory(code);
        expect(spec).not.toBeNull();
        expect(spec?.slot).toBe(slot);
      }
    }
  }
});

test('opens on a branded intro screen before Meet and starts the deck on demand', async () => {
  const { container } = await renderPitchRoute();

  expect(
    await screen.findByRole('heading', { level: 1, name: copy.intro.title }),
  ).toBeVisible();
  expect(screen.getByText(copy.intro.tagline)).toBeVisible();
  expect(
    screen.queryByRole('region', { name: copy.canvasLabel }),
  ).not.toBeInTheDocument();
  await expectAccessible(container);

  fireEvent.click(screen.getByRole('button', { name: copy.intro.start }));
  expect(screen.getByRole('region', { name: copy.canvasLabel })).toBeVisible();
  expect(screen.getByText('01 / 17')).toBeVisible();
});

test('automatically tours close-up views once without rendering a transition menu bar', async () => {
  await renderPitchDeck();
  const zonesIndex = PITCH_BEATS.findIndex((beat) => beat.id === '2.2');
  fireEvent.keyDown(window, { key: '2' });
  const actTwoStart = PITCH_BEATS.findIndex((beat) => beat.act === 2);
  for (let i = actTwoStart; i < zonesIndex; i += 1) {
    fireEvent.keyDown(window, { key: 'ArrowRight' });
  }

  expect(screen.queryByText(copy.focus.badge)).not.toBeInTheDocument();
  expect(screen.getByRole('note')).toHaveTextContent(
    PITCH_FOCUS_SPECS.board.purpose,
  );

  fireEvent.keyDown(window, { key: 'Escape' });
  expect(screen.queryByRole('note')).not.toBeInTheDocument();

  // Advancing to Beat 2.3 (no repeated focus tour) keeps note hidden
  fireEvent.keyDown(window, { key: 'ArrowRight' });
  expect(screen.queryByRole('note')).not.toBeInTheDocument();
});

test('renders opaque Meet screen with minimal scroll-only chrome and advances across beats', async () => {
  const { container } = await renderPitchDeck();

  const heading = await screen.findByRole('heading', {
    level: 1,
    name: copy.deckHeading,
  });
  expect(heading).toBeInTheDocument();
  await waitFor(() =>
    expect(document.title).toBe(`${copy.pageTitle} · ${appMessages.title}`),
  );

  const stage = screen.getByRole('region', { name: copy.canvasLabel });
  expect(stage).toHaveAttribute('data-scope', 'pitch-deck');
  expect(stage).toHaveAttribute('data-framing', 'follow');
  expect(screen.getByText('01 / 17')).toBeVisible();
  expect(screen.getByText(copy.chapters.hook)).toBeVisible();
  expect(screen.getByText(copy.meetStatuses.handRaised)).toBeVisible();
  await expectAccessible(container);

  // Scroll wheel forward & backward
  const main = screen.getByRole('main');
  const nowSpy = vi.spyOn(performance, 'now').mockReturnValue(1000);
  fireEvent.wheel(main, { deltaY: 120 });
  expect(screen.getByText('02 / 17')).toBeVisible();
  expect(screen.getByText(copy.chapters.problem)).toBeVisible();

  nowSpy.mockReturnValue(2000);
  fireEvent.wheel(main, { deltaY: -120 });
  expect(screen.getByText('01 / 17')).toBeVisible();
  nowSpy.mockRestore();

  // Click stage and keyboard arrows through Act 1 -> "Break the Grid"
  fireEvent.click(
    screen.getByRole('button', { name: copy.controls.advanceStage }),
  );
  expect(screen.getByText('02 / 17')).toBeVisible();

  fireEvent.keyDown(window, { key: 'ArrowRight' });
  expect(screen.getByText('03 / 17')).toBeVisible();

  fireEvent.keyDown(window, { key: 'ArrowDown' });
  expect(screen.getByText('04 / 17')).toBeVisible();
  expect(
    screen.getByRole('heading', {
      level: 2,
      name: 'Les presentamos Bankito',
    }),
  ).toBeVisible();
  expect(screen.getByText('¡Volvimos al aula!')).toBeVisible();

  fireEvent.keyDown(window, { key: 'ArrowLeft' });
  expect(screen.getByText('03 / 17')).toBeVisible();
});

test('displays overhead character dialogues, varied personalization with teacher view, and rapid classroom loading screen before /login', async () => {
  const { container, router } = await renderPitchDeck();
  await screen.findByRole('heading', { level: 1, name: copy.deckHeading });

  // Jump to Act 2 -> Beat 2.1 (overhead conversation bubbles)
  fireEvent.keyDown(window, { key: '2' });
  expect(screen.getByText('05 / 17')).toBeVisible();
  fireEvent.keyDown(window, { key: ' ' });
  expect(screen.getByText('06 / 17')).toBeVisible();
  expect(
    screen.getByText('¡Hola Sofi! ¿Viste la actividad nueva?'),
  ).toBeVisible();
  expect(screen.getByText('¡Hola chicos! Resolvámosla juntos')).toBeVisible();

  // Advance to Beat 2.4 (close-up 360° shop try-on)
  for (let i = 0; i < 3; i++) {
    fireEvent.keyDown(window, { key: ' ' });
  }
  expect(screen.getByText('09 / 17')).toBeVisible();
  const crownBtn = screen.getByRole('button', { name: /Corona y Gorras/ });
  const helmetBtn = screen.getByRole('button', { name: /Casco de astronauta/ });
  expect(helmetBtn).toHaveAttribute('aria-pressed', 'true');
  fireEvent.click(crownBtn);
  expect(crownBtn).toHaveAttribute('aria-pressed', 'true');
  expect(helmetBtn).toHaveAttribute('aria-pressed', 'false');
  await expectAccessible(container);

  // Jump to Act 3 -> Beat 3.1 (Autonomy close-up turntable + student & teacher style variations)
  fireEvent.keyDown(window, { key: '3' });
  fireEvent.keyDown(window, { key: 'ArrowRight' });
  expect(screen.getByText('11 / 17')).toBeVisible();
  const teacherBtn = screen.getByRole('button', { name: 'Vista Docente' });
  fireEvent.click(teacherBtn);
  expect(teacherBtn).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByText(copy.psychology.teacherViewBadge)).toBeVisible();
  await expectAccessible(container);

  // Jump to Act 4 -> Beat 4.2 (closing manifesto + rapid classroom loading screen -> /login)
  fireEvent.keyDown(window, { key: '4' });
  fireEvent.keyDown(window, { key: 'ArrowRight' });
  fireEvent.keyDown(window, { key: 'ArrowRight' });
  expect(screen.getByText('17 / 17')).toBeVisible();
  expect(screen.getByText(copy.closing.manifesto)).toBeVisible();
  await expectAccessible(container);

  fireEvent.click(
    screen.getByRole('button', { name: copy.controls.liveDemoCta }),
  );
  expect(
    await screen.findByRole('heading', { level: 1, name: copy.launch.title }),
  ).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: copy.launch.openNow }));
  await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
});
