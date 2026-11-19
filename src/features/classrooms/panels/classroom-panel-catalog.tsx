import type { components } from '@/api/schema.generated';
import { EmptyState } from '@/components/feedback/states';
import { ActivitiesPanel } from '../activities/activities-panel';
import { NoticeBoardPanel } from '../announcements/notice-board-panel';
import { StudyGuideBotPanel } from '../bot/study-guide-bot-panel';
import { ClassroomGradesPanel } from '../grading/classroom-grades-panel';
import { MaterialPanel } from '../materials/material-panel';
import { ClassroomMembersPanel } from '../classroom-members-panel';
import { classroomMessages as messages } from '../messages';
import type { PanelDescriptor } from './classroom-panels';

type PanelKey = Exclude<components['schemas']['ClassroomPanelKey'], 'pet'>;

function PendingPanelContent() {
  return (
    <EmptyState
      title={messages.pendingPanelTitle}
      description={messages.pendingPanelDescription}
    />
  );
}

function entry(key: PanelKey): PanelDescriptor & { key: PanelKey } {
  return { key, title: messages.panels[key], component: PendingPanelContent };
}

// Visibility comes only from server availablePanels, not action capabilities.
// Pet is reserved by the backend and intentionally has no registered component.
export const classroomPanelCatalog = [
  {
    key: 'activities',
    title: messages.panels.activities,
    component: ActivitiesPanel,
  },
  {
    key: 'material',
    title: messages.panels.material,
    component: MaterialPanel,
  },
  {
    key: 'grades',
    title: messages.panels.grades,
    component: ClassroomGradesPanel,
  },
  entry('chat'),
  {
    key: 'notices',
    title: messages.panels.notices,
    component: NoticeBoardPanel,
  },
  entry('shop'),
  {
    key: 'bot',
    title: messages.panels.bot,
    component: StudyGuideBotPanel,
  },
  {
    key: 'members',
    title: messages.panels.members,
    component: ClassroomMembersPanel,
  },
  entry('settings'),
] as const;
