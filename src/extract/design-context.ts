// Parse Figma MCP `get_design_context` output (React + Tailwind JSX) into a
// structured ParsedElement[]. This is the MCP-primary extraction path: an
// MCP-enabled client (Claude Code, Cursor, ...) fetches the design context and
// the text is fed here. No network happens in this module — it is a pure parser.
//
// Values come ONLY from the generated code, never from a screenshot. Absent
// properties stay null (RULE ZERO, see rule-zero.ts).

import type { ParsedElement, ParsedCSS } from '../types.js';

/** SVG drawing primitives that never map to discrete DOM elements. Filtered by default. */
const LEAF_TAGS = new Set([
  'path', 'circle', 'rect', 'line', 'polygon', 'polyline', 'ellipse', 'defs', 'use', 'image',
]);

/** Figma font-weight names -> numeric value. */
const WEIGHT_MAP: Record<string, string> = {
  Thin: '100',
  ExtraLight: '200',
  UltraLight: '200',
  Light: '300',
  Regular: '400',
  Normal: '400',
  Medium: '500',
  SemiBold: '600',
  DemiBold: '600',
  Bold: '700',
  ExtraBold: '800',
  UltraBold: '800',
  Black: '900',
  Heavy: '900',
};

function emptyCss(): ParsedCSS {
  return {
    background: null,
    paddingTop: null,
    paddingRight: null,
    paddingBottom: null,
    paddingLeft: null,
    gap: null,
    fontSize: null,
    fontFamily: null,
    fontWeight: null,
    lineHeight: null,
    letterSpacing: null,
    color: null,
    borderRadius: null,
    borderWidth: null,
    borderStyle: null,
    borderColor: null,
    width: null,
    height: null,
    display: null,
    flexDirection: null,
  };
}

/** Extract the fallback from `var(--name,fallback)` or return a plain bracket value. */
function extractValue(bracketContent: string): string {
  const varMatch = bracketContent.match(/^var\(--[^,]+,\s*(.+)\)$/);
  if (varMatch && varMatch[1]) return varMatch[1].trim();
  return bracketContent;
}

/** Extract a value from the `color:var(--name,value)` prefix pattern. */
function extractColorValue(bracketContent: string): string | null {
  const match = bracketContent.match(/^color:(.+)$/);
  if (!match || !match[1]) return null;
  return extractValue(match[1]);
}

