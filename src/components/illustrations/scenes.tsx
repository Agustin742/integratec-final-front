import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/utils';

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

/** Small avatar: rounded-cube head, long torso, dot eyes and a smile. */
function Avatar({
  cx,
  base,
  body,
  hair,
}: {
  cx: number;
  base: number;
  body: string;
  hair: string;
}) {
  return (
    <g>
      <Shadow cx={cx} cy={base} rx={30} />
      <rect
        x={cx - 13}
        y={base - 26}
        width={11}
        height={26}
        rx={5}
        fill={c.woodDark}
      />
      <rect
        x={cx + 2}
        y={base - 26}
        width={11}
        height={26}
        rx={5}
        fill={c.woodDark}
      />
      <rect
        x={cx - 32}
        y={base - 70}
        width={11}
        height={42}
        rx={5.5}
        fill={body}
      />
      <rect
        x={cx + 21}
        y={base - 70}
        width={11}
        height={42}
        rx={5.5}
        fill={body}
      />
      <rect
        x={cx - 22}
        y={base - 76}
        width={44}
        height={56}
        rx={15}
        fill={body}
      />
      <rect
        x={cx - 21}
        y={base - 118}
        width={42}
        height={40}
        rx={13}
        fill={c.face}
      />
      <path
        d={`M${cx - 22} ${base - 100}v-8a13 13 0 0 1 13-13h18a13 13 0 0 1 13 13v8q-10-8-22-8q-12 0-22 8z`}
        fill={hair}
      />
      <circle cx={cx - 8} cy={base - 92} r={2.8} fill={c.ink} />
      <circle cx={cx + 8} cy={base - 92} r={2.8} fill={c.ink} />
      <path
        d={`M${cx - 6} ${base - 85}q6 6 12 0`}
        fill="none"
        stroke={c.ink}
        strokeWidth={2.6}
        strokeLinecap="round"
      />
    </g>
  );
}

/** Wide scene for the brand panel: window, blackboard, teacher desk, plant and two avatars. */
export function ClassroomScene({ className, ...props }: SceneProps) {
  return (
    <Svg
      {...props}
      viewBox="0 0 640 420"
      className={cn('rounded-3xl', className)}
    >
      <rect width={640} height={420} fill={c.wall} />
      {/* Floor */}
      <rect y={300} width={640} height={120} fill={c.sand} />
      <rect y={292} width={640} height={12} fill={c.woodDark} />
      <path
        d="M0 340H640M0 378H640M180 304V340M430 304V340M90 340V378M300 340V378M520 340V378M180 378V420M430 378V420"
        stroke={c.sandDark}
        strokeWidth={3}
        fill="none"
      />
      <ellipse
        cx={320}
        cy={372}
        rx={210}
        ry={34}
        fill={c.lavender}
        opacity={0.35}
      />

      {/* Window */}
      <rect x={40} y={56} width={158} height={138} rx={22} fill={c.woodDark} />
      <rect x={54} y={70} width={130} height={110} rx={13} fill={c.glass} />
      <rect x={116} y={70} width={6} height={110} fill={c.woodDark} />
      <rect x={54} y={122} width={130} height={6} fill={c.woodDark} />
      <circle cx={148} cy={98} r={14} fill={c.butter} />
      <path
        d="M66 112q2-12 15-12q5-8 15-4q12-2 13 10q8 2 6 10h-52q-1-3 3-4z"
        fill={c.wall}
      />
      <rect x={32} y={190} width={174} height={14} rx={7} fill={c.wood} />

      {/* Blackboard */}
      <rect x={232} y={44} width={258} height={158} rx={20} fill={c.wood} />
      <rect x={247} y={59} width={228} height={128} rx={11} fill={c.green} />
      <circle cx={326} cy={104} r={6} fill={c.wall} />
      <circle cx={396} cy={104} r={6} fill={c.wall} />
      <path
        d="M330 126q31 28 62 0"
        fill="none"
        stroke={c.wall}
        strokeWidth={6}
        strokeLinecap="round"
      />
      <path
        d="M268 160h64M346 160h38M268 78h34"
        fill="none"
        stroke={c.wall}
        strokeWidth={5}
        strokeLinecap="round"
        opacity={0.7}
      />
      <path
        d="M440 76l5 11 12 2-9 8 3 12-11-6-11 6 3-12-9-8 12-2z"
        fill={c.butter}
      />
      <rect x={262} y={192} width={170} height={10} rx={5} fill={c.woodDark} />
      <rect x={394} y={187} width={22} height={7} rx={3.5} fill={c.wall} />

      {/* Clock and plant */}
      <circle cx={566} cy={98} r={32} fill={c.wood} />
      <circle cx={566} cy={98} r={26} fill={c.wall} />
      <path
        d="M566 98V80M566 98l13 8"
        stroke={c.ink}
        strokeWidth={4}
        strokeLinecap="round"
        fill="none"
      />
      <Shadow cx={566} cy={300} rx={48} />
      <circle cx={566} cy={198} r={20} fill={c.green} />
      <circle cx={566} cy={222} r={30} fill={c.leaf} />
      <circle cx={538} cy={246} r={22} fill={c.grass} />
      <circle cx={594} cy={246} r={22} fill={c.grass} />
      <path d="M538 254h56l-6 44h-44z" fill={c.coral} />
      <rect x={532} y={248} width={68} height={12} rx={6} fill={c.coral} />

      {/* Teacher desk */}
      <rect x={270} y={236} width={186} height={22} rx={11} fill={c.wood} />
      <rect x={288} y={254} width={150} height={44} rx={9} fill={c.woodDark} />
      <rect x={338} y={268} width={50} height={8} rx={4} fill={c.sandDark} />
      <rect x={296} y={220} width={44} height={16} rx={5} fill={c.coral} />
      <rect x={301} y={205} width={36} height={15} rx={5} fill={c.teal} />
      <circle cx={410} cy={225} r={12} fill={c.coral} />
      <path
        d="M410 213q1-7 7-9"
        stroke={c.leaf}
        strokeWidth={3.5}
        strokeLinecap="round"
        fill="none"
      />

      {/* Avatars */}
      <Avatar cx={180} base={388} body={c.coral} hair={c.ink} />
      <Avatar cx={470} base={392} body={c.teal} hair={c.woodDark} />
    </Svg>
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
