import { useId } from 'react';
import { cn } from '@/lib/utils';
import { describeAvatar, type Avatar } from './avatar-options';
import { profileMessages } from './messages';

const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;

/** Unsupported colors never become SVG paint values. */
const safeColor = (value: string, fallback: string): string =>
  HEX_COLOR.test(value) ? value : fallback;

// The contract has no skin-tone field; this is a rendering choice, not saved data.
const SKIN = '#F8C6AF';
const INK = '#382F3F';

type HairShape = 'afro' | 'dreads' | 'classic';
type TopShape = 'tank' | 'tshirt' | 'hoodie';

/** This flat preview only draws a few silhouettes; other styles use the closest one. */
function hairShapeOf(hairId: Avatar['hairId']): HairShape {
  if (hairId === 'afro' || hairId === 'afro-with-headband') return 'afro';
  if (hairId === 'dreads' || hairId === 'box-braids') return 'dreads';
  return 'classic';
}

function topShapeOf(topId: Avatar['topId']): TopShape {
  if (topId === 'tank-top') return 'tank';
  if (topId === 'hoodie') return 'hoodie';
  return 'tshirt';
}

export interface AvatarPreviewProps {
  readonly avatar: Avatar;
  readonly className?: string;
}

/**
 * Original 2D representation of the five base-avatar contract fields.
 * Rounded volumes follow the art direction without requiring a 3D scene.
 * Rendering stays separate from draft ownership and server confirmation.
 */
