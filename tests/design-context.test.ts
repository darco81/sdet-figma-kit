import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseDesignContext } from '../src/extract/design-context.js';
import type { ParsedElement } from '../src/types.js';

const fixture = readFileSync(join(__dirname, 'fixtures/price-tag.design-context.txt'), 'utf-8');

function byName(els: ParsedElement[], name: string): ParsedElement {
  const el = els.find((e) => e.name === name);
  if (!el) throw new Error(`element ${name} not found`);
  return el;
}

describe('parseDesignContext', () => {
  const els = parseDesignContext(fixture);

  it('extracts all named elements with the root first', () => {
    expect(els.length).toBe(3);
    expect(els[0]?.name).toBe('PriceTag'); // outermost container is element[0]
  });

  it('parses container layout/box values', () => {
    const root = byName(els, 'PriceTag');
    expect(root.css.display).toBe('flex');
    expect(root.css.flexDirection).toBe('column');
    expect(root.css.gap).toBe('16px');
    expect(root.css.paddingTop).toBe('24px');
    expect(root.css.paddingLeft).toBe('24px');
    expect(root.css.background).toBe('#ffffff');
    expect(root.css.borderRadius).toBe('8px');
    expect(root.css.borderWidth).toBe('1px');
    expect(root.css.borderStyle).toBe('solid');
    expect(root.css.borderColor).toBe('#e5e5e5');
  });

  it('parses text element typography and var() fallback colors', () => {
    const price = byName(els, 'Price');
    expect(price.css.fontFamily).toBe('Inter');
    expect(price.css.fontWeight).toBe('700');
    expect(price.css.fontSize).toBe('24px');
    expect(price.css.lineHeight).toBe('32px');
    expect(price.css.color).toBe('#2a2a2a'); // from text-[color:var(--text,#2a2a2a)]
    expect(price.texts).toContain('99,00 zł');
  });

  it('RULE ZERO: a text element with no rounded class has borderRadius null', () => {
    const price = byName(els, 'Price');
    expect(price.css.borderRadius).toBeNull();
    expect(price.css.gap).toBeNull();
    expect(price.css.background).toBeNull();
  });

  it('parses the second text element', () => {
    const label = byName(els, 'Label');
    expect(label.css.fontWeight).toBe('400');
    expect(label.css.fontSize).toBe('14px');
    expect(label.css.color).toBe('#888888');
    expect(label.texts).toContain('Cena brutto');
  });
});
