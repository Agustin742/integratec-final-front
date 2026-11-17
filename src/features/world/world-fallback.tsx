import { worldMessages } from './messages';

/**
 * Truthful DOM alternative shown when the 3D view is unavailable. The canvas
 * host renders it from its `failed` state, and the showcase page renders it
 * from its lazy-chunk error boundary. Kept free of Three.js imports so page
 * code can import it without pulling the 3D bundle into the main chunk.
 */
export function WorldFallback() {
  return (
    <div
      role="status"
      className="space-y-2 rounded-xl border border-edge bg-card p-5"
    >
      <p className="font-semibold">{worldMessages.unavailable}</p>
      <p>{worldMessages.alternative}</p>
    </div>
  );
}
