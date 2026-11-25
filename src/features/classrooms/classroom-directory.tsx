import { useId, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { classroomDirectoryMembersQueryKey } from '@/api/query-keys';
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from '@/components/feedback/states';
import { Badge } from '@/components/ui/badge';
import { DirectCallButton } from '@/features/calls';
import { InitialsAvatar } from '@/components/ui/initials-avatar';
import { useSessionService, useSessionSnapshot } from '@/session/provider';
import type { ClassroomDirectoryMemberDto } from './activities/forum/forum-schema';
import { listClassroomDirectoryMembers } from './activities/forum/forum-service';
import { classroomMessages } from './messages';

const copy = classroomMessages.members;
const DIRECTORY_PARAMS = { page: 1, pageSize: 100 } as const;
const MAX_DIRECTORY_PAGES = 50;

async function listAllClassroomDirectoryMembers(
  client: ReturnType<typeof useSessionService>['client'],
  classroomId: string,
  signal?: AbortSignal,
) {
  const first = await listClassroomDirectoryMembers(
    client,
    classroomId,
    DIRECTORY_PARAMS,
    { signal },
  );
  if (first.items.length >= first.total || first.items.length === 0) {
    return first;
  }

  const seenUserIds = new Set(first.items.map((member) => member.userId));
  const collected = [...first.items];
  let page = first.page + 1;

  while (collected.length < first.total && page <= MAX_DIRECTORY_PAGES) {
    if (signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }
    const next = await listClassroomDirectoryMembers(
      client,
      classroomId,
      { page, pageSize: first.pageSize },
      { signal },
    );
    if (next.items.length === 0) {
      break;
    }
    for (const member of next.items) {
      if (!seenUserIds.has(member.userId)) {
        seenUserIds.add(member.userId);
        collected.push(member);
      }
    }
    page += 1;
  }

  return {
    items: collected,
    page: 1,
    pageSize: first.pageSize,
    total: first.total,
  };
}

/**
 * `GET /classrooms/{id}/members`: public member cards (name and role only),
 * shared with chat, notices and presence through the same query key. Loads all
 * pages when a classroom has more members than a single page.
 */
export function useClassroomDirectory(classroomId: string) {
  const { client } = useSessionService();
  const snapshot = useSessionSnapshot();
  const userId = snapshot.status === 'authenticated' ? snapshot.user.id : null;
  const query = useQuery({
    queryKey: classroomDirectoryMembersQueryKey(
      userId ?? 'anonymous',
      classroomId,
      DIRECTORY_PARAMS,
    ),
    queryFn: ({ signal }) =>
      listAllClassroomDirectoryMembers(client, classroomId, signal),
    enabled: userId !== null && classroomId !== '',
    staleTime: 60_000,
    retry: false,
  });
  return { query, userId };
}

function MemberRow({
  member,
  isSelf,
  classroomId,
}: {
  readonly classroomId: string;
  readonly member: ClassroomDirectoryMemberDto;
  readonly isSelf: boolean;
}) {
  return (
    <li className="flex min-w-0 items-center gap-3 px-3 py-2.5">
      <InitialsAvatar name={member.displayName} />
      <span className="min-w-0 flex-1 font-semibold break-words text-foreground">
        {member.displayName}
      </span>
      {isSelf ? <Badge variant="info">{copy.selfBadge}</Badge> : null}
      {member.role === 'TEACHER' ? (
        <Badge variant="secondary">{copy.roleLabels.TEACHER}</Badge>
      ) : null}
      {isSelf ? null : (
        <DirectCallButton
          classroomId={classroomId}
          peerUserId={member.userId}
          peerName={member.displayName}
        />
      )}
    </li>
  );
}

function DirectoryGroup({
  title,
  count,
  children,
}: {
  readonly title: string;
  readonly count: number;
  readonly children: ReactNode;
}) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="min-w-0 space-y-2">
      <h4
        id={headingId}
        className="flex items-center gap-2 font-display text-base font-semibold text-foreground"
      >
        {title}
        <Badge variant="outline">{count}</Badge>
      </h4>
      {children}
    </section>
  );
}

