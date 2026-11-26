import { useEffect, useRef, useState, type ReactElement } from 'react';
import { cn } from '@/lib/utils';
import type { AvatarBodyId } from '@/features/world/avatar/accessory-catalog';
import {
  resolveAvatarPreview,
  resolveItemPreview,
  type AvatarPreviewRef,
  type ItemPreviewSource,
} from './item-preview-source';
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
    case 'AVATAR_STYLE':
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
  kind,
  name,
}: {
  readonly kind: ShopItemKind;
  readonly name: string;
}): ReactElement {
  return (
    <svg
      role="img"
      aria-label={shopMessages.preview.illustrationAlt(name)}
      viewBox="0 0 64 64"
      className="size-2/3"
    >
      <KindIllustration kind={kind} />
    </svg>
  );
}

interface PreviewImageProps {
  readonly source: ItemPreviewSource;
  /** Illustration shown without a model or when rendering fails. */
  readonly kind: ShopItemKind;
  readonly name: string;
  readonly className?: string | undefined;
}

/**
 * Renders the model once into a static `<img>` (single shared offscreen
 * renderer, lazily, only when near the viewport).
 */
function PreviewImage({ source, kind, name, className }: PreviewImageProps) {
  const previewKey =
    source.type === 'illustration' ? null : JSON.stringify(source);
  const hostRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(
    () => typeof IntersectionObserver === 'undefined',
  );
  const [rendered, setRendered] = useState<
    | { readonly key: string; readonly status: 'ready'; readonly src: string }
    | { readonly key: string; readonly status: 'failed' }
    | null
  >(null);

  useEffect(() => {
    if (previewKey === null || visible) return;
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
  }, [previewKey, visible]);

  useEffect(() => {
    if (previewKey === null || !visible) return;
    let cancelled = false;
    // The key is the serialized source, so the effect only re-runs when what
    // is drawn changes.
    const target = JSON.parse(previewKey) as Exclude<
      ItemPreviewSource,
      { type: 'illustration' }
    >;
    import('./item-preview-renderer')
      .then((renderer) =>
        target.type === 'worn'
          ? renderer.renderWornThumbnail(target)
          : renderer.renderGlbThumbnail(target.url, target.tint),
      )
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
  }, [previewKey, visible]);

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
      {previewKey === null || state.status === 'failed' ? (
        <Illustration kind={kind} name={name} />
      ) : state.status === 'ready' ? (
        <img
          src={state.src}
          alt={shopMessages.preview.alt(name)}
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

export interface ShopItemPreviewProps {
  readonly item: PreviewItem;
  readonly className?: string;
}

/**
 * Square preview of what a shop item actually is: avatar accessories and desk
 * decor alone, hair styles and tops worn by a body; other kinds and render
 * failures show a category illustration.
 */
export function ShopItemPreview({ item, className }: ShopItemPreviewProps) {
  return (
    <PreviewImage
      source={resolveItemPreview(item)}
      kind={item.kind}
      name={item.name}
      className={className}
    />
  );
}

export interface AvatarThumbnailProps {
  readonly item: AvatarPreviewRef;
  readonly bodyId: AvatarBodyId;
  /** Used in the image's accessible name. */
  readonly name: string;
  readonly className?: string;
}

/** The shop's thumbnail for any hair style, top or accessory on a body. */
export function AvatarThumbnail({
  item,
  bodyId,
  name,
  className,
}: AvatarThumbnailProps) {
  return (
    <PreviewImage
      source={resolveAvatarPreview(item, bodyId)}
      kind={item.type === 'accessory' ? 'AVATAR_ACCESSORY' : 'AVATAR_STYLE'}
      name={name}
      className={className}
    />
  );
}
