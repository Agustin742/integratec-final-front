import { useMemo } from 'react';
import { buttonStyles } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { CLASSROOM_LAYOUT } from '@/realtime';
import {
  deriveClassroomInteractables,
  indexClassroomInteractables,
  type ClassroomInteractable,
  type ClassroomInteractableType,
} from '../world/classroom/classroom-interactables';
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
  readonly petName?: string | null | undefined;
  readonly feedback: InteractableFeedback | null;
  readonly canOpenPanel: (key: string) => boolean;
  readonly onFocusInteractable: (id: string | undefined) => void;
  readonly onActivateInteractable: (
    interactable: ClassroomInteractable | null,
    invoker?: HTMLElement,
  ) => void;
  /** Opens a classroom panel from a floating button (focus returns to it). */
  readonly onOpenPanel: (key: string, invoker: HTMLElement) => void;
}

function InteractableIcon({
  type,
}: {
  readonly type: ClassroomInteractableType;
}) {
  const props = {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    className: 'size-4 shrink-0',
    'aria-hidden': true as const,
    focusable: false as const,
  };

  switch (type) {
    case 'student-desk':
      return (
        <svg {...props}>
          <rect x="3" y="6" width="18" height="4" rx="1" />
          <path d="M5 10v9M19 10v9M8 14h8" />
        </svg>
      );
    case 'board':
      return (
        <svg {...props}>
          <rect x="2" y="4" width="20" height="13" rx="2" />
          <path d="M8 21h8M12 17v4" />
        </svg>
      );
    case 'shelf':
      return (
        <svg {...props}>
          <rect x="4" y="3" width="16" height="18" rx="1.5" />
          <path d="M4 9h16M4 15h16M9 6v3M14 12v3" />
        </svg>
      );
    case 'bulletin-board':
      return (
        <svg {...props}>
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <path d="M7 9h4v4H7zM14 9h3M14 13h3" />
        </svg>
      );
    case 'shop':
      return (
        <svg {...props}>
          <path d="M4 10h16v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-9Z" />
          <path d="M3 10l1.5-5h15L21 10M9 10v2a3 3 0 0 0 6 0v-2" />
        </svg>
      );
    case 'tutor-bot':
      return (
        <svg {...props}>
          <rect x="5" y="7" width="14" height="11" rx="3" />
          <path d="M12 3v4M9 12h.01M15 12h.01M9 15h6" />
        </svg>
      );
    case 'teacher-desk':
      return (
        <svg {...props}>
          <rect x="2" y="7" width="20" height="4" rx="1" />
          <path d="M4 11v8M20 11v8M14 11v5h6" />
        </svg>
      );
    case 'pet':
      return (
        <svg {...props}>
          <path d="M12 19c-3.5 0-6-2.2-6-5.2 0-2.5 1.8-4.5 4.2-4.8L12 7l1.8 2c2.4.3 4.2 2.3 4.2 4.8 0 3-2.5 5.2-6 5.2Z" />
          <circle cx="9.5" cy="13.5" r="0.7" fill="currentColor" />
          <circle cx="14.5" cy="13.5" r="0.7" fill="currentColor" />
        </svg>
      );
    case 'entrance':
      return (
        <svg {...props}>
          <path d="M10 3h7a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-7" />
          <path d="M14 12H4m0 0 4-4m-4 4 4 4" />
        </svg>
      );
  }
}