/** Parse a Tailwind class string into CSS properties (mutates `css`). */
function parseClasses(classStr: string, css: ParsedCSS): void {
  const classes = classStr.split(/\s+/).filter(Boolean);

  let hasBorder = false;
  let hasBorderSolid = false;

  for (const cls of classes) {
    const bgMatch = cls.match(/^bg-\[(.+)\]$/);
    if (bgMatch && bgMatch[1]) { css.background = extractValue(bgMatch[1]); continue; }

    const pxMatch = cls.match(/^px-\[(.+)\]$/);
    if (pxMatch && pxMatch[1]) {
      const val = extractValue(pxMatch[1]);
      css.paddingLeft = val;
      css.paddingRight = val;
      continue;
    }

    const pyMatch = cls.match(/^py-\[(.+)\]$/);
    if (pyMatch && pyMatch[1]) {
      const val = extractValue(pyMatch[1]);
      css.paddingTop = val;
      css.paddingBottom = val;
      continue;
    }

    const pAllMatch = cls.match(/^p-\[(.+)\]$/);
    if (pAllMatch && pAllMatch[1]) {
      const val = extractValue(pAllMatch[1]);
      css.paddingTop = val;
      css.paddingRight = val;
      css.paddingBottom = val;
      css.paddingLeft = val;
      continue;
    }

    const plMatch = cls.match(/^pl-\[(.+)\]$/);
    if (plMatch && plMatch[1]) { css.paddingLeft = extractValue(plMatch[1]); continue; }

    const prMatch = cls.match(/^pr-\[(.+)\]$/);
    if (prMatch && prMatch[1]) { css.paddingRight = extractValue(prMatch[1]); continue; }

    const ptMatch = cls.match(/^pt-\[(.+)\]$/);
    if (ptMatch && ptMatch[1]) { css.paddingTop = extractValue(ptMatch[1]); continue; }

    const pbMatch = cls.match(/^pb-\[(.+)\]$/);
    if (pbMatch && pbMatch[1]) { css.paddingBottom = extractValue(pbMatch[1]); continue; }

    const gapMatch = cls.match(/^gap-\[(.+)\]$/);
    if (gapMatch && gapMatch[1]) { css.gap = extractValue(gapMatch[1]); continue; }

    // font-['Family:Weight',sans-serif] or font-['Family:Weight']
    const fontMatch = cls.match(/^font-\['([^']+)'(?:,[^\]]+)?\]$/);
    if (fontMatch && fontMatch[1]) {
      const parts = fontMatch[1].split(':');
      css.fontFamily = parts[0] ?? null;
      if (parts[1] && WEIGHT_MAP[parts[1]]) {
        css.fontWeight = WEIGHT_MAP[parts[1]] ?? null;
      }
      continue;
    }

    const textMatch = cls.match(/^text-\[(.+)\]$/);
    if (textMatch && textMatch[1]) {
      const inner = textMatch[1];
      const colorVal = extractColorValue(inner);
      if (colorVal !== null) {
        css.color = colorVal;
      } else {
        css.fontSize = extractValue(inner);
      }
      continue;
    }

    const leadingMatch = cls.match(/^leading-\[(.+)\]$/);
    if (leadingMatch && leadingMatch[1]) { css.lineHeight = extractValue(leadingMatch[1]); continue; }

    const roundedMatch = cls.match(/^rounded-\[(.+)\]$/);
    if (roundedMatch && roundedMatch[1]) { css.borderRadius = extractValue(roundedMatch[1]); continue; }
    if (cls.startsWith('rounded')) {
      if (cls === 'rounded-none') css.borderRadius = '0px';
      continue;
    }

    if (cls === 'border') { hasBorder = true; continue; }
    if (cls === 'border-solid') { hasBorderSolid = true; continue; }
    const borderColorMatch = cls.match(/^border-\[(.+)\]$/);
    if (borderColorMatch && borderColorMatch[1]) { css.borderColor = extractValue(borderColorMatch[1]); continue; }

    const hMatch = cls.match(/^h-\[(.+)\]$/);
    if (hMatch && hMatch[1]) { css.height = extractValue(hMatch[1]); continue; }

    const wMatch = cls.match(/^w-\[(.+)\]$/);
    if (wMatch && wMatch[1]) { css.width = extractValue(wMatch[1]); continue; }

    if (cls === 'flex') { css.display = 'flex'; continue; }
    if (cls === 'flex-col') { css.flexDirection = 'column'; continue; }
  }

  if (hasBorder) css.borderWidth = '1px';
  if (hasBorderSolid) css.borderStyle = 'solid';

  // RULE ZERO: leave borderRadius null when no rounded-* class is present.
  // Synthesizing '0px' would invent a value the design never specified.
  // Absent = "the design did not specify" — which is the truth.
}

interface TagInfo {
  tagName: string;
  attrs: Record<string, string>;
  className: string;
  outerStart: number;
  outerEnd: number;
  innerStart: number;
  innerEnd: number;
  selfClosing: boolean;
}

function findClosingTag(input: string, tagName: string, startFrom: number): number {
  let depth = 1;
  const openPattern = new RegExp(`<${tagName}[\\s/>]`, 'g');
  const closePattern = new RegExp(`</${tagName}>`, 'g');

  const events: Array<{ pos: number; type: 'open' | 'close' }> = [];

  openPattern.lastIndex = startFrom;
  let m: RegExpExecArray | null;
  while ((m = openPattern.exec(input)) !== null) {
    const tagEnd = input.indexOf('>', m.index);
    if (tagEnd !== -1 && input[tagEnd - 1] !== '/') {
      events.push({ pos: m.index, type: 'open' });
    }
  }

  closePattern.lastIndex = startFrom;
  while ((m = closePattern.exec(input)) !== null) {
    events.push({ pos: m.index, type: 'close' });
  }

  events.sort((a, b) => a.pos - b.pos);

  for (const event of events) {
    if (event.type === 'open') {
      depth++;
    } else {
      depth--;
      if (depth === 0) return event.pos + `</${tagName}>`.length;
    }
  }

  return -1;
}

