// Map a ParsedElement's raw CSS values to design tokens.
//
// For each non-null property we try to find a matching token in the TokenMap.
// Matched -> "rawValue (--token-name)". Mappable but unmatched -> recorded in
// `unmapped` (the consumer decides token-vs-literal; we never invent a token).
// null properties are skipped entirely (RULE ZERO: absent stays absent).

import type { ParsedElement, MappedElement, TokenMap } from '../types.js';
import { encodeMapped } from './mapped-value.js';

const SPECIAL_COLOR_VALUES = new Set([
  'white', 'black', 'transparent', 'none', 'inherit', 'currentcolor',
]);

const COLOR_PROPS = new Set(['background', 'color', 'borderColor']);
const SPACING_PROPS = new Set(['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'gap']);
const PASSTHROUGH_PROPS = new Set([
  'fontFamily', 'borderWidth', 'borderStyle', 'width', 'height', 'display', 'flexDirection', 'letterSpacing',
]);

function parsePx(value: string): number | null {
  const m = value.match(/^([\d.]+)px$/);
  if (!m || m[1] === undefined) return null;
  return parseFloat(m[1]);
}

function mapValue(
  prop: string,
  value: string,
  tokens: TokenMap,
): { result: string; wasUnmapped: boolean } {
  if (COLOR_PROPS.has(prop)) {
    const lower = value.toLowerCase();
    if (SPECIAL_COLOR_VALUES.has(lower)) return { result: value, wasUnmapped: false };
    const token = tokens.colors.get(lower);
    if (token) return { result: encodeMapped(lower, token), wasUnmapped: false };
    return { result: value, wasUnmapped: true };
  }

  if (SPACING_PROPS.has(prop)) {
    const px = parsePx(value);
    if (px !== null) {
      const token = tokens.spacing.get(px);
      if (token) return { result: encodeMapped(value, token), wasUnmapped: false };
      return { result: value, wasUnmapped: true };
    }
    return { result: value, wasUnmapped: false };
  }

  if (prop === 'fontWeight') {
    const num = parseInt(value, 10);
    if (!isNaN(num)) {
      const token = tokens.fontWeights.get(num);
      if (token) return { result: encodeMapped(value, token), wasUnmapped: false };
      return { result: value, wasUnmapped: true };
    }
    return { result: value, wasUnmapped: false };
  }

  if (prop === 'fontSize') {
    const px = parsePx(value);
    if (px !== null) {
      const token = tokens.fontSizes.get(px);
      if (token) return { result: encodeMapped(value, token), wasUnmapped: false };
      return { result: value, wasUnmapped: true };
    }
    return { result: value, wasUnmapped: false };
  }

  if (prop === 'lineHeight') {
    const px = parsePx(value);
    if (px !== null) {
      const token = tokens.lineHeights.get(px);
      if (token) return { result: encodeMapped(value, token), wasUnmapped: false };
      return { result: value, wasUnmapped: true };
    }
    return { result: value, wasUnmapped: false };
  }

  if (prop === 'borderRadius') {
    const px = parsePx(value);
    if (px !== null) {
      const token = tokens.radii.get(px);
      if (token) return { result: encodeMapped(value, token), wasUnmapped: false };
      return { result: value, wasUnmapped: true };
    }
    return { result: value, wasUnmapped: false };
  }

  if (PASSTHROUGH_PROPS.has(prop)) return { result: value, wasUnmapped: false };

  return { result: value, wasUnmapped: false };
}

/** Map all non-null CSS values of a ParsedElement to tokens. */
export function mapElementToTokens(element: ParsedElement, tokens: TokenMap): MappedElement {
  const mapped: Record<string, string> = {};
  const unmapped: string[] = [];

  const css = element.css as unknown as Record<string, string | null>;

  for (const [prop, value] of Object.entries(css)) {
    if (value === null) continue;
    const { result, wasUnmapped } = mapValue(prop, value, tokens);
    mapped[prop] = result;
    if (wasUnmapped) unmapped.push(`${prop}: ${value}`);
  }

  return {
    name: element.name,
    nodeId: element.nodeId,
    raw: element.css,
    mapped,
    unmapped,
    texts: element.texts,
  };
}

/** Convenience: map a list of elements. */
export function mapElements(elements: ParsedElement[], tokens: TokenMap): MappedElement[] {
  return elements.map((el) => mapElementToTokens(el, tokens));
}
