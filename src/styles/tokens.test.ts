import { existsSync, readFileSync } from 'node:fs';
import { expect, test } from 'vitest';

const path = 'src/styles/tokens.css';
const css = existsSync(path) ? readFileSync(path, 'utf8') : '';
const tokens = new Map(
  [...css.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map((match) => [
    match[1],
    match[2].trim(),
  ]),
);

function value(name: string): string {
  const token = tokens.get(name);
  if (!token) throw new Error(`Missing design token: ${name}`);
  const reference = /^var\((--[\w-]+)\)$/.exec(token);
  return reference ? value(reference[1]) : token;
}

function luminance(hex: string): number {
  expect(hex).toMatch(/^#[\da-f]{6}$/i);
  const [red, green, blue] = [1, 3, 5].map((offset) => {
    const channel = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return channel <= 0.04045
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

const textPairs = [
  ['foreground', 'background'],
  ['card-foreground', 'card'],
  ['popover-foreground', 'popover'],
  ['primary-foreground', 'primary'],
  ['secondary-foreground', 'secondary'],
  ['muted-foreground', 'muted'],
  ['accent-foreground', 'accent'],
  ['destructive-foreground', 'destructive'],
] as const;

test.each(textPairs)(
  '%s on %s meets WCAG AA normal-text contrast',
  (text, background) => {
    const colors = [
      luminance(value(`--${text}`)),
      luminance(value(`--${background}`)),
    ];
    expect(
      (Math.max(...colors) + 0.05) / (Math.min(...colors) + 0.05),
    ).toBeGreaterThanOrEqual(4.5);
  },
);

test('maps the documented warm palette and defines shape, space and type tokens', () => {
  const palette = {
    cream: '#FFF0D8',
    creamPale: '#FFF9EB',
    sand: '#E9C99B',
    wood: '#AF7B52',
    coral: '#E66861',
    teal: '#62CFC7',
    butter: '#F7D86B',
    lavender: '#B5A7D6',
    grass: '#A6D96A',
    leaf: '#65B96A',
    green: '#3E8654',
    ink: '#382F3F',
  };
  for (const [name, hex] of Object.entries(palette))
    expect(value(`--palette-${name}`).toUpperCase()).toBe(hex);
  expect(value('--radius')).toBe('0.75rem');
  expect(value('--spacing')).toBe('0.25rem');
  expect(value('--font-body')).toContain('system-ui');
});

test.each(['background', 'card'])(
  'focus ring contrasts with %s',
  (background) => {
    const colors = [
      luminance(value('--ring')),
      luminance(value(`--${background}`)),
    ];
    expect(
      (Math.max(...colors) + 0.05) / (Math.min(...colors) + 0.05),
    ).toBeGreaterThanOrEqual(3);
  },
);
