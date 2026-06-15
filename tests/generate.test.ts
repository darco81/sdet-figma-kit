import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadTokensFromCss } from '../src/tokens/loader.js';
import { generateFromDesignContext } from '../src/pipeline.js';
import type { GeneratedFile } from '../src/types.js';

const fixture = readFileSync(join(__dirname, 'fixtures/price-tag.design-context.txt'), 'utf-8');
const tokens = loadTokensFromCss(readFileSync(join(__dirname, 'fixtures/tokens.css'), 'utf-8'));

function file(files: GeneratedFile[], suffix: string): GeneratedFile {
  const f = files.find((x) => x.path.endsWith(suffix));
  if (!f) throw new Error(`no file ending in ${suffix} (have: ${files.map((x) => x.path).join(', ')})`);
  return f;
}

describe('generate (token-aware, all frameworks)', () => {
  const files = generateFromDesignContext(fixture, {
    componentName: 'PriceTag',
    tokens,
    frameworks: ['css', 'vue', 'react'],
  });

  it('emits css, vue and react (with shared css) files', () => {
    const paths = files.map((f) => f.path).sort();
    expect(paths).toContain('price-tag.css');
    expect(paths).toContain('PriceTag.vue');
    expect(paths).toContain('PriceTag.tsx');
  });

  it('CSS uses var(--token) for mapped values', () => {
    const css = file(files, 'price-tag.css').content;
    expect(css).toContain('.price-tag {');
    expect(css).toContain('display: flex;');
    expect(css).toContain('gap: var(--space-4);');
    expect(css).toContain('background: var(--white);');
    expect(css).toContain('border-radius: var(--radius-md);');
    expect(css).toContain('font-weight: var(--font-weight-bold);');
  });

  it('RULE ZERO: only the root has a border-radius; text elements have none', () => {
    const css = file(files, 'price-tag.css').content;
    const ruleBodyMatches = css.match(/border-radius/g) ?? [];
    expect(ruleBodyMatches.length).toBe(1); // only PriceTag root specified rounded
  });

  it('records unmapped values as a comment, never guessed into a token', () => {
    const css = file(files, 'price-tag.css').content;
    expect(css).toContain('Unmapped values');
    expect(css).toContain('borderColor: #e5e5e5'); // had no matching token
  });

  it('Vue is a self-contained SFC with scoped styles and text content', () => {
    const vue = file(files, 'PriceTag.vue').content;
    expect(vue).toContain('<template>');
    expect(vue).toContain('<style scoped>');
    expect(vue).toContain('class="price-tag"');
    expect(vue).toContain('Cena brutto');
    expect(vue).toContain('gap: var(--space-4);');
  });

  it('React component imports the css and renders class names', () => {
    const tsx = file(files, 'PriceTag.tsx').content;
    expect(tsx).toContain('export default function PriceTag()');
    expect(tsx).toContain("import './price-tag.css'");
    expect(tsx).toContain('className="price-tag"');
    expect(tsx).toContain('99,00 zł');
  });
});

describe('generate (no tokens -> literal values)', () => {
  it('emits raw literals when no token map is supplied', () => {
    const files = generateFromDesignContext(fixture, { componentName: 'PriceTag', frameworks: ['css'] });
    const css = file(files, 'price-tag.css').content;
    expect(css).toContain('gap: 16px;');
    expect(css).toContain('background: #ffffff;');
    expect(css).not.toContain('var(--');
  });
});
