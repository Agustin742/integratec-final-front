import { useEffect, useRef } from 'react';
import { useLocation, useOutletContext, useParams } from 'react-router';
import { NotFoundPage } from '@/app/pages/not-found-page';
import { useClassroomPanels } from './panels/classroom-panels';

export type ClassroomPanelRouteContext = {
  claimPanelRoute: () => boolean;
  closePanelRoute: () => void;
};

/** A URL is an intent, never a descriptor or a permission grant. */
export function ClassroomPanelRoute() {
  const { panelKey } = useParams();
  const { key: routeOwner } = useLocation();
  const { claimPanelRoute, closePanelRoute } =
    useOutletContext<ClassroomPanelRouteContext>();
  const { openPanel, canOpenPanel } = useClassroomPanels();
  const attempted = useRef(false);
  useEffect(() => {
    if (attempted.current) return;
    attempted.current = true;
    if (claimPanelRoute() && panelKey)
      openPanel(panelKey, undefined, closePanelRoute, routeOwner);
  }, [panelKey, claimPanelRoute, closePanelRoute, openPanel, routeOwner]);
  return !panelKey || !canOpenPanel(panelKey) ? <NotFoundPage /> : null;
}
