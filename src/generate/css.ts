// CSS generator: turn a CodegenSpec into plain CSS rules.
// Output contains only properties the design specified (RULE ZERO).

import type { CodegenSpec, GeneratedFile } from '../types.js';
import { renderElements, cssRule, kebab, banner } from './shared.js';

/** Build the CSS rule text (no banner) — shared with the React generator. */
export function buildCssRules(spec: CodegenSpec): string {
  const rules = renderElements(spec)
    .map((el) => cssRule(el.className, el.declarations))
    .filter((r) => r.length > 0);
  return rules.join('\n\n');
}

/** Build a trailing comment listing values that had no token match. */
export function warningsComment(spec: CodegenSpec): string {
  if (spec.warnings.length === 0) return '';
  const lines = spec.warnings.map((w) => ` *   ${w}`).join('\n');
  return `\n\n/* Unmapped values — decide token vs. literal (never guessed):\n${lines}\n */`;
}

/** Generate a standalone `.css` file. */
export function generateCss(spec: CodegenSpec): GeneratedFile[] {
  const head = `/*\n${banner(spec).split('\n').map((l) => ` * ${l}`).join('\n')}\n */`;
  const content = `${head}\n\n${buildCssRules(spec)}${warningsComment(spec)}\n`;
  return [{ path: `${kebab(spec.componentName)}.css`, content }];
}
