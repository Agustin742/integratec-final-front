import { Badge } from '@/components/ui/badge';
import type {
  BotAllowedMaterialDto,
  BotIndexingStatus,
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

export function MaterialBotToggleSlot({
  material,
  botState,
  isConfigPending,
  isConfigError,
  isToggling,
  onToggle,
}: MaterialBotToggleSlotProps) {
  const botEnabled = botState?.botEnabled ?? false;
  const indexingStatus: BotIndexingStatus =
    botState?.indexingStatus ?? 'disabled';
  const isUnavailable =
    isConfigPending || (isConfigError && botState === undefined);
  const isDisabled = isToggling || isUnavailable;
  const hintId = `bot-material-hint-${material.id}`;

  const hintText = isToggling
    ? materialMessages.list.bot.updatingHint
    : botEnabled
      ? materialMessages.list.bot.enabledHint
      : materialMessages.list.bot.disabledHint;

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
        {indexingStatus === 'failed' &&
          typeof botState?.indexingError === 'string' &&
          botState.indexingError.length > 0 && (
            <p className="text-xs text-destructive wrap-anywhere">
              {botState.indexingError}
            </p>
          )}
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={botEnabled}
        aria-label={materialMessages.list.bot.switchLabel(material.filename)}
        aria-describedby={hintId}
        disabled={isDisabled}
        onClick={() => onToggle(material, !botEnabled)}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
          botEnabled ? 'border-primary bg-primary' : 'border-border bg-muted'
        }`}
      >
        <span
          aria-hidden="true"
          className={`pointer-events-none inline-block size-4 rounded-full bg-background shadow-sm transition-transform ${
            botEnabled ? 'translate-x-5' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  );
}
