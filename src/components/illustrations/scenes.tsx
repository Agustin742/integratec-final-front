import type { ComponentProps, ReactNode } from 'react';

/**
 * Decorative classroom scenes (`rules/art-direction.md`: beveled modules with
 * rounded forms, warm base, lavender shadows and no black outlines). They are
 * flat, original drawings built only from the design tokens through
 * `var(--...)` presentation attributes, so they follow any token change and
 * need no inline style.
 *
 * They carry no meaning: the text next to them says everything, so every
 * scene is `aria-hidden` and never focusable.
 */
const c = {
  wall: 'var(--palette-creamPale)',
  cream: 'var(--palette-cream)',
  sand: 'var(--palette-sand)',
  sandDark: 'var(--key-sand)',
  wood: 'var(--palette-wood)',
  woodDark: 'var(--key-secondary)',
  coral: 'var(--palette-coral)',
  teal: 'var(--palette-teal)',
  butter: 'var(--palette-butter)',
  lavender: 'var(--palette-lavender)',
  grass: 'var(--palette-grass)',
  leaf: 'var(--palette-leaf)',
  green: 'var(--palette-green)',
  ink: 'var(--palette-ink)',
  glass: 'var(--info)',
  tray: 'var(--tray)',
  face: 'var(--tray-hover)',
} as const;

export type SceneProps = Omit<
  ComponentProps<'svg'>,
  'viewBox' | 'aria-hidden' | 'children' | 'focusable'
>;

function Svg({
  viewBox,
  children,
  ...props
}: SceneProps & { viewBox: string; children?: ReactNode }) {
  return (
    <svg {...props} viewBox={viewBox} aria-hidden="true" focusable="false">
      {children}
    </svg>
  );
}

/** Soft contact shadow: lavender, never black. */
function Shadow({ cx, cy, rx }: { cx: number; cy: number; rx: number }) {
  return (
    <ellipse
      cx={cx}
      cy={cy}
      rx={rx}
      ry={rx / 5}
      fill={c.lavender}
      opacity={0.45}
    />
  );
}

/** Shared backdrop for the small error scenes: a warm rounded room with a floor. */
function Room({ children, ...props }: SceneProps & { children?: ReactNode }) {
  return (
    <Svg {...props} viewBox="0 0 240 180">
      <rect width={240} height={180} rx={36} fill={c.tray} />
      <path
        d="M0 142H240V144a36 36 0 0 1-36 36H36A36 36 0 0 1 0 144z"
        fill={c.sand}
      />
      <rect y={136} width={240} height={8} fill={c.woodDark} />
      {children}
    </Svg>
  );
}