function MemberList({
  members,
  userId,
  label,
  classroomId,
}: {
  readonly classroomId: string;
  readonly members: readonly ClassroomDirectoryMemberDto[];
  readonly userId: string | null;
  readonly label: string;
}) {
  return (
    <ul
      aria-label={label}
      className="min-w-0 divide-y divide-edge/60 overflow-hidden rounded-2xl border border-edge bg-card text-card-foreground shadow-panel"
    >
      {members.map((member) => (
        <MemberRow
          key={member.userId}
          classroomId={classroomId}
          member={member}
          isSelf={member.userId === userId}
        />
      ))}
    </ul>
  );
}

function DirectoryStatus({
  isPending,
  isError,
  onRetry,
  isRetrying,
}: {
  readonly isPending: boolean;
  readonly isError: boolean;
  readonly onRetry: () => void;
  readonly isRetrying: boolean;
}) {
  if (isPending) {
    return <LoadingState label={copy.directoryLoading} skeletonLines={3} />;
  }
  if (isError) {
    return (
      <ErrorState
        headingLevel="h4"
        title={copy.directoryErrorTitle}
        description={copy.directoryErrorDescription}
        onRetry={onRetry}
        isRetrying={isRetrying}
        retryLabel={copy.directoryRetry}
      />
    );
  }
  return null;
}

function TeachersGroup({
  teachers,
  userId,
  classroomId,
}: {
  readonly classroomId: string;
  readonly teachers: readonly ClassroomDirectoryMemberDto[];
  readonly userId: string | null;
}) {
  return (
    <DirectoryGroup title={copy.teachersHeading} count={teachers.length}>
      {teachers.length === 0 ? (
        <p className="text-sm text-muted-foreground">{copy.teachersEmpty}</p>
      ) : (
        <MemberList
          classroomId={classroomId}
          members={teachers}
          userId={userId}
          label={copy.teachersHeading}
        />
      )}
    </DirectoryGroup>
  );
}

/** Staff: the teaching team shown above the managed student roster. */
export function ClassroomTeachersSection({
  classroomId,
}: {
  readonly classroomId: string;
}) {
  const { query, userId } = useClassroomDirectory(classroomId);
  const teachers = (query.data?.items ?? []).filter(
    (member) => member.role === 'TEACHER',
  );
  return (
    <div className="min-w-0 pt-2">
      {query.data === undefined ? (
        <DirectoryStatus
          isPending={query.isPending}
          isError={query.isError}
          onRetry={() => void query.refetch()}
          isRetrying={query.isRefetching}
        />
      ) : (
        <TeachersGroup
          teachers={teachers}
          userId={userId}
          classroomId={classroomId}
        />
      )}
    </div>
  );
}

/** Students: the directory grouped into teachers and classmates. */
export function ClassroomDirectoryPanel({
  classroomId,
}: {
  readonly classroomId: string;
}) {
  const { query, userId } = useClassroomDirectory(classroomId);
  const items = query.data?.items ?? [];
  const teachers = items.filter((member) => member.role === 'TEACHER');
  const students = items.filter((member) => member.role === 'STUDENT');

  return (
    <section
      aria-label={copy.directoryHeading}
      className="min-w-0 space-y-5 pt-2"
    >
      <div className="min-w-0 space-y-1">
        <h3 className="font-display text-lg font-semibold text-foreground">
          {copy.directoryHeading}
        </h3>
        <p className="text-sm text-pretty text-muted-foreground">
          {copy.directorySubtitle}
        </p>
      </div>
      {query.data === undefined ? (
        <DirectoryStatus
          isPending={query.isPending}
          isError={query.isError}
          onRetry={() => void query.refetch()}
          isRetrying={query.isRefetching}
        />
      ) : (
        <>
          <TeachersGroup
            teachers={teachers}
            userId={userId}
            classroomId={classroomId}
          />
          <DirectoryGroup title={copy.studentsHeading} count={students.length}>
            {students.length === 0 ? (
              <EmptyState
                headingLevel="h4"
                title={copy.studentsEmptyTitle}
                description={copy.studentsEmptyDescription}
              />
            ) : (
              <MemberList
                classroomId={classroomId}
                members={students}
                userId={userId}
                label={copy.studentsHeading}
              />
            )}
          </DirectoryGroup>
        </>
      )}
    </section>
  );
}
