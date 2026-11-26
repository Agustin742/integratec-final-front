import { act, render, screen } from '@testing-library/react';
import { Suspense, use, type ReactNode } from 'react';
import { expect, test, vi } from 'vitest';
import type { AvatarModelProps } from '@/features/world';
import type { Avatar } from './avatar-options';
import { AvatarPreview3D } from './avatar-preview-3d';

const files = vi.hoisted(() => ({
  pending: new Map<string, Promise<void>>(),
}));

// Stands in for the model's own Suspense boundary: a worn accessory whose file
// is still downloading suspends the whole body behind the placeholder.
vi.mock('@/features/world', () => {
  function Body({ head }: { readonly head: string }) {
    const file = files.pending.get(head);
    if (file) use(file);
    return <p>{`wearing ${head}`}</p>;
  }
  return {
    WorldCanvas: ({ children }: { readonly children: ReactNode }) => children,
    WarmLighting: () => null,
    AvatarModel: ({ equipped }: AvatarModelProps) => (
      <Suspense fallback={<p>placeholder</p>}>
        <Body head={equipped?.head ?? 'nothing'} />
      </Suspense>
    ),
  };
});

const avatar: Avatar = {
  bodyId: 'female',
  hairId: 'afro',
  topId: 'basic-tshirt',
  hairColor: '#AF6D63',
  clothingColor: '#75B7DA',
};

test('keeps the worn avatar on screen while a new accessory file loads', async () => {
  let finishDownload = () => {};
  files.pending.set(
    'crown',
    new Promise<void>((resolve) => {
      finishDownload = resolve;
    }),
  );
  const preview = (head: string | null) => (
    <AvatarPreview3D
      avatar={avatar}
      equipped={{ head }}
      onUnavailable={() => {}}
      onBodyError={() => {}}
    />
  );
  const { rerender } = render(preview(null));

  await act(async () => rerender(preview('crown')));
  expect(screen.getByText('wearing nothing')).toBeVisible();
  expect(screen.queryByText('placeholder')).not.toBeInTheDocument();

  await act(async () => {
    files.pending.delete('crown');
    finishDownload();
  });
  expect(await screen.findByText('wearing crown')).toBeVisible();
});
