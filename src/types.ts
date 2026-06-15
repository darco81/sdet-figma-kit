// Core data model for the Figma -> code pipeline.
//
// The pipeline is a chain of pure transforms:
//   raw input (Figma)  ->  ParsedElement[]  ->  MappedElement[]  ->  CodegenSpec  ->  GeneratedFile[]
//
// Every CSS property is `string | null`. `null` means "the design did not
// specify this property". That null is load-bearing: see RULE ZERO in
// `rule-zero.ts`. We never replace a null with a default or a guess.

/** Raw CSS values extracted from a single Figma element. `null` = absent in the design. */
export interface ParsedCSS {
  background: string | null;
  paddingTop: string | null;
  paddingRight: string | null;
  paddingBottom: string | null;
  paddingLeft: string | null;
  gap: string | null;
  fontSize: string | null;
  fontFamily: string | null;
  fontWeight: string | null;
  lineHeight: string | null;
  letterSpacing: string | null;
  color: string | null;
  borderRadius: string | null;
  borderWidth: string | null;
  borderStyle: string | null;
  borderColor: string | null;
  width: string | null;
  height: string | null;
  display: string | null;
  flexDirection: string | null;
}

/** A Figma element after extraction: name, node id, raw CSS, and any text content. */
export interface ParsedElement {
  name: string;
  nodeId: string;
  /** Original class/source string the values came from (debug / provenance). */
  classes: string;
  css: ParsedCSS;
  texts: string[];
}

/**
 * Reverse lookup maps: extracted value -> design-token name.
 * Built from a design-token CSS file (`tokens/loader.ts`) or the standard
 * Tailwind scale (`tokens/tailwind.ts`).
 */
export interface TokenMap {
  colors: Map<string, string>;
  spacing: Map<number, string>;
  fontSizes: Map<number, string>;
  fontWeights: Map<number, string>;
  radii: Map<number, string>;
  lineHeights: Map<number, string>;
}

/** A Figma element whose CSS values have been mapped to design tokens where possible. */
export interface MappedElement {
  name: string;
  nodeId: string;
  raw: ParsedCSS;
  /** prop -> "rawValue (--token-name)" when matched, or "rawValue" when not. Absent props omitted. */
  mapped: Record<string, string>;
  /** "prop: value" entries that look mappable but had no matching token. */
  unmapped: string[];
  texts: string[];
}

/** Target output format for the generator. */
export type Framework = 'css' | 'vue' | 'react';

/**
 * Intermediate, framework-agnostic description of the component to generate.
 * This is the deterministic hand-off between extraction/mapping and rendering.
 */
export interface CodegenSpec {
  componentName: string;
  /** CSS custom properties referenced by the mapped values (deduped). */
  cssVariables: string[];
  /** Human-readable one-line summary of the root layout. */
  layout: string;
  elements: Array<{
    name: string;
    nodeId: string;
    mapped: Record<string, string>;
    texts: string[];
  }>;
  texts: string[];
  /** Values that had no token match — the consumer decides token-vs-literal. Never guessed. */
  warnings: string[];
}

/** A generated file ready to be written to disk. */
export interface GeneratedFile {
  path: string;
  content: string;
}
