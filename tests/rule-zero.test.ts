import { describe, it, expect } from 'vitest';
import { isAbsent, declare, cssBlock, assertNoAbsentEmitted } from '../src/rule-zero.js';

describe('RULE ZERO primitives', () => {
  it('treats null, undefined and blank as absent', () => {
    expect(isAbsent(null)).toBe(true);
    expect(isAbsent(undefined)).toBe(true);
    expect(isAbsent('   ')).toBe(true);
    expect(isAbsent('16px')).toBe(false);
    expect(isAbsent('0')).toBe(false); // a real "0" is a value, not absence
  });

  it('declare emits nothing for absent values', () => {
    expect(declare('gap', null)).toBe('');
    expect(declare('gap', undefined)).toBe('');
    expect(declare('gap', '')).toBe('');
    expect(declare('gap', '16px')).toBe('  gap: 16px;');
    expect(declare('gap', '16px', '    ')).toBe('    gap: 16px;');
  });

  it('cssBlock drops absent declarations', () => {
    const block = cssBlock([declare('display', 'flex'), declare('gap', null), declare('color', '#fff')]);
    expect(block).toBe('  display: flex;\n  color: #fff;');
    expect(block).not.toContain('gap');
  });

  it('assertNoAbsentEmitted throws when an absent value is present', () => {
    expect(() => assertNoAbsentEmitted({ display: 'flex' })).not.toThrow();
    expect(() => assertNoAbsentEmitted({ display: 'flex', gap: null })).toThrow(/RULE ZERO/);
  });
});
