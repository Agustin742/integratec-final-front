import { useId } from 'react';
import { cn } from '@/lib/utils';
import { describeAvatar, type Avatar } from './avatar-options';
import { profileMessages } from './messages';

const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;

/** Colors only reach the SVG through the contract palette; anything else falls back. */
const safeColor = (value: string, fallback: string): string =>
  HEX_COLOR.test(value) ? value : fallback;

const SKIN = '#EBC8A4';
const SKIN_SHADE = '#D4A97F';
const OUTLINE = '#2B2A33';

export interface AvatarPreviewProps {
  readonly avatar: Avatar;
  readonly className?: string;
}

/**
 * 2D/DOM representation of a base avatar choice (HU-AUT-003, part 1/2).
 * The 3D rendering component is a separate delivery; this preview only
 * mirrors the five contract fields with distinct shapes (not hue alone) so
 * orientation-independent choices stay readable at small sizes
 * (`rules/avatars-and-customization.md`).
 */
export function AvatarPreview({ avatar, className }: AvatarPreviewProps) {
  const titleId = useId();
  const hair = safeColor(avatar.hairColor, '#6C4D48');
  const clothing = safeColor(avatar.clothingColor, '#5B4F96');
  const wide = avatar.bodyId === 'male';
  // Shoulder half-width: the body choice changes the silhouette itself.
  const shoulder = wide ? 40 : 34;
  const waist = wide ? 34 : 28;
  const left = 60 - shoulder;
  const right = 60 + shoulder;

  return (
    <svg
      role="img"
      aria-labelledby={titleId}
      viewBox="0 0 120 160"
      className={cn('block h-auto w-full', className)}
      data-avatar-preview="true"
    >
      <title id={titleId}>
        {`${profileMessages.avatar.previewAlt} ${describeAvatar(avatar)}`}
      </title>

      {avatar.hairId === 'afro' && (
        <circle
          cx="60"
          cy="38"
          r="30"
          fill={hair}
          stroke={OUTLINE}
          strokeWidth="2"
        />
      )}
      {avatar.hairId === 'dreads' &&
        [38, 47, 56, 65, 74, 83].map((x) => (
          <rect
            key={x}
            x={x - 3}
            y="26"
            width="6"
            height={x === 38 || x === 83 ? 46 : 38}
            rx="3"
            fill={hair}
            stroke={OUTLINE}
            strokeWidth="1.5"
          />
        ))}
      {avatar.hairId === 'original' && (
        <path
          d="M34 44 C34 14 86 14 86 44 L86 72 L74 72 L74 40 L46 40 L46 72 L34 72 Z"
          fill={hair}
          stroke={OUTLINE}
          strokeWidth="2"
        />
      )}

      {/* Torso, drawn before the neck so the top overlaps it. */}
      <path
        d={`M${left} 150 L${left} 104 C${left} 90 48 84 60 84 C72 84 ${right} 90 ${right} 104 L${right} 150 Z`}
        fill={clothing}
        stroke={OUTLINE}
        strokeWidth="2"
      />
      {avatar.topId === 'tank' && (
        <>
          <path
            d={`M${left} 104 C${left} 96 ${left + 4} 92 ${left + 8} 90 L${left + 8} 150 L${left} 150 Z`}
            fill={SKIN}
            stroke={OUTLINE}
            strokeWidth="2"
          />
          <path
            d={`M${right} 104 C${right} 96 ${right - 4} 92 ${right - 8} 90 L${right - 8} 150 L${right} 150 Z`}
            fill={SKIN}
            stroke={OUTLINE}
            strokeWidth="2"
          />
        </>
      )}
      {avatar.topId === 'hoodie' && (
        <path
          d="M40 90 C40 104 80 104 80 90 C80 84 70 82 60 82 C50 82 40 84 40 90 Z"
          fill={clothing}
          stroke={OUTLINE}
          strokeWidth="3"
        />
      )}
      {avatar.topId === 'tshirt' && (
        <>
          <rect
            x={left - 8}
            y="92"
            width="14"
            height="22"
            rx="6"
            fill={clothing}
            stroke={OUTLINE}
            strokeWidth="2"
          />
          <rect
            x={right - 6}
            y="92"
            width="14"
            height="22"
            rx="6"
            fill={clothing}
            stroke={OUTLINE}
            strokeWidth="2"
          />
        </>
      )}
      <path
        d={`M${60 - waist} 150 L${60 + waist} 150`}
        stroke={OUTLINE}
        strokeWidth="2"
      />

      {/* Neck and head. */}
      <rect x="52" y="70" width="16" height="16" rx="4" fill={SKIN_SHADE} />
      <ellipse
        cx="60"
        cy="52"
        rx="19"
        ry="22"
        fill={SKIN}
        stroke={OUTLINE}
        strokeWidth="2"
      />
      <circle cx="53" cy="52" r="2.2" fill={OUTLINE} />
      <circle cx="67" cy="52" r="2.2" fill={OUTLINE} />
      <path
        d="M54 62 Q60 67 66 62"
        fill="none"
        stroke={OUTLINE}
        strokeWidth="2"
        strokeLinecap="round"
      />
      {avatar.hairId === 'original' && (
        <path
          d="M41 46 C44 30 76 30 79 46 C70 40 50 40 41 46 Z"
          fill={hair}
          stroke={OUTLINE}
          strokeWidth="2"
        />
      )}
      {avatar.hairId === 'afro' && (
        <path
          d="M41 44 C46 34 74 34 79 44 C70 40 50 40 41 44 Z"
          fill={hair}
          stroke={OUTLINE}
          strokeWidth="2"
        />
      )}
      {avatar.hairId === 'dreads' && (
        <path
          d="M41 44 C44 30 76 30 79 44 C70 38 50 38 41 44 Z"
          fill={hair}
          stroke={OUTLINE}
          strokeWidth="2"
        />
      )}
    </svg>
  );
}
