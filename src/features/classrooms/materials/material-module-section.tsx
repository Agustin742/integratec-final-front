import {
  useEffect,
  useId,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';
import { useQuery } from '@tanstack/react-query';
import { ApiError } from '@/api/errors';
import { classroomMaterialsQueryKey } from '@/api/query-keys';
import type { TypedApiClient } from '@/api/client';
import {
  ErrorState,
  LoadingState,
  StaleDataNotice,
} from '@/components/feedback/states';
import { getPaginationMeta } from '@/components/pagination/pagination';
import { PaginationControls } from '@/components/pagination/pagination-controls';
import { Badge } from '@/components/ui/badge';
import { Button, buttonStyles } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { MaterialRowList, type MaterialFileActions } from './material-row';
import { listClassroomMaterials } from './material-service';
import type { MaterialModuleDto } from './module-schema';
import { materialMessages } from './messages';

const PAGE_SIZE = 10;
const copy = materialMessages.modules;

export type ModuleSectionTarget =
  | { readonly kind: 'module'; readonly module: MaterialModuleDto }
  | { readonly kind: 'unassigned'; readonly count: number };

export interface FocusRequest {
  readonly moduleId: string;
  /** Which arrow should hold focus once the module has moved. */
  readonly focus: 'up' | 'down';
  readonly nonce: number;
}

export interface MaterialModuleSectionProps {
  readonly client: TypedApiClient;
  readonly userId: string;
  readonly classroomId: string;
  readonly target: ModuleSectionTarget;
  readonly canManage: boolean;
  /** Zero-based slot among the modules and how many there are (arrows only). */
  readonly index: number;
  readonly total: number;
  /** Opens expanded; used when "Sin módulo" is the only section. */
  readonly defaultExpanded?: boolean;
  readonly reordering: boolean;
  readonly focusRequest: FocusRequest | null;
  readonly fileActions: MaterialFileActions;
  readonly onMove: (moduleId: string, direction: 'up' | 'down') => void;
  readonly onAddFile: (
    target: ModuleSectionTarget,
    trigger: HTMLElement | null,
  ) => void;
  readonly onEdit: (
    module: MaterialModuleDto,
    trigger: HTMLElement | null,
  ) => void;
  readonly onDelete: (
    module: MaterialModuleDto,
    trigger: HTMLElement | null,
  ) => void;
}

const iconProps = {
  'aria-hidden': true,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

/** Empty state inside a section: a quiet block, not a heading, so the module title stays the only heading of its section. */
function SectionEmpty({
  title,
  description,
  action,
}: {
  readonly title: string;
  readonly description: string;
  readonly action?: ReactNode;
}): ReactElement {
  return (
    <div
      data-state-kind="empty"
      className="space-y-1.5 rounded-2xl border border-dashed border-border bg-secondary/40 px-4 py-5 text-center"
    >
      <p className="font-display text-base font-semibold text-foreground">
        {title}
      </p>
      <p className="mx-auto max-w-prose text-sm text-muted-foreground">
        {description}
      </p>
      {action ? <div className="pt-2">{action}</div> : null}
    </div>
  );
}

function FolderTile({ unassigned }: { readonly unassigned: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex size-12 shrink-0 items-center justify-center rounded-2xl',
        unassigned
          ? 'bg-tray text-muted-foreground'
          : 'bg-success text-success-foreground',
      )}
    >
      <svg {...iconProps} className="size-6">
        {unassigned ? (
          <>
            <path d="M3 13h5l1.5 3h5L16 13h5" />
            <path d="M5.5 5.5 3 13v5a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5l-2.5-7.5A2 2 0 0 0 16.6 4H7.4a2 2 0 0 0-1.9 1.5Z" />
          </>
        ) : (
          <path d="M20 19a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-7.4a2 2 0 0 1-1.7-.9l-.6-1A2 2 0 0 0 8.6 4.1H4a2 2 0 0 0-2 2V17a2 2 0 0 0 2 2Z" />
        )}
      </svg>
    </span>
  );
}

