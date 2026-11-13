import type { ReactNode } from 'react';
import { Outlet, useParams } from 'react-router';
import { LoadingState } from '@/components/feedback/states';
import {
  useClassroomCapabilities,
  type Capability,
} from '@/features/classrooms/use-classroom-capabilities';
import { messages } from '../messages';
import { forbidden, notFound } from './route-errors';

export type RequireCapabilityProps = {
  /** Capability the server must have granted for this classroom. */
  capability: Capability;
  /** Classroom to check; defaults to the `:classroomId` route param. */
  classroomId?: string;
  /** Gated content; defaults to the nested route (`<Outlet />`). */
  children?: ReactNode;
};

/**
 * Gate for content that needs a capability inside one classroom. The decision
 * comes only from the server (`useClassroomCapabilities`):
 *
 * - pending: loading, never the protected content;
 * - capability missing, or a 403: the forbidden view (a reachable resource the
 *   role cannot use);
 * - a 404: the not-found view, so a classroom outside the user's access looks
 *   exactly like one that does not exist;
 * - any other failure: rethrown for the generic error view with retry.
 *
 * Failures are thrown so the page error boundary decides the view. This gate
 * never redirects: a 401 belongs to the session layer, not to a resource.
 *
 * Usage as a route wrapper (the param name is the default `classroomId`):
 *
 *     {
 *       path: 'classrooms/:classroomId/moderation',
 *       element: <RequireCapability capability="moderate_chat" />,
 *       children: [{ index: true, lazy: ... }],
 *     }
 */
export function RequireCapability({
  capability,
  classroomId,
  children,
}: RequireCapabilityProps) {
  const params = useParams();
  const id = classroomId ?? params.classroomId;
  if (id === undefined || id === '') throw notFound();
  return (
    <GateForClassroom capability={capability} classroomId={id}>
      {children ?? <Outlet />}
    </GateForClassroom>
  );
}

function GateForClassroom({
  capability,
  classroomId,
  children,
}: {
  capability: Capability;
  classroomId: string;
  children: ReactNode;
}) {
  const access = useClassroomCapabilities(classroomId);

  switch (access.status) {
    case 'pending':
      return <LoadingState label={messages.access.checking} />;
    case 'error':
      if (access.error.kind === 'not-found') throw notFound();
      if (access.error.kind === 'forbidden') throw forbidden();
      throw access.error;
    case 'ready':
      if (!access.can(capability)) throw forbidden();
      return children;
  }
}
