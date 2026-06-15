// Generic design-token loader.
//
// Reads CSS custom properties (`--name: value;`) from a token stylesheet and
// builds reverse lookup maps (extracted value -> token name). It is design-system
// agnostic: categories are matched by configurable name patterns, not by any one
// project's prefix. The defaults recognize the conventions most token sets use
// (spacing/space/gap, font-size, font-weight, radius/rounded, line-height), so
// `--ds-*`, `--space-*`, `--color-*`, etc. files all work out of the box.

import { readFileSync } from 'node:fs';
import type { TokenMap } from '../types.js';

const REM_PX = 16;

/** Name patterns (lowercased substrings) that classify a custom property into a category. */
export interface TokenPatterns {
  spacing: string[];
  fontSize: string[];
  fontWeight: string[];
  radius: string[];
  lineHeight: string[];
}

export const DEFAULT_PATTERNS: TokenPatterns = {
  spacing: ['spacing', 'space', 'gap'],
  fontSize: ['font-size', 'fontsize', 'text-size'],
  fontWeight: ['font-weight', 'fontweight', 'weight'],
  radius: ['radius', 'radii', 'rounded', 'corner'],
  lineHeight: ['line-height', 'lineheight', 'leading'],
};

export interface TokenLoaderOptions {
  patterns?: Partial<TokenPatterns>;
  remPx?: number;
}

/** Parse all `--name: value;` declarations into a Map. */
function parseCustomProperties(css: string): Map<string, string> {
  const props = new Map<string, string>();
  const re = /--([\w-]+)\s*:\s*([^;]+);/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(css)) !== null) {
    props.set(`--${m[1]}`, (m[2] ?? '').trim());
  }
  return props;
}

/** Resolve a `var(--name)` reference chain to a literal, or null if unresolvable. */
function resolveVar(value: string, props: Map<string, string>, depth = 0): string | null {
  if (depth > 10) return null;
  const varMatch = value.match(/^var\(--([\w-]+)\)$/);
  if (!varMatch) return value;
  const refValue = props.get(`--${varMatch[1]}`);
  if (refValue === undefined) return null;
  return resolveVar(refValue, props, depth + 1);
}

function remToPx(value: string, remPx: number): number | null {
  const m = value.match(/^([\d.]+)rem$/);
  if (!m || m[1] === undefined) return null;
  return Math.round(parseFloat(m[1]) * remPx * 1000) / 1000;
}

function pxToNum(value: string): number | null {
  const m = value.match(/^([\d.]+)px$/);
  if (!m || m[1] === undefined) return null;
  return parseFloat(m[1]);
}

function matchesAny(name: string, patterns: string[]): boolean {
  const lower = name.toLowerCase();
  return patterns.some((p) => lower.includes(p));
}

/** Resolve a token value to a px number (rem or px or literal 0). */
function toPx(value: string, props: Map<string, string>, remPx: number): number | null {
  const resolved = resolveVar(value, props);
  if (resolved === null) return null;
  let px = remToPx(resolved, remPx);
  if (px === null) px = pxToNum(resolved);
  if (px === null && (resolved === '0' || resolved === '0rem' || resolved === '0px')) px = 0;
  return px;
}

/**
 * Build reverse lookup maps from a design-token CSS string.
 *
 * - Colors: any hex value -> shortest property name (primitives preferred over aliases).
 * - Spacing / font-size / radius / line-height: properties whose name matches the
 *   category patterns, with values resolved (through var() chains) to px.
 * - Font weights: properties matching the weight patterns with a numeric value.
 */
export function loadTokensFromCss(css: string, options: TokenLoaderOptions = {}): TokenMap {
  const patterns: TokenPatterns = {
    spacing: options.patterns?.spacing ?? DEFAULT_PATTERNS.spacing,
    fontSize: options.patterns?.fontSize ?? DEFAULT_PATTERNS.fontSize,
    fontWeight: options.patterns?.fontWeight ?? DEFAULT_PATTERNS.fontWeight,
    radius: options.patterns?.radius ?? DEFAULT_PATTERNS.radius,
    lineHeight: options.patterns?.lineHeight ?? DEFAULT_PATTERNS.lineHeight,
  };
  const remPx = options.remPx ?? REM_PX;

  const props = parseCustomProperties(css);

  const colors = new Map<string, string>();
  const spacing = new Map<number, string>();
  const fontSizes = new Map<number, string>();
  const fontWeights = new Map<number, string>();
  const radii = new Map<number, string>();
  const lineHeights = new Map<number, string>();

  // Colors: prefer the shortest name for a given hex (primitive over alias).
  for (const [name, value] of props) {
    if (/^#[0-9a-fA-F]{3,8}$/.test(value)) {
      const hexLower = value.toLowerCase();
      const existing = colors.get(hexLower);
      if (!existing || name.length < existing.length) colors.set(hexLower, name);
    }
  }

  for (const [name, value] of props) {
    // Font weight is a plain number, handled before the px categories.
    if (matchesAny(name, patterns.fontWeight)) {
      const resolved = resolveVar(value, props) ?? value;
      const num = parseInt(resolved, 10);
      if (!isNaN(num) && String(num) === resolved.trim() && !fontWeights.has(num)) {
        fontWeights.set(num, name);
        continue;
      }
    }
    if (matchesAny(name, patterns.spacing)) {
      const px = toPx(value, props, remPx);
      if (px !== null && !spacing.has(px)) spacing.set(px, name);
      continue;
    }
    if (matchesAny(name, patterns.fontSize)) {
      const px = toPx(value, props, remPx);
      if (px !== null && !fontSizes.has(px)) fontSizes.set(px, name);
      continue;
    }
    if (matchesAny(name, patterns.radius)) {
      const px = toPx(value, props, remPx);
      if (px !== null && !radii.has(px)) radii.set(px, name);
      continue;
    }
    if (matchesAny(name, patterns.lineHeight)) {
      const px = toPx(value, props, remPx);
      if (px !== null && !lineHeights.has(px)) lineHeights.set(px, name);
      continue;
    }
  }

  return { colors, spacing, fontSizes, fontWeights, radii, lineHeights };
}

/** Load and merge design-token maps from one or more CSS files. */
export function loadTokensFromFiles(files: string[], options: TokenLoaderOptions = {}): TokenMap {
  const merged = files.map((f) => readFileSync(f, 'utf-8')).join('\n');
  return loadTokensFromCss(merged, options);
}

/** An empty token map (no tokens) — produces literal-value output with no token refs. */
export function emptyTokenMap(): TokenMap {
  return {
    colors: new Map(),
    spacing: new Map(),
    fontSizes: new Map(),
    fontWeights: new Map(),
    radii: new Map(),
    lineHeights: new Map(),
  };
}