export function MaterialModuleSection({
  client,
  userId,
  classroomId,
  target,
  canManage,
  index,
  total,
  defaultExpanded = false,
  reordering,
  focusRequest,
  fileActions,
  onMove,
  onAddFile,
  onEdit,
  onDelete,
}: MaterialModuleSectionProps): ReactElement {
  const isModule = target.kind === 'module';
  const moduleEntry = isModule ? target.module : null;
  const title = isModule ? target.module.name : copy.unassignedTitle;
  const description = isModule
    ? target.module.description
    : copy.unassignedDescription;
  const count = isModule ? target.module.materialCount : target.count;

  const headingId = useId();
  const bodyId = useId();
  const descriptionId = useId();
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [page, setPage] = useState(1);
  const upRef = useRef<HTMLButtonElement | null>(null);
  const downRef = useRef<HTMLButtonElement | null>(null);
  const addRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLButtonElement | null>(null);
  const pendingMenuActionRef = useRef<(() => void) | null>(null);

  const moduleFilter = moduleEntry ? moduleEntry.id : 'unassigned';
  const query = useQuery({
    queryKey: classroomMaterialsQueryKey(userId, classroomId, {
      page,
      pageSize: PAGE_SIZE,
      sort: '-createdAt',
      moduleId: moduleFilter,
    }),
    queryFn: ({ signal }) =>
      listClassroomMaterials(
        client,
        classroomId,
        {
          page,
          pageSize: PAGE_SIZE,
          sort: '-createdAt',
          moduleId: moduleFilter,
        },
        { signal },
      ),
    // Modules load their files only once opened. "Sin módulo" is read by the
    // panel anyway (its total decides whether the panel is empty).
    enabled: expanded || !isModule,
  });

  const moveUpDisabled = reordering || index === 0;
  const moveDownDisabled = reordering || index === total - 1;

  useEffect(() => {
    if (!moduleEntry || focusRequest?.moduleId !== moduleEntry.id) return;
    // The DOM node may have been moved (dropping focus), and the pressed
    // arrow can be disabled at the ends of the list; the panel picks the
    // arrow that keeps keyboard users in place.
    (focusRequest.focus === 'up' ? upRef.current : downRef.current)?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to a new request
  }, [focusRequest?.nonce]);

  const data = query.data;

  function renderBody(): ReactElement {
    if (query.isPending) {
      return (
        <LoadingState
          label={materialMessages.loading}
          skeletonLines={2}
          className="rounded-none border-0 bg-transparent shadow-none"
        />
      );
    }
    if (query.isError && data === undefined) {
      const detail =
        query.error instanceof ApiError
          ? query.error.userMessage
          : copy.filesErrorDescription;
      return (
        <div className="p-4 sm:p-5">
          <ErrorState
            headingLevel="h4"
            title={copy.filesErrorTitle}
            description={detail}
            onRetry={() => void query.refetch()}
          />
        </div>
      );
    }
    if (!data) return <></>;

    if (data.items.length === 0) {
      return (
        <div className="p-4 sm:p-5">
          {page > 1 ? (
            <SectionEmpty
              title={materialMessages.emptyPageTitle}
              description={materialMessages.emptyPageDescription}
              action={
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(1)}
                >
                  {materialMessages.goToFirstPageAction}
                </Button>
              }
            />
          ) : (
            <SectionEmpty
              title={copy.emptyModule}
              description={
                canManage ? copy.emptyModuleTeacher : copy.emptyModuleStudent
              }
            />
          )}
        </div>
      );
    }

    const pagination = getPaginationMeta({
      page: data.page,
      pageSize: data.pageSize,
      total: data.total,
    });
    return (
      <>
        {query.isError ? (
          <div className="p-4 pb-0 sm:p-5 sm:pb-0">
            <StaleDataNotice
              title={materialMessages.staleTitle}
              description={materialMessages.staleDescription}
              onRetry={() => void query.refetch()}
            />
          </div>
        ) : null}
        <MaterialRowList
          items={data.items}
          actions={fileActions}
          label={`${materialMessages.list.regionLabel}: ${title}`}
        />
        {pagination.totalPages > 1 ? (
          <div className="border-t border-edge p-3 sm:p-4">
            <PaginationControls
              page={data.page}
              pageSize={data.pageSize}
              total={data.total}
              label={`Paginación de ${title}`}
              className="border-0 bg-transparent px-1 py-0 shadow-none"
              onPageChange={(nextPage: number) => {
                fileActions.onCancelRemove();
                setPage(nextPage);
              }}
            />
          </div>
        ) : null}
      </>
    );
  }

  return (
    <section
      aria-labelledby={headingId}
      className={cn(
        'min-w-0 overflow-hidden rounded-2xl bg-card shadow-xs',
        isModule
          ? 'border border-edge'
          : 'border-2 border-dashed border-field-border/60 bg-card/70',
      )}
    >
      <div className="relative grid min-w-0 gap-3 px-4 py-4 transition-colors focus-within:bg-row-hover hover:bg-row-hover sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-4 sm:px-5">
        <div className="flex min-w-0 items-start gap-3.5">
          <FolderTile unassigned={!isModule} />
          <div className="min-w-0 flex-1 space-y-1">
            <h3
              id={headingId}
              className="font-display text-lg leading-snug font-semibold text-foreground"
            >
              <button
                type="button"
                aria-expanded={expanded}
                aria-controls={bodyId}
                aria-describedby={descriptionId}
                onClick={() => setExpanded((open) => !open)}
                className="flex w-full items-center gap-2 rounded-md text-left break-words outline-none after:absolute after:inset-0 after:content-[''] focus-visible:after:rounded-2xl focus-visible:after:outline-3 focus-visible:after:-outline-offset-3 focus-visible:after:outline-ring"
              >
                <span className="min-w-0">{title}</span>
                <svg
                  {...iconProps}
                  strokeWidth={2.4}
                  className={cn(
                    'size-5 shrink-0 text-muted-foreground transition-transform motion-reduce:transition-none',
                    expanded && 'rotate-180',
                  )}
                >
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>
            </h3>
            <p
              id={descriptionId}
              className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground"
            >
              <Badge
                variant={isModule ? 'success' : 'secondary'}
                className="px-2.5 py-0.5 text-xs"
              >
                {copy.fileCount(count)}
              </Badge>
              {description ? (
                <span className="line-clamp-2 min-w-0 break-words">
                  {description}
                </span>
              ) : null}
            </p>
          </div>
        </div>

        {canManage ? (
          <div className="relative z-10 flex flex-wrap items-center gap-2">
            {moduleEntry ? (
              <>
                <button
                  ref={upRef}
                  type="button"
                  disabled={moveUpDisabled}
                  aria-label={copy.moveUpAriaLabel(moduleEntry.name)}
                  onClick={() => onMove(moduleEntry.id, 'up')}
                  className={buttonStyles({
                    variant: 'outline',
                    size: 'icon',
                    disabled: moveUpDisabled,
                  })}
                >
                  <svg {...iconProps} strokeWidth={2.4} className="size-5">
                    <path d="m18 15-6-6-6 6" />
                  </svg>
                </button>
                <button
                  ref={downRef}
                  type="button"
                  disabled={moveDownDisabled}
                  aria-label={copy.moveDownAriaLabel(moduleEntry.name)}
                  onClick={() => onMove(moduleEntry.id, 'down')}
                  className={buttonStyles({
                    variant: 'outline',
                    size: 'icon',
                    disabled: moveDownDisabled,
                  })}
                >
                  <svg {...iconProps} strokeWidth={2.4} className="size-5">
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </button>
              </>
            ) : null}
            <button
              ref={addRef}
              type="button"
              aria-label={copy.addFileAriaLabel(title)}
              onClick={() => onAddFile(target, addRef.current)}
              className={cn(
                buttonStyles({ variant: 'outline', size: 'sm' }),
                'order-last w-full sm:order-none sm:w-auto',
              )}
            >
              <svg {...iconProps} strokeWidth={2.4} className="size-4">
                <path d="M12 5v14M5 12h14" />
              </svg>
              {copy.addFileAction}
            </button>
            {moduleEntry ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    ref={menuRef}
                    type="button"
                    aria-label={copy.moreActionsAriaLabel(moduleEntry.name)}
                    className={cn(
                      buttonStyles({ variant: 'outline', size: 'icon' }),
                      'ml-auto sm:ml-0',
                    )}
                  >
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 24 24"
                      className="size-5"
                      fill="currentColor"
                    >
                      <circle cx="5" cy="12" r="1.8" />
                      <circle cx="12" cy="12" r="1.8" />
                      <circle cx="19" cy="12" r="1.8" />
                    </svg>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  onCloseAutoFocus={(event) => {
                    const pending = pendingMenuActionRef.current;
                    if (pending) {
                      pendingMenuActionRef.current = null;
                      event.preventDefault();
                      pending();
                    }
                  }}
                >
                  <DropdownMenuItem
                    onSelect={() => {
                      pendingMenuActionRef.current = () =>
                        onEdit(moduleEntry, menuRef.current);
                    }}
                  >
                    {copy.editAction}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    tone="destructive"
                    onSelect={() => {
                      pendingMenuActionRef.current = () =>
                        onDelete(moduleEntry, menuRef.current);
                    }}
                  >
                    {copy.deleteAction}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
          </div>
        ) : null}
      </div>

      <div
        id={bodyId}
        hidden={!expanded}
        className="border-t border-edge bg-background/50"
      >
        {expanded ? renderBody() : null}
      </div>
    </section>
  );
}
