import { layoutMessages } from './messages';

export type SkipLinkProps = {
  /** Id of the `main` landmark the link jumps to. */
  targetId: string;
  /** Moves focus to the landmark: a hash jump alone does not on every browser. */
  onActivate?: () => void;
};

/** First tab stop of a page: visually hidden until it receives focus. */
export function SkipLink({ targetId, onActivate }: SkipLinkProps) {
  return (
    <a
      href={`#${targetId}`}
      onClick={onActivate}
      className="sr-only z-50 rounded-xl bg-primary px-4 py-2 font-display text-primary-foreground focus:not-sr-only focus:fixed focus:top-4 focus:left-4"
    >
      {layoutMessages.skipToContent}
    </a>
  );
}