function describeHighlightedTarget(
  highlightedId: string | undefined,
  myDeskIndex: number | null,
  resolvedPetName: string,
): {
  readonly type: ClassroomInteractableType;
  readonly title: string;
  readonly hint: string;
} | null {
  if (!highlightedId) return null;
  const copy = classroomMessages.interactables;
  const panelTitles = classroomMessages.panels;

  if (highlightedId === 'board') {
    return {
      type: 'board',
      title: copy.labels.board,
      hint: copy.openHint(panelTitles.activities),
    };
  }
  if (highlightedId === 'shelf') {
    return {
      type: 'shelf',
      title: copy.labels.shelf,
      hint: copy.openHint(panelTitles.material),
    };
  }
  if (highlightedId === 'bulletin-board') {
    return {
      type: 'bulletin-board',
      title: copy.labels['bulletin-board'],
      hint: copy.openHint(panelTitles.notices),
    };
  }
  if (highlightedId === 'shop') {
    return {
      type: 'shop',
      title: copy.labels.shop,
      hint: copy.openHint(panelTitles.shop),
    };
  }
  if (highlightedId === 'tutor-bot') {
    return {
      type: 'tutor-bot',
      title: copy.labels['tutor-bot'],
      hint: copy.openHint(panelTitles.bot),
    };
  }
  if (highlightedId === 'teacher-desk') {
    return {
      type: 'teacher-desk',
      title: copy.labels['teacher-desk'],
      hint: copy.openHint(panelTitles.members),
    };
  }
  if (highlightedId === 'pet') {
    return {
      type: 'pet',
      title: resolvedPetName,
      hint: copy.petHint,
    };
  }
  if (highlightedId === 'entrance') {
    return {
      type: 'entrance',
      title: copy.labels.entrance,
      hint: copy.entranceHint,
    };
  }
  if (highlightedId.startsWith('student-desk:')) {
    const parsedIndex = Number(highlightedId.slice('student-desk:'.length));
    const deskIndex =
      Number.isInteger(parsedIndex) && parsedIndex >= 1 ? parsedIndex : 1;
    if (myDeskIndex !== null && deskIndex === myDeskIndex) {
      return {
        type: 'student-desk',
        title: copy.ownDeskTitle(deskIndex),
        hint: copy.openHint(panelTitles.grades),
      };
    }
    return {
      type: 'student-desk',
      title: copy.foreignDeskTitle(deskIndex),
      hint:
        myDeskIndex !== null ? copy.foreignDeskHint : copy.unassignedDeskHint,
    };
  }
  return null;
}

type FloatingPanelKey =
  | 'activities'
  | 'material'
  | 'grades'
  | 'notices'
  | 'chat'
  | 'members'
  | 'bot'
  | 'shop';

interface FloatingPanelItem {
  readonly key: FloatingPanelKey;
  /** Interactable highlighted in the world while this button is focused. */
  readonly targetId: string | undefined;
  readonly icon: ClassroomInteractableType | 'chat' | 'grades';
}

function PanelIcon({ icon }: { readonly icon: FloatingPanelItem['icon'] }) {
  const common = {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    className: 'size-5 shrink-0',
    'aria-hidden': true as const,
    focusable: false as const,
  };
  if (icon === 'chat') {
    return (
      <svg {...common}>
        <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.5A8 8 0 1 1 21 12Z" />
        <path d="M9 11h6M9 14h3" />
      </svg>
    );
  }
  if (icon === 'grades') {
    return (
      <svg {...common}>
        <path d="M5 4h14v16H5z" />
        <path d="M9 9l1.5 1.5L14 7M9 15h6" />
      </svg>
    );
  }
  return <InteractableIcon type={icon} />;
}

const LEFT_PANELS: readonly FloatingPanelItem[] = [
  { key: 'activities', targetId: 'board', icon: 'board' },
  { key: 'material', targetId: 'shelf', icon: 'shelf' },
  { key: 'grades', targetId: undefined, icon: 'grades' },
  { key: 'notices', targetId: 'bulletin-board', icon: 'bulletin-board' },
];

const RIGHT_PANELS: readonly FloatingPanelItem[] = [
  { key: 'chat', targetId: undefined, icon: 'chat' },
  { key: 'members', targetId: 'teacher-desk', icon: 'teacher-desk' },
  { key: 'bot', targetId: 'tutor-bot', icon: 'tutor-bot' },
  { key: 'shop', targetId: 'shop', icon: 'shop' },
];

