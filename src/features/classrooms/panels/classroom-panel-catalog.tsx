import { ActivitiesPanel } from '../activities/activities-panel';
import { NoticeBoardPanel } from '../announcements/notice-board-panel';
import { StudyGuideBotPanel } from '../bot/study-guide-bot-panel';
import { ChatComposer } from '../chat/chat-composer';
import { ChatPanel } from '../chat/chat-panel';
import { ClassroomGradesPanel } from '../grading/classroom-grades-panel';
import { MaterialPanel } from '../materials/material-panel';
import { ClassroomMembersPanel } from '../classroom-members-panel';
import { ClassroomSettingsPanel } from '../settings/classroom-settings-panel';
import { ShopPanel } from '../../shop/shop-panel';
import { classroomMessages as messages } from '../messages';

/**
 * Catalog wiring for the chat panel (#51): the composer (length limits,
 * @mentions, rate-limit and muted behavior) rides the read panel's composer
 * slot so history and send side share one classroom-scoped view.
 */
function ChatPanelWithComposer() {
  return <ChatPanel composer={<ChatComposer />} />;
}

// Visibility comes only from server availablePanels, not action capabilities.
// Pet is reserved by the backend and intentionally has no registered component.
export const classroomPanelCatalog = [
  {
    key: 'activities',
    title: messages.panels.activities,
    component: ActivitiesPanel,
    wide: true,
  },
  {
    key: 'material',
    title: messages.panels.material,
    component: MaterialPanel,
    wide: true,
  },
  {
    key: 'grades',
    title: messages.panels.grades,
    component: ClassroomGradesPanel,
    wide: true,
  },
  {
    key: 'chat',
    title: messages.panels.chat,
    component: ChatPanelWithComposer,
  },
  {
    key: 'notices',
    title: messages.panels.notices,
    component: NoticeBoardPanel,
    wide: true,
  },
  {
    key: 'shop',
    title: messages.panels.shop,
    component: ShopPanel,
    wide: true,
  },
  {
    key: 'bot',
    title: messages.panels.bot,
    component: StudyGuideBotPanel,
    wide: true,
  },
  {
    key: 'members',
    title: messages.panels.members,
    component: ClassroomMembersPanel,
    wide: true,
  },
  {
    key: 'settings',
    title: messages.panels.settings,
    component: ClassroomSettingsPanel,
    wide: true,
  },
] as const;