export function AvatarPreview({ avatar, className }: AvatarPreviewProps) {
  const id = useId();
  const titleId = `${id}-title`;
  const volumeId = `${id}-volume`;
  const volume = `url(#${volumeId})`;
  const hairShape = hairShapeOf(avatar.hairId);
  const topShape = topShapeOf(avatar.topId);
  const hair = safeColor(avatar.hairColor, '#6C4D48');
  const clothing = safeColor(avatar.clothingColor, '#5B4F96');
  const shoulder = avatar.bodyId === 'male' ? 32 : 27;
  const left = 80 - shoulder;
  const right = 80 + shoulder;
  const torso = `M${left} 104 Q${left} 94 69 92 L91 92 Q${right} 94 ${right} 104 L${right - 5} 151 Q80 157 ${left + 5} 151 Z`;
  const head =
    'M62 26 Q45 26 45 44 L45 65 Q45 84 64 84 L96 84 Q115 84 115 65 L115 44 Q115 26 98 26 Z';

  return (
    <svg
      role="img"
      aria-labelledby={titleId}
      viewBox="0 0 160 210"
      className={cn('block h-auto w-full', className)}
      data-avatar-preview="true"
    >
      <title id={titleId}>
        {`${profileMessages.avatar.previewAlt} ${describeAvatar(avatar)}`}
      </title>
      <defs>
        <linearGradient id={volumeId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FFF9EB" stopOpacity="0.28" />
          <stop offset="0.45" stopColor="#FFF9EB" stopOpacity="0" />
          <stop offset="1" stopColor="#49364B" stopOpacity="0.18" />
        </linearGradient>
      </defs>

      {/* A quiet ground shadow anchors the complete human silhouette. */}
      <ellipse cx="80" cy="191" rx="38" ry="5" fill="#B5A7D6" opacity="0.25" />

      {/* Hair behind the face: each option has its own continuous silhouette. */}
      {hairShape === 'afro' && (
        <g fill={hair}>
          <path d="M39 64 Q29 54 36 43 Q27 29 41 22 Q39 10 54 12 Q61 1 74 9 Q88 1 98 11 Q114 6 119 21 Q133 24 127 39 Q137 51 124 63 L114 78 L44 78 Z" />
          <path
            d="M39 64 Q29 54 36 43 Q27 29 41 22 Q39 10 54 12 Q61 1 74 9 Q88 1 98 11 Q114 6 119 21 Q133 24 127 39 Q137 51 124 63 L114 78 L44 78 Z"
            fill={volume}
          />
        </g>
      )}
      {hairShape === 'classic' && (
        <g fill={hair}>
          <path d="M38 49 Q36 15 77 15 Q119 12 122 48 L124 92 Q113 99 102 91 L99 58 L60 58 L57 92 Q46 99 35 91 Z" />
          <path
            d="M38 49 Q36 15 77 15 Q119 12 122 48 L124 92 Q113 99 102 91 L99 58 L60 58 L57 92 Q46 99 35 91 Z"
            fill={volume}
          />
        </g>
      )}
      {hairShape === 'dreads' && (
        <g fill={hair}>
          <path d="M39 46 Q37 14 79 14 Q121 14 121 46 L117 77 L43 77 Z" />
          {[43, 55, 67, 81, 95, 107].map((x, index) => (
            <g key={x}>
              <rect
                x={x}
                y="31"
                width="11"
                height={index % 2 === 0 ? 56 : 49}
                rx="5.5"
              />
              <rect
                x={x}
                y="31"
                width="11"
                height={index % 2 === 0 ? 56 : 49}
                rx="5.5"
                fill={volume}
              />
            </g>
          ))}
        </g>
      )}

      {/* Compact legs and rounded shoes, with no invented equip controls. */}
      <g fill="#5B4F96">
        <path d="M57 145 L78 145 L76 179 Q67 184 57 179 Z" />
        <path d="M82 145 L103 145 L103 179 Q93 184 84 179 Z" />
      </g>
      <g fill={volume}>
        <path d="M57 145 L78 145 L76 179 Q67 184 57 179 Z" />
        <path d="M82 145 L103 145 L103 179 Q93 184 84 179 Z" />
      </g>
      <path
        d="M57 176 Q66 180 76 177 L77 186 Q65 191 51 186 Q49 180 57 176 Z"
        fill="#6C4D48"
      />
      <path
        d="M84 177 Q94 180 103 176 Q112 180 109 186 Q96 191 83 186 Z"
        fill="#6C4D48"
      />

      {/* Long, gently curved arms remain integrated with the garment. */}
      <g fill="none" strokeLinecap="round">
        <path
          d={`M${left + 3} 102 Q${left - 8} 123 ${left - 6} 149`}
          stroke={SKIN}
          strokeWidth="11"
        />
        <path
          d={`M${right - 3} 102 Q${right + 8} 123 ${right + 6} 149`}
          stroke={SKIN}
          strokeWidth="11"
        />
        {topShape !== 'tank' && (
          <>
            <path
              d={`M${left + 3} 102 Q${left - 4} 113 ${left - 5} ${topShape === 'hoodie' ? 139 : 116}`}
              stroke={clothing}
              strokeWidth="15"
            />
            <path
              d={`M${right - 3} 102 Q${right + 4} 113 ${right + 5} ${topShape === 'hoodie' ? 139 : 116}`}
              stroke={clothing}
              strokeWidth="15"
            />
          </>
        )}
      </g>
      <rect x="72" y="78" width="16" height="20" rx="6" fill={SKIN} />
      <rect x="72" y="78" width="16" height="20" rx="6" fill={volume} />
      <path d={torso} fill={clothing} />
      <path d={torso} fill={volume} />
      {topShape === 'tank' && (
        <path d="M68 92 Q80 113 92 92 L88 92 Q80 102 72 92 Z" fill={SKIN} />
      )}
      {topShape === 'tshirt' && (
        <path
          d="M70 93 Q80 103 90 93"
          fill="none"
          stroke="#49364B"
          strokeOpacity="0.22"
          strokeWidth="3"
        />
      )}
      {topShape === 'hoodie' && (
        <>
          <path
            d="M65 89 Q80 83 95 89 L102 99 Q94 109 80 101 Q66 109 58 99 Z"
            fill={clothing}
          />
          <path
            d="M65 89 Q80 83 95 89 L102 99 Q94 109 80 101 Q66 109 58 99 Z"
            fill={volume}
          />
          <path
            d="M73 104 L72 116 M87 104 L88 116"
            stroke="#FFF9EB"
            strokeOpacity="0.7"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M66 131 Q80 137 94 131 L95 140 Q80 146 65 140 Z"
            fill="#49364B"
            opacity="0.13"
          />
        </>
      )}

      {/* Wide rounded-cube head, small facial features, no dark contour. */}
      <rect x="40" y="54" width="12" height="18" rx="6" fill={SKIN} />
      <rect x="108" y="54" width="12" height="18" rx="6" fill={SKIN} />
      <path d={head} fill={SKIN} />
      <path d={head} fill={volume} />
      <ellipse cx="57" cy="68" rx="6" ry="3" fill="#ECA786" opacity="0.45" />
      <ellipse cx="103" cy="68" rx="6" ry="3" fill="#ECA786" opacity="0.45" />
      <circle cx="65" cy="59" r="2.3" fill={INK} />
      <circle cx="95" cy="59" r="2.3" fill={INK} />
      <path
        d="M73 70 Q80 76 87 70"
        fill="none"
        stroke={INK}
        strokeWidth="1.7"
        strokeLinecap="round"
      />

      {/* Broad front hair masses leave the eyes unobstructed. */}
      {hairShape === 'classic' && (
        <g fill={hair}>
          <path d="M43 47 Q39 21 75 20 Q111 15 117 47 Q96 44 84 31 Q70 46 43 47 Z" />
          <path
            d="M43 47 Q39 21 75 20 Q111 15 117 47 Q96 44 84 31 Q70 46 43 47 Z"
            fill={volume}
          />
        </g>
      )}
      {hairShape === 'afro' && (
        <g fill={hair}>
          <path d="M42 45 Q34 32 48 29 Q48 18 62 23 Q72 14 82 23 Q96 15 102 27 Q119 23 119 43 Q108 48 99 37 Q89 45 80 36 Q69 45 61 36 Q52 47 42 45 Z" />
          <path
            d="M42 45 Q34 32 48 29 Q48 18 62 23 Q72 14 82 23 Q96 15 102 27 Q119 23 119 43 Q108 48 99 37 Q89 45 80 36 Q69 45 61 36 Q52 47 42 45 Z"
            fill={volume}
          />
        </g>
      )}
      {hairShape === 'dreads' && (
        <g fill={hair}>
          {[47, 60, 73, 86, 99].map((x, index) => (
            <g key={x} transform={`rotate(${(index - 2) * 5} ${x + 6} 24)`}>
              <rect
                x={x}
                y="21"
                width="14"
                height={index % 2 === 0 ? 26 : 22}
                rx="7"
              />
              <rect
                x={x}
                y="21"
                width="14"
                height={index % 2 === 0 ? 26 : 22}
                rx="7"
                fill={volume}
              />
            </g>
          ))}
        </g>
      )}
    </svg>
  );
}
