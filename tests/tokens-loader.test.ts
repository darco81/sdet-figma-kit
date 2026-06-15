import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadTokensFromCss } from '../src/tokens/loader.js';

const tokensCss = readFileSync(join(__dirname, 'fixtures/tokens.css'), 'utf-8');

describe('loadTokensFromCss (generic)', () => {
  const t = loadTokensFromCss(tokensCss);

  it('maps colors to the shortest matching name', () => {
    expect(t.colors.get('#2a2a2a')).toBe('--gray-900');
    expect(t.colors.get('#888888')).toBe('--gray-400');
    expect(t.colors.get('#ffffff')).toBe('--white');
  });

  it('resolves rem spacing to px', () => {
    expect(t.spacing.get(8)).toBe('--space-2');
    expect(t.spacing.get(16)).toBe('--space-4');
    expect(t.spacing.get(24)).toBe('--space-6');
  });

  it('classifies font sizes, weights, radii and line heights by name pattern', () => {
    expect(t.fontSizes.get(14)).toBe('--font-size-sm');
    expect(t.fontSizes.get(24)).toBe('--font-size-2xl');
    expect(t.fontWeights.get(400)).toBe('--font-weight-regular');
    expect(t.fontWeights.get(700)).toBe('--font-weight-bold');
    expect(t.radii.get(8)).toBe('--radius-md');
    expect(t.lineHeights.get(32)).toBe('--line-height-tight');
  });
});

describe('loadTokensFromCss (any design-system prefix works)', () => {
  it('classifies arbitrarily prefixed tokens with the default patterns', () => {
    const css = `:root {
      --ds-spacing-4: 1rem;
      --ds-font-size-lg: 1.125rem;
      --ds-font-weight-bold: 700;
      --ds-radius-lg: 12px;
      --ds-line-height-base: 1.5rem;
      --ds-color-primary: #0066ff;
    }`;
    const t = loadTokensFromCss(css);
    expect(t.spacing.get(16)).toBe('--ds-spacing-4');
    expect(t.fontSizes.get(18)).toBe('--ds-font-size-lg');
    expect(t.fontWeights.get(700)).toBe('--ds-font-weight-bold');
    expect(t.radii.get(12)).toBe('--ds-radius-lg');
    expect(t.lineHeights.get(24)).toBe('--ds-line-height-base');
    expect(t.colors.get('#0066ff')).toBe('--ds-color-primary');
  });

  it('supports custom patterns for unusual naming', () => {
    const css = `:root { --gap-sm: 0.5rem; }`;
    const t = loadTokensFromCss(css, { patterns: { spacing: ['gap'] } });
    expect(t.spacing.get(8)).toBe('--gap-sm');
  });
});