/** 404: a chalk question mark and an empty desk and chair. */
export function NotFoundScene(props: SceneProps) {
  return (
    <Room {...props}>
      <rect x={56} y={20} width={128} height={78} rx={14} fill={c.wood} />
      <rect x={66} y={30} width={108} height={58} rx={8} fill={c.green} />
      <path
        d="M108 50q0-10 12-10t12 9q0 7-12 11v5"
        fill="none"
        stroke={c.wall}
        strokeWidth={5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={120} cy={76} r={3.6} fill={c.wall} />
      <Shadow cx={120} cy={160} rx={86} />
      <rect x={76} y={114} width={88} height={13} rx={6.5} fill={c.wood} />
      <rect x={86} y={126} width={8} height={32} rx={4} fill={c.woodDark} />
      <rect x={146} y={126} width={8} height={32} rx={4} fill={c.woodDark} />
      <rect x={176} y={138} width={32} height={9} rx={4.5} fill={c.coral} />
      <rect x={202} y={112} width={8} height={36} rx={4} fill={c.coral} />
      <rect x={180} y={147} width={7} height={12} rx={3.5} fill={c.woodDark} />
      <rect x={200} y={147} width={7} height={12} rx={3.5} fill={c.woodDark} />
    </Room>
  );
}

/** 403: a closed classroom door with a padlock sign. */
export function ForbiddenScene(props: SceneProps) {
  return (
    <Room {...props}>
      <rect x={70} y={10} width={100} height={134} rx={20} fill={c.wood} />
      <rect x={79} y={19} width={82} height={125} rx={13} fill={c.teal} />
      <rect x={96} y={32} width={48} height={30} rx={9} fill={c.glass} />
      <circle cx={151} cy={90} r={6} fill={c.butter} />
      <circle cx={120} cy={72} r={3.2} fill={c.woodDark} />
      <path
        d="M120 72L103 96M120 72L137 96"
        stroke={c.woodDark}
        strokeWidth={2}
        strokeLinecap="round"
      />
      <rect x={98} y={94} width={44} height={34} rx={9} fill={c.butter} />
      <rect x={112} y={110} width={16} height={13} rx={3.5} fill={c.ink} />
      <path
        d="M115 110v-4a5 5 0 0 1 10 0v4"
        fill="none"
        stroke={c.ink}
        strokeWidth={3}
        strokeLinecap="round"
      />
      <rect x={82} y={147} width={76} height={10} rx={5} fill={c.lavender} />
    </Room>
  );
}

/** Unexpected error: books that fell off the shelf. */
export function UnexpectedScene(props: SceneProps) {
  return (
    <Room {...props}>
      <rect x={34} y={74} width={172} height={11} rx={5.5} fill={c.wood} />
      <rect x={44} y={36} width={15} height={38} rx={4} fill={c.coral} />
      <rect x={62} y={44} width={13} height={30} rx={4} fill={c.teal} />
      <rect x={78} y={32} width={16} height={42} rx={4} fill={c.butter} />
      <rect
        x={176}
        y={38}
        width={15}
        height={36}
        rx={4}
        fill={c.lavender}
        transform="rotate(14 183 74)"
      />
      <Shadow cx={118} cy={158} rx={88} />
      <rect x={54} y={136} width={96} height={22} rx={6} fill={c.coral} />
      <rect
        x={60}
        y={116}
        width={84}
        height={20}
        rx={6}
        fill={c.teal}
        transform="rotate(-9 102 126)"
      />
      <rect
        x={146}
        y={132}
        width={62}
        height={22}
        rx={6}
        fill={c.butter}
        transform="rotate(28 177 143)"
      />
      <rect
        x={66}
        y={141}
        width={72}
        height={4}
        rx={2}
        fill={c.wall}
        opacity={0.6}
      />
      <rect
        x={118}
        y={86}
        width={34}
        height={24}
        rx={4}
        fill={c.wall}
        transform="rotate(-16 135 98)"
      />
      <rect
        x={150}
        y={96}
        width={30}
        height={22}
        rx={4}
        fill={c.cream}
        transform="rotate(12 165 107)"
      />
      <path d="M102 100l3 7 7 3-7 3-3 7-3-7-7-3 7-3z" fill={c.butter} />
    </Room>
  );
}

/** Stale chunk: a board on an easel with a refresh arrow and a "new" badge. */
export function StaleScene(props: SceneProps) {
  return (
    <Room {...props}>
      <path
        d="M86 112L74 148M154 112L166 148M120 112V146"
        stroke={c.woodDark}
        strokeWidth={7}
        strokeLinecap="round"
      />
      <Shadow cx={120} cy={158} rx={70} />
      <rect x={46} y={18} width={148} height={98} rx={16} fill={c.wood} />
      <rect x={58} y={30} width={124} height={74} rx={9} fill={c.green} />
      <path
        d="M120 50A17 17 0 1 1 103 67"
        fill="none"
        stroke={c.wall}
        strokeWidth={6}
        strokeLinecap="round"
      />
      <path d="M94 66h18l-9-13z" fill={c.wall} />
      <rect x={58} y={106} width={124} height={8} rx={4} fill={c.woodDark} />
      <rect x={140} y={101} width={20} height={6} rx={3} fill={c.wall} />
      <circle cx={186} cy={30} r={19} fill={c.coral} />
      <path
        d="M186 19l3.6 7.4 8.1 1.2-5.9 5.7 1.4 8.1-7.2-3.8-7.2 3.8 1.4-8.1-5.9-5.7 8.1-1.2z"
        fill={c.wall}
      />
    </Room>
  );
}