const SURFACE_CLASS =
  'pointer-events-auto rounded-2xl border border-edge bg-card/85 text-card-foreground shadow-panel backdrop-blur-md';

/**
 * Floating HUD over the full-screen 3D world (`#128`): two vertical groups of
 * panel buttons (left = work, right = community), plus a bottom strip with the
 * active-target hint, the live feedback region and the pet. It lives outside
 * the WebGL canvas so it stays keyboard and touch reachable
 * (`rules/3d-world-and-camera.md`, `rules/ui-and-accessibility.md`). The
 * overlay is click-through; only the cards take pointer events.
 */
export function ClassroomWorldHud({
  highlightedId,
  myDeskIndex,
  petName,
  feedback,
  canOpenPanel,
  onFocusInteractable,
  onActivateInteractable,
  onOpenPanel,
}: ClassroomWorldHudProps) {
  const copy = classroomMessages.interactables;
  const trimmedPetName = petName?.trim() ?? '';
  const resolvedPetName =
    trimmedPetName.length > 0 ? trimmedPetName : copy.petDefaultName;

  const byId = useMemo(
    () =>
      indexClassroomInteractables(
        deriveClassroomInteractables(CLASSROOM_LAYOUT),
      ),
    [],
  );

  const activeTarget = describeHighlightedTarget(
    highlightedId,
    myDeskIndex,
    resolvedPetName,
  );
  const petItem = byId.get('pet') ?? null;

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
          SURFACE_CLASS,
          'absolute top-1/2 mt-10 -translate-y-1/2 p-1.5',
          side === 'left' ? 'left-3 sm:left-4' : 'right-3 sm:right-4',
        )}
      >
        <ul className="flex flex-col gap-1.5">
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
                    buttonStyles({
                      variant: isHighlighted ? 'secondary' : 'ghost',
                      size: 'sm',
                    }),
                    'min-h-11 min-w-11 justify-start gap-2 px-3 max-sm:justify-center max-sm:px-0 sm:min-w-36',
                    isHighlighted && 'border-primary',
                  )}
                >
                  <PanelIcon icon={item.icon} />
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

      <div className="pointer-events-none absolute inset-x-0 bottom-3 flex flex-col items-center gap-2 px-16 sm:bottom-4 sm:px-44">
        {/* Always-mounted status region so screen readers reliably announce updates. */}
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

        <div
          className={cn(
            SURFACE_CLASS,
            'flex min-w-0 max-w-xl items-center gap-2 py-1.5 pr-2 pl-4 text-sm',
          )}
        >
          {activeTarget ? (
            <p
              data-testid="classroom-active-target"
              className="flex min-w-0 items-center gap-2 font-medium text-foreground wrap-anywhere"
            >
              <InteractableIcon type={activeTarget.type} />
              <span>
                <strong className="font-semibold">{activeTarget.title}</strong>
                {' — '}
                <span className="text-muted-foreground">
                  {activeTarget.hint}
                </span>
              </span>
            </p>
          ) : (
            <p
              data-testid="classroom-active-target"
              className="min-w-0 text-muted-foreground wrap-anywhere"
            >
              {copy.defaultPrompt}
            </p>
          )}
          <button
            type="button"
            data-interactable-chip="pet"
            onFocus={() => onFocusInteractable(petItem?.id)}
            onBlur={() => onFocusInteractable(undefined)}
            onMouseEnter={() => onFocusInteractable(petItem?.id)}
            onMouseLeave={() => onFocusInteractable(undefined)}
            onClick={(event) =>
              onActivateInteractable(petItem, event.currentTarget)
            }
            className={cn(
              buttonStyles({ variant: 'ghost', size: 'sm' }),
              'min-h-11 min-w-11 shrink-0 gap-2 px-3 max-sm:justify-center max-sm:px-0',
            )}
          >
            <InteractableIcon type="pet" />
            <span className="max-sm:sr-only">{resolvedPetName}</span>
          </button>
        </div>
      </div>
    </>
  );
}
