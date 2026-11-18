import type { components } from '@/api/schema.generated';
import { EmptyState } from '@/components/feedback/states';
import { MaterialPanel } from '../materials/material-panel';
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
  entry('activities'),
  {
    key: 'material',
    title: messages.panels.material,
    component: MaterialPanel,
  },
  entry('grades'),
  entry('chat'),
  entry('notices'),
  entry('shop'),
  entry('bot'),
  entry('members'),
  entry('settings'),
] as const;
