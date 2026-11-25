import { useCallback, useEffect, useState } from 'react';

/** Longest exit animation (`--motion-duration-base`) plus a small margin. */
const EXIT_FALLBACK_MS = 260;

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

function prefersReducedMotion(): boolean {
  try {
    return (
      typeof window.matchMedia === 'function' &&
      window.matchMedia(REDUCED_MOTION_QUERY).matches
    );
  } catch {
    return false;
  }
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(prefersReducedMotion);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const query = window.matchMedia(REDUCED_MOTION_QUERY);
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener?.('change', update);
    return () => query.removeEventListener?.('change', update);
  }, []);

  return reduced;
}

/**
 * Keeps a panel mounted while its exit animation runs.
 *
 * `open` flips immediately (state and `aria-expanded` never lag); `mounted`
 * stays true until the exit animation ends. Without `matchMedia` (tests,
 * old browsers) or under `prefers-reduced-motion` there is no animation and
 * the panel unmounts at once: `animated` is false so no animation class is
 * applied.
 */
export function useDockPresence(open: boolean) {
  const [exited, setExited] = useState(!open);
  const reducedMotion = usePrefersReducedMotion();
  const animated =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    !reducedMotion;

  // Reopening cancels a finished exit (state adjusted during render).
  if (open && exited) {
    setExited(false);
  }

  const finish = useCallback(() => {
    setExited(true);
  }, []);

  useEffect(() => {
    if (open || !animated) return;
    // Safety net when `animationend` never fires (hidden tab, no animation).
    const timer = setTimeout(finish, EXIT_FALLBACK_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [open, animated, finish]);

  return {
    // Derived synchronously so a reduced-motion close never paints one more frame.
    mounted: open || (animated && !exited),
    animated,
    onAnimationEnd: open ? undefined : finish,
  };
}
