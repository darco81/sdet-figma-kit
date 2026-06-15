import { describe, it, expect } from 'vitest';
import { nodeTreeToElements } from '../src/extract/rest.js';

// A minimal Figma node tree (the shape /v1/files/.../nodes returns under .document).
const tree = {
  id: '1:2',
  name: 'PriceTag',
  type: 'FRAME',
  layoutMode: 'VERTICAL' as const,
  itemSpacing: 16,
  paddingTop: 24,
  paddingRight: 24,
  paddingBottom: 24,
  paddingLeft: 24,
  cornerRadius: 8,
  absoluteBoundingBox: { width: 200, height: 120 },
  fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 } }],
  strokes: [{ type: 'SOLID', color: { r: 0.9, g: 0.9, b: 0.9, a: 1 } }],
  strokeWeight: 1,
  children: [
    {
      id: '1:3',
      name: 'Price',
      type: 'TEXT',
      characters: '99,00 zł',
      style: { fontFamily: 'Inter', fontWeight: 700, fontSize: 24, lineHeightPx: 32 },
      fills: [{ type: 'SOLID', color: { r: 0.165, g: 0.165, b: 0.165, a: 1 } }],
      // no cornerRadius, no padding, no layoutMode
    },
    {
      id: '1:4',
      name: 'Decoration',
      type: 'VECTOR', // should be skipped
      fills: [{ type: 'SOLID', color: { r: 0, g: 0, b: 0, a: 1 } }],
    },
  ],
};

describe('nodeTreeToElements (REST extraction)', () => {
  const els = nodeTreeToElements(tree);

  it('skips decorative vector nodes', () => {
    expect(els.map((e) => e.name)).toEqual(['PriceTag', 'Price']);
  });

  it('converts auto-layout frame to flex box values', () => {
    const root = els[0]!;
    expect(root.css.display).toBe('flex');
    expect(root.css.flexDirection).toBe('column');
    expect(root.css.gap).toBe('16px');
    expect(root.css.paddingTop).toBe('24px');
    expect(root.css.background).toBe('#ffffff');
    expect(root.css.borderRadius).toBe('8px');
    expect(root.css.borderWidth).toBe('1px');
    expect(root.css.borderStyle).toBe('solid');
    expect(root.css.borderColor).toBe('#e6e6e6'); // 0.9 * 255 = 229.5 -> 230 -> 0xe6
    expect(root.css.width).toBe('200px');
  });

  it('converts a text node: fill is color, not background', () => {
    const price = els[1]!;
    expect(price.css.fontSize).toBe('24px');
    expect(price.css.fontWeight).toBe('700');
    expect(price.css.fontFamily).toBe('Inter');
    expect(price.css.lineHeight).toBe('32px');
    expect(price.css.color).toBe('#2a2a2a');
    expect(price.css.background).toBeNull();
    expect(price.texts).toEqual(['99,00 zł']);
  });

  it('RULE ZERO: absent Figma fields stay null (no fabricated 0)', () => {
    const price = els[1]!;
    expect(price.css.borderRadius).toBeNull(); // no cornerRadius on the node
    expect(price.css.gap).toBeNull(); // not an auto-layout node
    expect(price.css.paddingTop).toBeNull();
  });
});
