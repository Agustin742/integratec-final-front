import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AvatarThumbnail, ShopItemPreview } from './shop-item-preview';
import type { ShopCatalogItemDto } from './shop-schema';

const { renderGlbThumbnail, renderWornThumbnail } = vi.hoisted(() => ({
  renderGlbThumbnail: vi.fn(),
  renderWornThumbnail: vi.fn(),
}));
vi.mock('./item-preview-renderer', () => ({
  renderGlbThumbnail,
  renderWornThumbnail,
}));

function makeItem(overrides: Partial<ShopCatalogItemDto> = {}) {
  return {
    id: 'item-1',
    code: 'head_cap',
    name: 'Gorra azul',
    description: '',
    kind: 'AVATAR_ACCESSORY',
    price: 50,
    isImplemented: true,
    isPurchasable: true,
    ownedByStudent: false,
    ownedByClassroom: false,
    metadata: { slot: 'head', assetId: 'cap' },
    createdAt: '2026-11-18T10:00:00.000Z',
    ...overrides,
  } satisfies ShopCatalogItemDto;
}

describe('ShopItemPreview', () => {
  beforeEach(() => {
    renderGlbThumbnail.mockReset();
    renderWornThumbnail.mockReset();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows a skeleton while loading and then the rendered thumbnail', async () => {
    let resolve!: (value: string) => void;
    renderGlbThumbnail.mockReturnValue(
      new Promise<string>((r) => {
        resolve = r;
      }),
    );
    render(<ShopItemPreview item={makeItem()} />);

    expect(screen.getByRole('status')).toHaveTextContent(
      'Cargando vista previa',
    );
    await waitFor(() =>
      expect(renderGlbThumbnail).toHaveBeenCalledWith(
        '/models/avatars/shared/head-cap.glb',
        '#75B7DA',
      ),
    );

    await act(async () => resolve('data:image/png;base64,AAAA'));
    const img = await screen.findByRole('img', {
      name: 'Vista previa de Gorra azul',
    });
    expect(img).toHaveAttribute('src', 'data:image/png;base64,AAAA');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('tints the model with the color the avatar wears', async () => {
    renderGlbThumbnail.mockResolvedValue('data:image/png;base64,CCCC');
    render(
      <ShopItemPreview
        item={makeItem({
          metadata: { slot: 'head', assetId: 'cap', color: '#1E3A8A' },
        })}
      />,
    );
    await screen.findByRole('img', { name: 'Vista previa de Gorra azul' });
    expect(renderGlbThumbnail).toHaveBeenCalledWith(
      '/models/avatars/shared/head-cap.glb',
      '#75B7DA',
    );
  });

  it('falls back to the category illustration when the render fails', async () => {
    renderGlbThumbnail.mockRejectedValue(new Error('no webgl'));
    render(<ShopItemPreview item={makeItem()} />);

    await waitFor(() =>
      expect(screen.queryByRole('status')).not.toBeInTheDocument(),
    );
    expect(
      screen.getByRole('img', { name: 'Ilustración de Gorra azul' }),
    ).toBeInTheDocument();
  });

  it('renders the model of a desk decor item', async () => {
    renderGlbThumbnail.mockResolvedValue('data:image/png;base64,DDDD');
    render(
      <ShopItemPreview
        item={makeItem({
          kind: 'DESK_UPGRADE',
          code: 'desk_plant',
          name: 'Planta de escritorio',
          metadata: { assetId: 'plant', slot: 'desk_decor' },
        })}
      />,
    );
    await screen.findByRole('img', {
      name: 'Vista previa de Planta de escritorio',
    });
    expect(renderGlbThumbnail).toHaveBeenCalledWith(
      '/models/scenes/classroom/desk-decor/plant.glb',
      undefined,
    );
  });

  it('renders a style item worn by the preview body', async () => {
    renderWornThumbnail.mockResolvedValue('data:image/png;base64,EEEE');
    render(
      <ShopItemPreview
        item={makeItem({
          kind: 'AVATAR_STYLE',
          code: 'top_vest',
          name: 'Chaleco',
          metadata: { styleType: 'top', styleId: 'vest' },
        })}
      />,
    );
    await screen.findByRole('img', { name: 'Vista previa de Chaleco' });
    expect(renderWornThumbnail).toHaveBeenCalledWith({
      type: 'worn',
      part: 'top',
      url: '/models/avatars/male/top-vest.glb',
      bodyUrl: '/models/avatars/male/body.glb',
      tint: '#5B4F96',
    });
  });

  it('draws a non-empty illustration when a style render fails', async () => {
    renderWornThumbnail.mockRejectedValue(new Error('no webgl'));
    render(
      <ShopItemPreview
        item={makeItem({ kind: 'AVATAR_STYLE', code: 'hair_braid' })}
      />,
    );
    const illustration = await screen.findByRole('img', {
      name: 'Ilustración de Gorra azul',
    });
    expect(illustration).not.toBeEmptyDOMElement();
  });

  it('exposes the same thumbnail by style id and body', async () => {
    renderWornThumbnail.mockResolvedValue('data:image/png;base64,FFFF');
    render(
      <AvatarThumbnail
        item={{ type: 'hair', id: 'braid' }}
        bodyId="female"
        name="Trenza"
      />,
    );
    await screen.findByRole('img', { name: 'Vista previa de Trenza' });
    expect(renderWornThumbnail).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/models/avatars/shared/hair-braid.glb',
        bodyUrl: '/models/avatars/female/body.glb',
      }),
    );
  });

  it('uses an illustration directly for items without a model', () => {
    render(
      <ShopItemPreview
        item={makeItem({
          kind: 'DESK_UPGRADE',
          code: 'desk_mystery',
          name: 'Adorno de escritorio',
          metadata: {},
        })}
      />,
    );
    expect(renderGlbThumbnail).not.toHaveBeenCalled();
    expect(
      screen.getByRole('img', { name: 'Ilustración de Adorno de escritorio' }),
    ).toBeInTheDocument();
  });

  it('waits until the card scrolls into view before rendering', async () => {
    let trigger: ((entries: { isIntersecting: boolean }[]) => void) | null =
      null;
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(cb: (entries: { isIntersecting: boolean }[]) => void) {
          trigger = cb;
        }
        observe() {}
        disconnect() {}
      },
    );
    renderGlbThumbnail.mockResolvedValue('data:image/png;base64,BBBB');
    render(<ShopItemPreview item={makeItem()} />);

    expect(renderGlbThumbnail).not.toHaveBeenCalled();
    act(() => trigger?.([{ isIntersecting: true }]));
    await screen.findByRole('img', { name: 'Vista previa de Gorra azul' });
    expect(renderGlbThumbnail).toHaveBeenCalledTimes(1);
  });

  it('resets rendered thumbnail immediately when item model or tint changes', async () => {
    renderGlbThumbnail.mockResolvedValueOnce('data:image/png;base64,FIRST');
    let resolveSecond!: (value: string) => void;
    renderGlbThumbnail.mockReturnValueOnce(
      new Promise<string>((r) => {
        resolveSecond = r;
      }),
    );

    const { rerender } = render(<ShopItemPreview item={makeItem()} />);
    expect(
      await screen.findByRole('img', { name: 'Vista previa de Gorra azul' }),
    ).toHaveAttribute('src', 'data:image/png;base64,FIRST');

    rerender(
      <ShopItemPreview
        item={makeItem({
          id: 'item-2',
          name: 'Gorra roja',
          code: 'head_beanie',
        })}
      />,
    );
    expect(screen.getByRole('status')).toHaveTextContent(
      'Cargando vista previa',
    );
    expect(
      screen.queryByRole('img', { name: /Vista previa/ }),
    ).not.toBeInTheDocument();

    await act(async () => resolveSecond('data:image/png;base64,SECOND'));
    expect(
      await screen.findByRole('img', { name: 'Vista previa de Gorra roja' }),
    ).toHaveAttribute('src', 'data:image/png;base64,SECOND');
  });
});
