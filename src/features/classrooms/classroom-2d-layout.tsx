import type { RefObject } from 'react';
import { EmptyState } from '@/components/feedback/states';
import { Button } from '@/components/ui/button';
import { classroomMessages } from './messages';
import {
  useClassroomPanels,
  type PanelDescriptor,
} from './panels/classroom-panels';

export interface Classroom2DLayoutProps {
  readonly panels: readonly PanelDescriptor[];
  readonly headingRef?: RefObject<HTMLHeadingElement | null>;
}

/**
 * Accessible 2D Classic Mode workspace layout (`HU-ESP-003`, `#34`).
 * Mounts zero WebGL/Three.js canvas elements and derives reachable panel
 * controls strictly from server-confirmed `availablePanels` (`canOpenPanel`).
 */
export function Classroom2DLayout({
  panels,
  headingRef,
}: Classroom2DLayoutProps) {
  const { canOpenPanel, openPanel } = useClassroomPanels();
  const visiblePanels = panels.filter((panel) => canOpenPanel(panel.key));

  return (
    <section
      aria-labelledby="classroom-2d-heading"
      className="min-w-0 space-y-4 rounded-2xl border border-edge bg-card p-5 text-card-foreground shadow-panel"
    >
      <div className="min-w-0 space-y-1">
        <h3
          id="classroom-2d-heading"
          ref={headingRef}
          tabIndex={-1}
          className="font-display text-lg font-semibold text-foreground outline-none"
        >
          {classroomMessages.viewMode.mode2dHeading}
        </h3>
        <p className="max-w-prose text-sm text-pretty text-muted-foreground">
          {classroomMessages.viewMode.mode2dDescription}
        </p>
      </div>

      {visiblePanels.length === 0 ? (
        <EmptyState
          headingLevel="h4"
          title={classroomMessages.viewMode.mode2dEmptyTitle}
          description={classroomMessages.viewMode.mode2dEmptyDescription}
        />
      ) : (
        <nav aria-label={classroomMessages.viewMode.mode2dNavLabel}>
          <ul className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {visiblePanels.map((panel) => (
              <li key={panel.key} className="min-w-0">
                <Button
                  type="button"
                  variant="outline"
                  className="h-auto min-h-11 w-full justify-between px-4 py-3 text-left"
                  onClick={(event) => openPanel(panel.key, event.currentTarget)}
                >
                  <span className="min-w-0 wrap-anywhere">{panel.title}</span>
                  <span className="shrink-0 text-xs font-medium text-muted-foreground">
                    {classroomMessages.viewMode.openPanelAction}
                  </span>
                </Button>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </section>
  );
}
