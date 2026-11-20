import type { components } from '@/api/schema.generated';
import { EmptyState } from '@/components/feedback/states';
import { ActivitiesPanel } from '../activities/activities-panel';
import { NoticeBoardPanel } from '../announcements/notice-board-panel';
import { StudyGuideBotPanel } from '../bot/study-guide-bot-panel';
import { ChatPanel } from '../chat/chat-panel';
import { ClassroomGradesPanel } from '../grading/classroom-grades-panel';
import { MaterialPanel } from '../materials/material-panel';
import { ClassroomMembersPanel } from '../classroom-members-panel';
import { ShopPanel } from '../../shop/shop-panel';
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
  {
    key: 'chat',
    title: messages.panels.chat,
    component: ChatPanel,
  },
  {
    key: 'notices',
    title: messages.panels.notices,
    component: NoticeBoardPanel,
  },
  {
    key: 'shop',
    title: messages.panels.shop,
    component: ShopPanel,
  },
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
