import { buttonStyles } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { classroomMessages } from './messages';

export interface InteractableFeedback {
  readonly kind: 'info' | 'denied' | 'pet';
  readonly text: string;
  readonly retry?: {
    readonly label: string;
    readonly onClick: () => void;
  };
}

export interface ClassroomWorldHudProps {
  readonly highlightedId?: string | undefined;
  readonly myDeskIndex: number | null;
  readonly feedback: InteractableFeedback | null;
  readonly canOpenPanel: (key: string) => boolean;
  readonly onFocusInteractable: (id: string | undefined) => void;
  /** Opens a classroom panel from a floating button (focus returns to it). */
  readonly onOpenPanel: (key: string, invoker: HTMLElement) => void;
}

type FloatingPanelKey =
  | 'activities'
  | 'material'
  | 'grades'
  | 'notices'
  | 'members'
  | 'bot'
  | 'shop'
  | 'settings';

interface FloatingPanelItem {
  readonly key: FloatingPanelKey;
  /** Interactable highlighted in the world while this button is focused. */
  readonly targetId: string | undefined;
}

const ICON_PATHS: Record<FloatingPanelKey, readonly string[]> = {
  activities: ['M2 4h20v13H2z', 'M8 21h8M12 17v4'],
  material: ['M4 3h16v18H4z', 'M4 9h16M4 15h16M9 6v3M14 12v3'],
  grades: ['M5 4h14v16H5z', 'M9 9l1.5 1.5L14 7M9 15h6'],
  notices: ['M3 4h18v16H3z', 'M7 9h4v4H7zM14 9h3M14 13h3'],
  members: ['M2 7h20v4H2z', 'M4 11v8M20 11v8M14 11v5h6'],
  bot: ['M5 7h14v11H5z', 'M12 3v4M9 12h.01M15 12h.01M9 15h6'],
  settings: ['M3 6h18M3 12h18M3 18h18', 'M9 4v4M15 10v4M7 16v4'],
  shop: [
    'M4 10h16v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-9Z',
    'M3 10l1.5-5h15L21 10M9 10v2a3 3 0 0 0 6 0v-2',
  ],
};

function PanelIcon({ panel }: { readonly panel: FloatingPanelKey }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-5 shrink-0"
      aria-hidden="true"
      focusable="false"
    >
      {ICON_PATHS[panel].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}

const LEFT_PANELS: readonly FloatingPanelItem[] = [
  { key: 'activities', targetId: 'board' },
  { key: 'material', targetId: 'shelf' },
  { key: 'grades', targetId: undefined },
  { key: 'notices', targetId: 'bulletin-board' },
];

const RIGHT_PANELS: readonly FloatingPanelItem[] = [
  { key: 'members', targetId: 'teacher-desk' },
  { key: 'bot', targetId: 'tutor-bot' },
  { key: 'shop', targetId: 'shop' },
  { key: 'settings', targetId: undefined },
];

// Each panel button is its own floating card, so it reads as a button at rest.
const PANEL_BUTTON_CLASS =
  'motion-press pointer-events-auto flex min-h-11 min-w-11 items-center gap-2 rounded-2xl border border-edge bg-card/85 px-3 font-display text-sm font-semibold text-card-foreground shadow-panel backdrop-blur-md hover:bg-card focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-ring max-sm:justify-center max-sm:px-0 sm:min-w-36';

/**
 * Floating HUD over the full-screen 3D world (`#128`): two vertical groups of
 * standalone panel buttons (left = work, right = community) plus the live
 * feedback region. Chat is reached through the global chat dock and the pet is
 * decorative, so neither has a button. The HUD lives outside the WebGL canvas
 * so it stays keyboard and touch reachable (`rules/3d-world-and-camera.md`,
 * `rules/ui-and-accessibility.md`). The overlay is click-through; only the
 * cards take pointer events.
 */
export function ClassroomWorldHud({
  highlightedId,
  myDeskIndex,
  feedback,
  canOpenPanel,
  onFocusInteractable,
  onOpenPanel,
}: ClassroomWorldHudProps) {
  const renderGroup = (
    items: readonly FloatingPanelItem[],
    label: string,
    side: 'left' | 'right',
  ) => {
    const visible = items
      .map((item) => ({
        ...item,
        targetId:
          item.key === 'grades'
            ? myDeskIndex !== null
              ? `student-desk:${myDeskIndex}`
              : undefined
            : item.targetId,
      }))
      .filter((item) => canOpenPanel(item.key));
    if (visible.length === 0) return null;
    return (
      <nav
        aria-label={label}
        data-testid={`classroom-3d-panels-${side}`}
        className={cn(
          'pointer-events-none absolute top-1/2 mt-10 -translate-y-1/2',
          side === 'left' ? 'left-3 sm:left-4' : 'right-3 sm:right-4',
        )}
      >
        <ul className="flex flex-col gap-3">
          {visible.map((item) => {
            const isHighlighted =
              item.targetId !== undefined && highlightedId === item.targetId;
            return (
              <li key={item.key}>
                <button
                  type="button"
                  data-interactable-chip={item.key}
                  onFocus={() => onFocusInteractable(item.targetId)}
                  onBlur={() => onFocusInteractable(undefined)}
                  onMouseEnter={() => onFocusInteractable(item.targetId)}
                  onMouseLeave={() => onFocusInteractable(undefined)}
                  onClick={(event) =>
                    onOpenPanel(item.key, event.currentTarget)
                  }
                  className={cn(
                    PANEL_BUTTON_CLASS,
                    isHighlighted && 'border-primary bg-card',
                  )}
                >
                  <PanelIcon panel={item.key} />
                  <span className="max-sm:sr-only">
                    {classroomMessages.panels[item.key]}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
    );
  };

  return (
    <>
      {renderGroup(
        LEFT_PANELS,
        classroomMessages.viewMode.immersive.workPanelsLabel,
        'left',
      )}
      {renderGroup(
        RIGHT_PANELS,
        classroomMessages.viewMode.immersive.communityPanelsLabel,
        'right',
      )}

      {/* Bottom-center, clear of the presence pill (left) and the chat dock
          (right). Always-mounted so screen readers reliably announce
          updates; it only shows a card while there is feedback. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-20 flex justify-center px-3 sm:bottom-4 sm:px-44">
        <div
          role="status"
          aria-live="polite"
          aria-atomic="true"
          data-testid="classroom-interactable-status"
          className={cn(
            feedback === null
              ? 'sr-only'
              : 'pointer-events-auto flex min-w-0 max-w-xl flex-wrap items-center justify-between gap-2 rounded-2xl border px-3.5 py-2 text-sm font-medium shadow-panel wrap-anywhere',
            feedback?.kind === 'denied' &&
              'border-warning-edge bg-warning text-warning-foreground',
            (feedback?.kind === 'pet' || feedback?.kind === 'info') &&
              'border-info-edge bg-info text-info-foreground',
          )}
        >
          {feedback ? (
            <>
              <span className="min-w-0">{feedback.text}</span>
              {feedback.retry && (
                <button
                  type="button"
                  onClick={feedback.retry.onClick}
                  className={cn(
                    buttonStyles({ variant: 'outline', size: 'sm' }),
                    'min-h-11 shrink-0',
                  )}
                >
                  {feedback.retry.label}
                </button>
              )}
            </>
          ) : null}
        </div>
      </div>
    </>
  );
}
