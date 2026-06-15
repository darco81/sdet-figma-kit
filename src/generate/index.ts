// Generator dispatch: render a CodegenSpec to one or more target frameworks.

import type { CodegenSpec, GeneratedFile, Framework } from '../types.js';
import { generateCss } from './css.js';
import { generateVue } from './vue.js';
import { generateReact } from './react.js';

const GENERATORS: Record<Framework, (spec: CodegenSpec) => GeneratedFile[]> = {
  css: generateCss,
  vue: generateVue,
  react: generateReact,
};

export const ALL_FRAMEWORKS: Framework[] = ['css', 'vue', 'react'];

/**
 * Generate files for the given frameworks. Files with the same path (e.g. the
 * shared `.css` emitted by both the CSS and React generators) are de-duplicated,
 * first occurrence wins.
 */
export function generate(spec: CodegenSpec, frameworks: Framework[]): GeneratedFile[] {
  const byPath = new Map<string, GeneratedFile>();
  for (const fw of frameworks) {
    for (const file of GENERATORS[fw](spec)) {
      if (!byPath.has(file.path)) byPath.set(file.path, file);
    }
  }
  return [...byPath.values()];
}

export { generateCss, generateVue, generateReact };
