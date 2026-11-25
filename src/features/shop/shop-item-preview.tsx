import { useEffect, useRef, useState, type ReactElement } from 'react';
import { cn } from '@/lib/utils';
import { resolveItemPreview } from './item-preview-source';
import { shopMessages } from './messages';
import type { ShopCatalogItemDto, ShopItemKind } from './shop-schema';

type PreviewItem = Pick<
  ShopCatalogItemDto,
  'kind' | 'code' | 'name' | 'metadata'
>;

type PreviewState =
  | { readonly status: 'idle' }
  | { readonly status: 'ready'; readonly src: string }
  | { readonly status: 'failed' };

const STROKE = 'var(--palette-ink)';

/** Flat category illustrations on palette colors: the last-resort preview. */
function KindIllustration({ kind }: { readonly kind: ShopItemKind }) {
  switch (kind) {
    case 'AVATAR_ACCESSORY':
      return (
        <>
          <circle cx="32" cy="24" r="11" fill="var(--palette-sand)" />
          <path
            d="M18 52c0-9 6-15 14-15s14 6 14 15"
            fill="var(--palette-lavender)"
          />
          <path
            d="M20 20c2-9 22-9 24 0"
            fill="var(--palette-coral)"
            stroke={STROKE}
            strokeWidth="2"
          />
        </>
      );
    case 'DESK_UPGRADE':
      return (
        <>
          <rect
            x="8"
            y="30"
            width="48"
            height="8"
            rx="2"
            fill="var(--palette-wood)"
          />
          <rect
            x="12"
            y="38"
            width="4"
            height="16"
            fill="var(--palette-wood)"
          />
          <rect
            x="48"
            y="38"
            width="4"
            height="16"
            fill="var(--palette-wood)"
          />
          <path
            d="M30 30c-6-4-6-14 2-18 8 4 8 14 2 18z"
            fill="var(--palette-leaf)"
          />
        </>
      );
    case 'CLASSROOM_ITEM':
      return (
        <>
          <rect
            x="8"
            y="12"
            width="48"
            height="32"
            rx="4"
            fill="var(--palette-green)"
            stroke="var(--palette-wood)"
            strokeWidth="4"
          />
          <path
            d="M16 36l10-10 8 6 12-12"
            fill="none"
            stroke="var(--palette-creamPale)"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <rect
            x="14"
            y="48"
            width="36"
            height="4"
            rx="2"
            fill="var(--palette-wood)"
          />
        </>
      );
    case 'PET_ACCESSORY':
      return (
        <>
          <circle cx="32" cy="30" r="16" fill="var(--palette-butter)" />
          <circle cx="26" cy="28" r="2" fill={STROKE} />
          <circle cx="38" cy="28" r="2" fill={STROKE} />
          <path
            d="M18 44c8 6 20 6 28 0"
            fill="none"
            stroke="var(--palette-coral)"
            strokeWidth="6"
            strokeLinecap="round"
          />
        </>
      );
  }
}

function Illustration({
  item,
  className,
}: {
  readonly item: PreviewItem;
  readonly className?: string;
}): ReactElement {
  return (
    <svg
      role="img"
      aria-label={shopMessages.preview.illustrationAlt(item.name)}
      viewBox="0 0 64 64"
      className={cn('size-2/3', className)}
    >
      <KindIllustration kind={item.kind} />
    </svg>
  );
}

export interface ShopItemPreviewProps {
  readonly item: PreviewItem;
  readonly className?: string;
}

/**
 * Square preview of what a shop item actually is. Avatar accessories and desk
 * decor render their real GLB once into a static `<img>` (single shared
 * offscreen renderer, lazily, only when the card is near the viewport); other
 * kinds and render failures show a category illustration.
 */
export function ShopItemPreview({ item, className }: ShopItemPreviewProps) {
  const source = resolveItemPreview(item);
  const glbUrl = source.type === 'glb' ? source.url : null;
  const tint = source.type === 'glb' ? source.tint : undefined;
  const hostRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(
    () => typeof IntersectionObserver === 'undefined',
  );
  const previewKey = glbUrl === null ? null : `${glbUrl}|${tint ?? ''}`;
  const [rendered, setRendered] = useState<
    | { readonly key: string; readonly status: 'ready'; readonly src: string }
    | { readonly key: string; readonly status: 'failed' }
    | null
  >(null);

  useEffect(() => {
    if (glbUrl === null || visible) return;
    const host = hostRef.current;
    if (host === null) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '120px' },
    );
    observer.observe(host);
    return () => observer.disconnect();
  }, [glbUrl, visible]);

  useEffect(() => {
    if (glbUrl === null || previewKey === null || !visible) return;
    let cancelled = false;
    import('./item-preview-renderer')
      .then(({ renderGlbThumbnail }) => renderGlbThumbnail(glbUrl, tint))
      .then(
        (src) => {
          if (!cancelled) {
            setRendered({ key: previewKey, status: 'ready', src });
          }
        },
        () => {
          if (!cancelled) {
            setRendered({ key: previewKey, status: 'failed' });
          }
        },
      );
    return () => {
      cancelled = true;
    };
  }, [glbUrl, previewKey, tint, visible]);

  const state: PreviewState =
    previewKey !== null && rendered?.key === previewKey
      ? rendered.status === 'ready'
        ? { status: 'ready', src: rendered.src }
        : { status: 'failed' }
      : { status: 'idle' };

  return (
    <div
      ref={hostRef}
      className={cn(
        'relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-xl bg-tray shadow-inset',
        className,
      )}
    >
      {glbUrl === null || state.status === 'failed' ? (
        <Illustration item={item} />
      ) : state.status === 'ready' ? (
        <img
          src={state.src}
          alt={shopMessages.preview.alt(item.name)}
          width={256}
          height={256}
          decoding="async"
          className="size-full object-contain p-2"
        />
      ) : (
        <div
          role="status"
          className="size-full animate-shimmer bg-[linear-gradient(90deg,var(--tray)_30%,var(--tray-hover)_50%,var(--tray)_70%)] bg-[length:200%_100%] motion-reduce:animate-none"
        >
          <span className="sr-only">{shopMessages.preview.loading}</span>
        </div>
      )}
    </div>
  );
}