function parseJsxElements(input: string): TagInfo[] {
  const elements: TagInfo[] = [];
  const tagRegex = /<([a-zA-Z][a-zA-Z0-9]*)\s([^>]*?)(\/?)>/g;
  let match: RegExpExecArray | null;

  while ((match = tagRegex.exec(input)) !== null) {
    const tagName = match[1] ?? '';
    const attrsStr = match[2] ?? '';
    const selfClosing = match[3] === '/';
    const outerStart = match.index;
    const innerStart = match.index + match[0].length;

    const attrs: Record<string, string> = {};
    let className = '';

    const classMatch = attrsStr.match(/className="([^"]*)"/);
    if (classMatch && classMatch[1] !== undefined) className = classMatch[1];

    const nameMatch = attrsStr.match(/data-name="([^"]*)"/);
    if (nameMatch && nameMatch[1] !== undefined) attrs['data-name'] = nameMatch[1];

    const nodeIdMatch = attrsStr.match(/data-node-id="([^"]*)"/);
    if (nodeIdMatch && nodeIdMatch[1] !== undefined) attrs['data-node-id'] = nodeIdMatch[1];

    let outerEnd: number;
    let innerEnd: number;

    if (selfClosing) {
      outerEnd = innerStart;
      innerEnd = innerStart;
    } else {
      outerEnd = findClosingTag(input, tagName, innerStart);
      innerEnd = outerEnd > 0 ? outerEnd - `</${tagName}>`.length : innerStart;
    }

    elements.push({
      tagName,
      attrs,
      className,
      outerStart,
      outerEnd: outerEnd > 0 ? outerEnd : innerStart,
      innerStart,
      innerEnd: innerEnd > 0 ? innerEnd : innerStart,
      selfClosing,
    });
  }

  return elements;
}

function isDescendant(child: TagInfo, parent: TagInfo): boolean {
  return child.outerStart > parent.innerStart && child.outerEnd <= parent.innerEnd;
}

/**
 * Text belonging to a tracked element: its own direct text plus text inside any
 * non-tracked child tags (which are visually part of it), but excluding the inner
 * content of any deeper tracked element (that text belongs to the deeper element).
 */
function textForElement(input: string, tag: TagInfo, trackedTags: TagInfo[]): string[] {
  const holes = trackedTags
    .filter((d) => d !== tag && isDescendant(d, tag))
    .map((d) => [d.innerStart, d.innerEnd] as const)
    .sort((a, b) => a[0] - b[0]);

  let inner = '';
  let cursor = tag.innerStart;
  for (const [hs, he] of holes) {
    if (hs > cursor) inner += input.slice(cursor, Math.min(hs, tag.innerEnd));
    cursor = Math.max(cursor, he);
    if (cursor >= tag.innerEnd) break;
  }
  if (cursor < tag.innerEnd) inner += input.slice(cursor, tag.innerEnd);

  // Remove remaining tag markup, then collect non-empty text runs.
  return inner
    .replace(/<[^>]*>/g, '\n')
    .split('\n')
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith('//') && !s.includes('{'));
}

/**
 * Parse a Figma `get_design_context` payload (React + Tailwind JSX) into
 * structured per-element CSS. Pass `{ includeLeaves: true }` to keep SVG
 * drawing primitives (debug / back-compat).
 */
export function parseDesignContext(
  input: string,
  opts: { includeLeaves?: boolean } = {},
): ParsedElement[] {
  const rawTags = parseJsxElements(input);
  const tags = opts.includeLeaves
    ? rawTags
    : rawTags.filter((t) => !LEAF_TAGS.has(t.tagName.toLowerCase()));
  const results: ParsedElement[] = [];

  const trackedTags = tags
    .filter((t) => t.attrs['data-node-id'])
    .sort((a, b) => (a.outerEnd - a.outerStart) - (b.outerEnd - b.outerStart));

  // Build results in document order so the outermost element (the container /
  // root) comes first — the generators rely on elements[0] being the root.
  const buildOrder = [...trackedTags].sort((a, b) => a.outerStart - b.outerStart);

  for (const tag of buildOrder) {
    const name = tag.attrs['data-name'] || '';
    const nodeId = tag.attrs['data-node-id'] || '';

    const texts = textForElement(input, tag, trackedTags);
    if (!name && texts.length === 0 && !tag.className.includes('font-')) continue;

    const css = emptyCss();

    if (tag.className) parseClasses(tag.className, css);

    // Anonymous elements: merge classes from child tags without their own node id.
    if (!name) {
      const childTags = tags.filter(
        (t) =>
          t.outerStart > tag.innerStart &&
          t.outerEnd <= tag.innerEnd &&
          !t.attrs['data-node-id'],
      );
      for (const child of childTags) {
        if (child.className) parseClasses(child.className, css);
      }
    }

    results.push({ name, nodeId, classes: tag.className, css, texts });
  }

  return results;
}
