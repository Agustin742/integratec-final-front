import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ShopItemPreview } from './shop-item-preview';
import type { ShopCatalogItemDto } from './shop-schema';

const renderGlbThumbnail = vi.hoisted(() => vi.fn());
vi.mock('./item-preview-renderer', () => ({ renderGlbThumbnail }));

function makeItem(overrides: Partial<ShopCatalogItemDto> = {}) {
  return {
    id: 'item-1',
    code: 'cap_blue',
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
    expect(renderGlbThumbnail).toHaveBeenCalledWith(
      '/models/avatars/male/accessory-cap.glb',
      undefined,
    );

    await act(async () => resolve('data:image/png;base64,AAAA'));
    const img = await screen.findByRole('img', {
      name: 'Vista previa de Gorra azul',
    });
    expect(img).toHaveAttribute('src', 'data:image/png;base64,AAAA');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('tints the model with the item color metadata', async () => {
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
      '/models/avatars/male/accessory-cap.glb',
      '#1E3A8A',
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

  it('uses an illustration directly for items without a model', () => {
    render(
      <ShopItemPreview
        item={makeItem({
          kind: 'DESK_UPGRADE',
          code: 'desk_plant',
          name: 'Planta de escritorio',
          metadata: { assetId: 'desk_plant' },
        })}
      />,
    );
    expect(renderGlbThumbnail).not.toHaveBeenCalled();
    expect(
      screen.getByRole('img', { name: 'Ilustración de Planta de escritorio' }),
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
});
