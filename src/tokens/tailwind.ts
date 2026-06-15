// Standard Tailwind CSS scales as a reverse lookup map.
//
// For Tailwind targets we don't parse a config: Figma MCP already emits Tailwind
// utility classes, and these maps turn raw px/numeric values back into the
// canonical utility names (prefixed `tw-` to mark them as Tailwind utilities,
// not CSS custom properties). Colors are intentionally empty — they are
// project-specific and the MCP output already carries the right color classes.

import type { TokenMap } from '../types.js';

const SPACING_SCALE: Record<string, number> = {
  '0': 0, 'px': 1, '0.5': 2, '1': 4, '1.5': 6, '2': 8, '2.5': 10,
  '3': 12, '3.5': 14, '4': 16, '5': 20, '6': 24, '7': 28, '8': 32,
  '9': 36, '10': 40, '11': 44, '12': 48, '14': 56, '16': 64,
  '20': 80, '24': 96, '28': 112, '32': 128, '36': 144, '40': 160,
  '44': 176, '48': 192, '52': 208, '56': 224, '60': 240, '64': 256,
  '72': 288, '80': 320, '96': 384,
};

const FONT_WEIGHT_SCALE: Record<number, string> = {
  100: 'thin', 200: 'extralight', 300: 'light', 400: 'normal', 500: 'medium',
  600: 'semibold', 700: 'bold', 800: 'extrabold', 900: 'black',
};

const FONT_SIZE_SCALE: Record<number, string> = {
  12: 'text-xs', 14: 'text-sm', 16: 'text-base', 18: 'text-lg', 20: 'text-xl',
  24: 'text-2xl', 30: 'text-3xl', 36: 'text-4xl', 48: 'text-5xl', 60: 'text-6xl',
  72: 'text-7xl', 96: 'text-8xl', 128: 'text-9xl',
};

const RADII_SCALE: Record<number, string> = {
  0: 'rounded-none', 2: 'rounded-sm', 4: 'rounded', 6: 'rounded-md',
  8: 'rounded-lg', 12: 'rounded-xl', 16: 'rounded-2xl', 24: 'rounded-3xl',
};

/** Build reverse lookup maps for the standard Tailwind scale. */
export function loadTailwindTokens(): TokenMap {
  const spacing = new Map<number, string>();
  for (const [name, px] of Object.entries(SPACING_SCALE)) spacing.set(px, `tw-${name}`);

  const fontWeights = new Map<number, string>();
  for (const [weight, name] of Object.entries(FONT_WEIGHT_SCALE)) fontWeights.set(Number(weight), `tw-${name}`);

  const fontSizes = new Map<number, string>();
  for (const [px, name] of Object.entries(FONT_SIZE_SCALE)) fontSizes.set(Number(px), `tw-${name}`);

  const radii = new Map<number, string>();
  for (const [px, name] of Object.entries(RADII_SCALE)) radii.set(Number(px), `tw-${name}`);

  return { colors: new Map(), spacing, fontSizes, fontWeights, radii, lineHeights: new Map() };
}
