import { useEffect, useState, type RefObject } from 'react';
import { cn } from '@/lib/utils';
import { classroomMessages } from './messages';

export interface ProximityPromptProps {
  /**
   * Positioned wrapper. The world writes its screen anchor to it every frame
   * (see `anchorProximityPrompt`), so following the object costs no re-render.
   */
  readonly anchorRef: RefObject<HTMLDivElement | null>;
  /** Action text such as "Abrir tienda"; undefined hides the prompt. */
  readonly action: string | undefined;
  /** Receives the button so a panel can return focus to it when it closes. */
  readonly onActivate: (invoker: HTMLElement) => void;
}

/** Screen fraction kept free at every edge when DOM layout sizes are zero. */
const EDGE_MARGIN = 0.08;
/** Pixel padding from viewport edges when layout dimensions are measured. */
const EDGE_PADDING_PX = 12;
/** Minimum top clearance in pixels so the floating top bar never covers the prompt. */
const SAFE_TOP_PX = 88;

/** Moves the prompt wrapper to a normalized screen point (0..1, y down). */
export function anchorProximityPrompt(
  element: HTMLElement | null,
  anchor: { readonly x: number; readonly y: number } | null,
): void {
  if (!element || !anchor) return;
  const parent = element.parentElement;
  const parentWidth = parent?.clientWidth ?? 0;
  const parentHeight = parent?.clientHeight ?? 0;
  const width = element.offsetWidth;
  if (parentWidth > 0 && parentHeight > 0 && width > 0) {
    const halfW = width / 2;
    const minLeft = halfW + EDGE_PADDING_PX;
    const maxLeft = parentWidth - halfW - EDGE_PADDING_PX;
    const left =
      minLeft > maxLeft
        ? parentWidth / 2
        : Math.min(Math.max(anchor.x * parentWidth, minLeft), maxLeft);
    const minTop = Math.max(
      element.offsetHeight + EDGE_PADDING_PX,
      SAFE_TOP_PX,
    );
    const maxTop = parentHeight - EDGE_PADDING_PX;
    const top =
      minTop > maxTop
        ? maxTop
        : Math.min(Math.max(anchor.y * parentHeight, minTop), maxTop);
    element.style.left = `${left}px`;
    element.style.top = `${top}px`;
    return;
  }
  const clamp = (value: number) =>
    Math.min(Math.max(value, EDGE_MARGIN), 1 - EDGE_MARGIN);
  element.style.left = `${clamp(anchor.x) * 100}%`;
  element.style.top = `${clamp(anchor.y) * 100}%`;
}

const COARSE_POINTER_QUERY = '(pointer: coarse)';

/** True on touch-first devices, where a keycap hint would mean nothing. */
function useCoarsePointer(): boolean {
  const [coarse, setCoarse] = useState(
    () =>
      typeof window.matchMedia === 'function' &&
      window.matchMedia(COARSE_POINTER_QUERY).matches,
  );
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const query = window.matchMedia(COARSE_POINTER_QUERY);
    const update = () => setCoarse(query.matches);
    update();
    query.addEventListener?.('change', update);
    return () => query.removeEventListener?.('change', update);
  }, []);
  return coarse;
}

/**
 * Floating "E · action" card next to the nearby object, and the polite live
 * region that announces it. The card is a real button, so touch users get the
 * same action as the E key. Static: no motion, so reduced-motion needs nothing.
 */
export function ProximityPrompt({
  anchorRef,
  action,
  onActivate,
}: ProximityPromptProps) {
  const coarse = useCoarsePointer();
  const copy = classroomMessages.proximity;
  return (
    <>
      <div
        ref={anchorRef}
        hidden={action === undefined}
        className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-full pb-3"
      >
        {action !== undefined && (
          <button
            type="button"
            tabIndex={-1}
            data-testid="classroom-proximity-prompt"
            onClick={(event) => onActivate(event.currentTarget)}
            className={cn(
              'pointer-events-auto flex min-h-11 max-w-[calc(100vw-2rem)] min-w-11 items-center gap-2 rounded-2xl border border-edge bg-card/95 px-3 font-display text-sm font-semibold whitespace-nowrap text-card-foreground shadow-panel backdrop-blur-md',
              'motion-press hover:bg-card focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-ring',
            )}
          >
            {!coarse && (
              <kbd className="grid size-7 shrink-0 place-items-center rounded-lg border border-edge bg-primary font-display text-sm font-bold text-primary-foreground shadow-[0_2px_0_var(--key-primary)]">
                {copy.keyLabel}
              </kbd>
            )}
            <span className="truncate">{action}</span>
          </button>
        )}
      </div>
      <p
        role="status"
        aria-live="polite"
        aria-atomic="true"
        data-testid="classroom-proximity-status"
        className="sr-only"
      >
        {action === undefined ? '' : copy.announce(action)}
      </p>
    </>
  );
}
