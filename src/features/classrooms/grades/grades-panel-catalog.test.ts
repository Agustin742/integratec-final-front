import { describe, expect, test } from 'vitest';
import { classroomPanelCatalog } from '../panels/classroom-panel-catalog';
import { classroomMessages } from '../messages';
import { GradesPanel } from './grades-panel';

describe('classroom panel catalog: grades entry (#46)', () => {
  test("maps the server-confirmed 'grades' key to GradesPanel instead of a pending placeholder", () => {
    const gradesEntry = classroomPanelCatalog.find(
      (entry) => entry.key === 'grades',
    );

    expect(gradesEntry).toBeDefined();
    // The real panel component, not the internal PendingPanelContent stub.
    expect(gradesEntry?.component).toBe(GradesPanel);
    expect(gradesEntry?.title).toBe(classroomMessages.panels.grades);
    expect(gradesEntry?.title).not.toBe(classroomMessages.pendingPanelTitle);
  });

  test("registers the 'grades' key exactly once", () => {
    const gradesEntries = classroomPanelCatalog.filter(
      (entry) => entry.key === 'grades',
    );
    expect(gradesEntries).toHaveLength(1);
  });
});
