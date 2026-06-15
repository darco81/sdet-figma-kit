// Public library API for sdet-figma-kit.

export type {
  ParsedCSS,
  ParsedElement,
  TokenMap,
  MappedElement,
  CodegenSpec,
  GeneratedFile,
  Framework,
} from './types.js';

// RULE ZERO primitives
export { isAbsent, declare, cssBlock, assertNoAbsentEmitted } from './rule-zero.js';

// Extraction
export { parseDesignContext } from './extract/design-context.js';
export { extractViaRest, nodeTreeToElements } from './extract/rest.js';
export {
  parseFigmaTarget,
  parseFileKey,
  parseNodeId,
  toColon,
  toDash,
  type FigmaTarget,
} from './extract/figma-url.js';

// Tokens
export {
  loadTokensFromCss,
  loadTokensFromFiles,
  emptyTokenMap,
  DEFAULT_PATTERNS,
  type TokenPatterns,
  type TokenLoaderOptions,
} from './tokens/loader.js';
export { loadTailwindTokens } from './tokens/tailwind.js';
export { mapElementToTokens, mapElements } from './tokens/mapper.js';
export { splitMapped, encodeMapped, collectTokens, toCssValue, type MappedValue } from './tokens/mapped-value.js';

// Spec + generation
export { buildCodegenSpec } from './spec.js';
export { generate, generateCss, generateVue, generateReact, ALL_FRAMEWORKS } from './generate/index.js';

// Pipeline
export {
  buildSpec,
  generateFromElements,
  generateFromDesignContext,
  generateFromRest,
  type PipelineOptions,
} from './pipeline.js';
