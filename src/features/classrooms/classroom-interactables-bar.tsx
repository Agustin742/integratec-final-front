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

export interface ClassroomInteractablesBarProps {
  readonly highlightedId?: string | undefined;
  readonly myDeskIndex: number | null;
  readonly desksStatus?: 'idle' | 'pending' | 'ready' | 'error';
  readonly petName?: string | null | undefined;
  readonly feedback: InteractableFeedback | null;
  readonly canOpenPanel: (key: string) => boolean;
  readonly onFocusInteractable: (id: string | undefined) => void;
  readonly onActivateInteractable: (
    interactable: ClassroomInteractable | null,
    invoker?: HTMLElement,
  ) => void;
}

interface QuickChipItem {
  readonly key: string;
  readonly label: string;
  readonly iconType: ClassroomInteractableType;
  readonly targetId: string | undefined;
  readonly interactable: ClassroomInteractable | null;
  readonly available: boolean;
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

/**
 * Contextual HUD & accessible keyboard/touch bar living outside the WebGL
 * canvas (`rules/3d-world-and-camera.md`, `rules/ui-and-accessibility.md`).
 */
export function ClassroomInteractablesBar({
  highlightedId,
  myDeskIndex,
  desksStatus = 'ready',
  petName,
  feedback,
  canOpenPanel,
  onFocusInteractable,
  onActivateInteractable,
}: ClassroomInteractablesBarProps) {
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

  const chips = useMemo<QuickChipItem[]>(() => {
    const ownDeskTargetId =
      myDeskIndex !== null ? `student-desk:${myDeskIndex}` : undefined;
    const ownDesk3D = ownDeskTargetId ? byId.get(ownDeskTargetId) : undefined;
    const ownDeskInteractable: ClassroomInteractable | null =
      myDeskIndex !== null
        ? (ownDesk3D ?? {
            id: `student-desk:${myDeskIndex}`,
            type: 'student-desk',
            interactionClass: 'opens_panel',
            panelKey: 'grades',
            deskIndex: myDeskIndex,
            worldPosition: [0, 0, 0],
            footprint: [0, 0],
            beaconHeight: 0,
          })
        : null;

    const deskChipAvailable =
      canOpenPanel('grades') &&
      (myDeskIndex !== null ||
        desksStatus === 'pending' ||
        desksStatus === 'error');

    const deskChip: QuickChipItem = {
      key: 'student-desk',
      label:
        myDeskIndex !== null ? copy.ownDeskTitle(myDeskIndex) : copy.desksTitle,
      iconType: 'student-desk',
      targetId: ownDesk3D ? ownDeskTargetId : undefined,
      interactable: ownDeskInteractable,
      available: deskChipAvailable,
    };

    const panelChip = (
      id:
        | 'board'
        | 'shelf'
        | 'bulletin-board'
        | 'shop'
        | 'tutor-bot'
        | 'teacher-desk',
    ): QuickChipItem => {
      const item = byId.get(id) ?? null;
      return {
        key: id,
        label: copy.labels[id],
        iconType: id,
        targetId: item?.id,
        interactable: item,
        available: item?.panelKey ? canOpenPanel(item.panelKey) : false,
      };
    };

    const petItem = byId.get('pet') ?? null;
    const entranceItem = byId.get('entrance') ?? null;

    const items: QuickChipItem[] = [
      deskChip,
      panelChip('board'),
      panelChip('shelf'),
      panelChip('bulletin-board'),
      panelChip('shop'),
      panelChip('tutor-bot'),
      panelChip('teacher-desk'),
      {
        key: 'pet',
        label: resolvedPetName,
        iconType: 'pet',
        targetId: petItem?.id,
        interactable: petItem,
        available: true,
      },
      {
        key: 'entrance',
        label: copy.labels.entranceShort,
        iconType: 'entrance',
        targetId: entranceItem?.id,
        interactable: entranceItem,
        available: true,
      },
    ];
    return items.filter((chip) => chip.available);
  }, [byId, canOpenPanel, copy, desksStatus, myDeskIndex, resolvedPetName]);

  return (
    <div className="min-w-0 space-y-2.5">
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-xl border border-edge bg-tray/50 px-3.5 py-2.5 text-sm">
        {activeTarget ? (
          <p
            data-testid="classroom-active-target"
            className="flex min-w-0 items-center gap-2 font-medium text-foreground wrap-anywhere"
          >
            <InteractableIcon type={activeTarget.type} />
            <span>
              <strong className="font-semibold">{activeTarget.title}</strong>
              {' — '}
              <span className="text-muted-foreground">{activeTarget.hint}</span>
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
      </div>

      {/* Always-mounted status region so screen readers reliably announce updates. */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        data-testid="classroom-interactable-status"
        className={cn(
          feedback === null
            ? 'sr-only'
            : 'flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-xl border px-3.5 py-2 text-sm font-medium wrap-anywhere',
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
                  'min-h-9 shrink-0',
                )}
              >
                {feedback.retry.label}
              </button>
            )}
          </>
        ) : null}
      </div>

      <nav aria-label={copy.navLabel} className="min-w-0">
        <ul className="flex min-w-0 flex-wrap gap-2">
          {chips.map((chip) => {
            const isHighlighted =
              chip.targetId !== undefined && highlightedId === chip.targetId;
            return (
              <li key={chip.key} className="min-w-0 max-w-full">
                <button
                  type="button"
                  data-interactable-chip={chip.key}
                  onFocus={() => onFocusInteractable(chip.targetId)}
                  onBlur={() => onFocusInteractable(undefined)}
                  onMouseEnter={() => onFocusInteractable(chip.targetId)}
                  onMouseLeave={() => onFocusInteractable(undefined)}
                  onClick={(event) =>
                    onActivateInteractable(
                      chip.interactable,
                      event.currentTarget,
                    )
                  }
                  className={cn(
                    buttonStyles({
                      variant: isHighlighted ? 'secondary' : 'outline',
                      size: 'sm',
                    }),
                    'h-auto min-h-11 max-w-full justify-start gap-2 px-3.5 py-2 text-left whitespace-normal wrap-anywhere',
                    isHighlighted && 'border-primary',
                  )}
                >
                  <InteractableIcon type={chip.iconType} />
                  <span className="min-w-0">{chip.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
