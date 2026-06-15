// Self-contained extraction via the Figma REST API (FIGMA_TOKEN).
//
// This is the fallback path for when you are not running inside an MCP-enabled
// client: given a file key + node id and a personal access token, fetch the node
// tree and convert it to ParsedElement[].
//
// RULE ZERO governs every field: a property is set ONLY when the corresponding
// Figma field is genuinely present. No fills -> background stays null. No
// cornerRadius -> borderRadius stays null. Nothing is defaulted to 0/none.

import type { ParsedElement, ParsedCSS } from '../types.js';
import { toColon } from './figma-url.js';

const FIGMA_API = 'https://api.figma.com/v1';

/** Max meaningful nodes to pull out of one tree, so a skeleton stays a skeleton. */
const MAX_ELEMENTS = 100;

interface FigmaColor { r: number; g: number; b: number; a: number }
interface FigmaPaint { type: string; visible?: boolean; opacity?: number; color?: FigmaColor }
interface FigmaTypeStyle {
  fontFamily?: string;
  fontWeight?: number;
  fontSize?: number;
  lineHeightPx?: number;
  letterSpacing?: number;
}
interface FigmaNode {
  id: string;
  name?: string;
  type: string;
  fills?: FigmaPaint[];
  strokes?: FigmaPaint[];
  strokeWeight?: number;
  cornerRadius?: number;
  layoutMode?: 'HORIZONTAL' | 'VERTICAL' | 'NONE';
  itemSpacing?: number;
  paddingLeft?: number;
  paddingRight?: number;
  paddingTop?: number;
  paddingBottom?: number;
  absoluteBoundingBox?: { width?: number; height?: number } | null;
  style?: FigmaTypeStyle;
  characters?: string;
  children?: FigmaNode[];
}

function clampByte(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n * 255)));
}

function toHex(n: number): string {
  return clampByte(n).toString(16).padStart(2, '0');
}

/** Convert a Figma paint to a CSS color string, or null when there is nothing to emit. */
function paintToCss(paint: FigmaPaint | undefined): string | null {
  if (!paint || paint.visible === false || paint.type !== 'SOLID' || !paint.color) return null;
  const { r, g, b } = paint.color;
  const alpha = (paint.opacity ?? 1) * (paint.color.a ?? 1);
  if (alpha >= 1) return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  const a = Math.round(alpha * 1000) / 1000;
  return `rgba(${clampByte(r)}, ${clampByte(g)}, ${clampByte(b)}, ${a})`;
}

function firstVisibleFill(fills: FigmaPaint[] | undefined): FigmaPaint | undefined {
  if (!fills) return undefined;
  return fills.find((f) => f.visible !== false && f.type === 'SOLID');
}

function px(n: number | undefined): string | null {
  return typeof n === 'number' ? `${n}px` : null;
}

/** Convert a single Figma node into ParsedCSS. Absent fields stay null. */
function nodeToCss(node: FigmaNode): ParsedCSS {
  const isText = node.type === 'TEXT';
  const fill = firstVisibleFill(node.fills);
  const stroke = firstVisibleFill(node.strokes);
  const hasStroke = stroke !== undefined && typeof node.strokeWeight === 'number' && node.strokeWeight > 0;
  const auto = node.layoutMode === 'HORIZONTAL' || node.layoutMode === 'VERTICAL';

  return {
    // For text nodes the fill is the text color, not a background.
    background: isText ? null : paintToCss(fill),
    color: isText ? paintToCss(fill) : null,
    paddingTop: px(node.paddingTop),
    paddingRight: px(node.paddingRight),
    paddingBottom: px(node.paddingBottom),
    paddingLeft: px(node.paddingLeft),
    gap: auto ? px(node.itemSpacing) : null,
    fontSize: px(node.style?.fontSize),
    fontFamily: node.style?.fontFamily ?? null,
    fontWeight: typeof node.style?.fontWeight === 'number' ? String(node.style.fontWeight) : null,
    lineHeight: px(node.style?.lineHeightPx),
    letterSpacing: typeof node.style?.letterSpacing === 'number' && node.style.letterSpacing !== 0
      ? px(node.style.letterSpacing)
      : null,
    borderRadius: px(node.cornerRadius),
    borderWidth: hasStroke ? px(node.strokeWeight) : null,
    borderStyle: hasStroke ? 'solid' : null,
    borderColor: hasStroke ? paintToCss(stroke) : null,
    width: px(node.absoluteBoundingBox?.width),
    height: px(node.absoluteBoundingBox?.height),
    display: auto ? 'flex' : null,
    flexDirection: node.layoutMode === 'VERTICAL' ? 'column' : null,
  };
}

/** Decorative vector primitives we never treat as discrete elements. */
const SKIP_TYPES = new Set(['VECTOR', 'BOOLEAN_OPERATION', 'LINE', 'ELLIPSE', 'REGULAR_POLYGON', 'STAR', 'SLICE']);

function walk(node: FigmaNode, out: ParsedElement[]): void {
  if (out.length >= MAX_ELEMENTS) return;
  if (!SKIP_TYPES.has(node.type)) {
    const css = nodeToCss(node);
    const texts = node.type === 'TEXT' && node.characters ? [node.characters.trim()].filter(Boolean) : [];
    out.push({
      name: node.name ?? '',
      nodeId: node.id,
      classes: '',
      css,
      texts,
    });
  }
  if (node.children) {
    for (const child of node.children) {
      if (out.length >= MAX_ELEMENTS) break;
      walk(child, out);
    }
  }
}

/**
 * Fetch a Figma node tree over REST and convert it to ParsedElement[].
 * `token` defaults to process.env.FIGMA_TOKEN. Throws on missing token or API error.
 */
export async function extractViaRest(
  fileKey: string,
  nodeId: string,
  token: string | undefined = process.env.FIGMA_TOKEN,
  depth = 4,
): Promise<ParsedElement[]> {
  if (!token) {
    throw new Error('FIGMA_TOKEN is required for REST extraction. Set the env var or pass a token.');
  }
  const colonId = toColon(nodeId);
  const url = `${FIGMA_API}/files/${fileKey}/nodes?ids=${encodeURIComponent(colonId)}&depth=${depth}`;
  const res = await fetch(url, { headers: { 'X-Figma-Token': token } });
  if (!res.ok) {
    throw new Error(`Figma API ${res.status}: ${await res.text()}`);
  }
  const data = (await res.json()) as { nodes: Record<string, { document?: FigmaNode } | null> };
  const entry = data.nodes[colonId] ?? data.nodes[nodeId];
  if (!entry || !entry.document) {
    throw new Error(`No node document returned for ${nodeId}`);
  }
  const out: ParsedElement[] = [];
  walk(entry.document, out);
  return out;
}

/** Exposed for unit testing the tree -> ParsedElement[] conversion without a network call. */
export function nodeTreeToElements(root: FigmaNode): ParsedElement[] {
  const out: ParsedElement[] = [];
  walk(root, out);
  return out;
}
