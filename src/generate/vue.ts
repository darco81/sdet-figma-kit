// Vue SFC generator: a self-contained `.vue` file with a template and a
// scoped <style> block. Only design-specified properties appear (RULE ZERO).

import type { CodegenSpec, GeneratedFile } from '../types.js';
import { renderElements, pascal, banner, escapeText } from './shared.js';
import { buildCssRules, warningsComment } from './css.js';

export function generateVue(spec: CodegenSpec): GeneratedFile[] {
  const els = renderElements(spec);
  const root = els[0];
  if (!root) {
    return [{ path: `${pascal(spec.componentName)}.vue`, content: '<template>\n  <div />\n</template>\n' }];
  }
  const children = els.slice(1);

  const rootText = root.texts.map(escapeText).join(' ');
  const childMarkup = children
    .map((el) => {
      const text = el.texts.map(escapeText).join(' ');
      return `    <div class="${el.className}">${text}</div>`;
    })
    .join('\n');

  const inner = [rootText ? `    ${rootText}` : '', childMarkup].filter(Boolean).join('\n');
  const template = `<template>\n  <div class="${root.className}">\n${inner}\n  </div>\n</template>`;

  const head = `<!--\n${banner(spec).split('\n').map((l) => `  ${l}`).join('\n')}\n-->`;
  const style = `<style scoped>\n${buildCssRules(spec)}${warningsComment(spec)}\n</style>`;

  const content = `${head}\n\n${template}\n\n${style}\n`;
  return [{ path: `${pascal(spec.componentName)}.vue`, content }];
}
