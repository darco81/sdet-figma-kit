// React generator: a `.tsx` component plus an external `.css` file (same rules
// as the CSS generator). Only design-specified properties appear (RULE ZERO).

import type { CodegenSpec, GeneratedFile } from '../types.js';
import { renderElements, pascal, kebab, banner, escapeText } from './shared.js';
import { generateCss } from './css.js';

export function generateReact(spec: CodegenSpec): GeneratedFile[] {
  const els = renderElements(spec);
  const componentName = pascal(spec.componentName);
  const cssFileName = `${kebab(spec.componentName)}.css`;

  const root = els[0];
  const body = root
    ? (() => {
        const children = els.slice(1);
        const rootText = root.texts.map(escapeText).join(' ');
        const childMarkup = children
          .map((el) => `      <div className="${el.className}">${el.texts.map(escapeText).join(' ')}</div>`)
          .join('\n');
        const inner = [rootText ? `      ${rootText}` : '', childMarkup].filter(Boolean).join('\n');
        return `    <div className="${root.className}">\n${inner}\n    </div>`;
      })()
    : '    <div />';

  const head = `/*\n${banner(spec).split('\n').map((l) => ` * ${l}`).join('\n')}\n */`;
  const tsx = `${head}\nimport './${cssFileName}';\n\nexport default function ${componentName}() {\n  return (\n${body}\n  );\n}\n`;

  // Reuse the CSS generator for the stylesheet (single source of truth for rules).
  const css = generateCss(spec);

  return [{ path: `${componentName}.tsx`, content: tsx }, ...css];
}
