import { useRef } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type {
  BotAllowedMaterialDto,
  BotIndexState,
} from './material-bot-schema';
import type { MaterialDto } from './material-schema';
import { materialMessages } from './messages';

export interface MaterialBotToggleSlotProps {
  readonly material: MaterialDto;
  readonly botState: BotAllowedMaterialDto | undefined;
  readonly isConfigPending: boolean;
  readonly isConfigError: boolean;
  readonly isToggling: boolean;
  readonly onToggle: (material: MaterialDto, nextEnabled: boolean) => void;
}

type BotIndexingStatus = 'disabled' | 'pending' | 'ready' | 'failed';

const STATUS_BY_INDEX_STATE: Record<BotIndexState, BotIndexingStatus> = {
  PENDING: 'pending',
  INDEXED: 'ready',
  FAILED: 'failed',
};

function getIndexingBadgeVariant(
  status: BotIndexingStatus,
): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'ready':
      return 'default';
    case 'pending':
      return 'secondary';
    case 'failed':
      return 'destructive';
    case 'disabled':
      return 'outline';
  }
}

function resolveHintText(options: {
  readonly isToggling: boolean;
  readonly isConfigPending: boolean;
  readonly isConfigError: boolean;
  readonly botEnabled: boolean;
  readonly indexingStatus: BotIndexingStatus;
}): string {
  if (options.isToggling) {
    return materialMessages.list.bot.updatingHint;
  }
  if (options.isConfigError) {
    return materialMessages.list.bot.errorConfigHint;
  }
  if (options.isConfigPending) {
    return materialMessages.list.bot.pendingConfigHint;
  }
  if (!options.botEnabled) {
    return materialMessages.list.bot.disabledHint;
  }
  switch (options.indexingStatus) {
    case 'pending':
      return materialMessages.list.bot.pendingIndexingHint;
    case 'failed':
      return materialMessages.list.bot.failedIndexingHint;
    case 'ready':
    case 'disabled':
      return materialMessages.list.bot.enabledHint;
  }
}

export function MaterialBotToggleSlot({
  material,
  botState,
  isConfigPending,
  isConfigError,
  isToggling,
  onToggle,
}: MaterialBotToggleSlotProps) {
  const isUnavailable = isConfigPending || isConfigError;
  // Only allowed materials have an entry; no entry means disabled.
  const botEnabled = !isUnavailable && botState !== undefined;
  const indexingStatus: BotIndexingStatus = botState
    ? STATUS_BY_INDEX_STATE[botState.indexState]
    : 'disabled';
  const switchRef = useRef<HTMLButtonElement>(null);
  const isDisabled = isToggling || isUnavailable;
  const hintId = `bot-material-hint-${material.id}`;

  const hintText = resolveHintText({
    isToggling,
    isConfigPending,
    isConfigError,
    botEnabled,
    indexingStatus,
  });

  return (
    <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-foreground">
            {materialMessages.list.bot.sectionLabel}
          </span>
          {!isUnavailable && (
            <Badge variant={getIndexingBadgeVariant(indexingStatus)}>
              {materialMessages.list.bot.statuses[indexingStatus]}
            </Badge>
          )}
        </div>
        <p id={hintId} className="text-xs text-muted-foreground">
          {hintText}
        </p>
        {!isUnavailable &&
          indexingStatus === 'failed' &&
          typeof botState?.failureReason === 'string' &&
          botState.failureReason.length > 0 && (
            <p className="text-xs text-destructive wrap-anywhere">
              {botState.failureReason}
            </p>
          )}
        {!isUnavailable && indexingStatus === 'failed' && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-h-11"
            aria-label={materialMessages.list.bot.retryIndexLabel(
              material.filename,
            )}
            aria-disabled={isDisabled}
            onClick={() => {
              if (isDisabled) return;
              // This button unmounts once indexing succeeds.
              switchRef.current?.focus();
              onToggle(material, true);
            }}
          >
            {materialMessages.list.bot.retryIndexAction}
          </Button>
        )}
      </div>

      <button
        ref={switchRef}
        type="button"
        role="switch"
        aria-checked={botEnabled}
        aria-label={materialMessages.list.bot.switchLabel(material.filename)}
        aria-describedby={hintId}
        aria-disabled={isDisabled}
        aria-busy={isToggling || undefined}
        onClick={() => {
          if (isDisabled) return;
          onToggle(material, !botEnabled);
        }}
        className={`inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
          isDisabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
        }`}
      >
        <span
          aria-hidden="true"
          className={`relative inline-flex h-6 w-11 items-center rounded-full border transition-colors ${
            botEnabled
              ? 'border-primary bg-primary'
              : 'border-foreground/35 bg-muted'
          }`}
        >
          <span
            className={`pointer-events-none inline-block size-4 rounded-full shadow-sm transition-transform ${
              botEnabled
                ? 'translate-x-5 bg-background'
                : 'translate-x-1 bg-foreground/75'
            }`}
          />
        </span>
      </button>
    </div>
  );
}
