// High-level pipeline: glue extraction -> mapping -> spec -> generation.
// These are the functions most callers (and the CLI) use.

import type { ParsedElement, TokenMap, Framework, GeneratedFile, CodegenSpec } from './types.js';
import { parseDesignContext } from './extract/design-context.js';
import { extractViaRest } from './extract/rest.js';
import { mapElements } from './tokens/mapper.js';
import { emptyTokenMap } from './tokens/loader.js';
import { buildCodegenSpec } from './spec.js';
import { generate, ALL_FRAMEWORKS } from './generate/index.js';

export interface PipelineOptions {
  componentName: string;
  /** Token map for reverse mapping. Defaults to an empty map (literal output, no token refs). */
  tokens?: TokenMap;
  /** Target frameworks. Defaults to all (css, vue, react). */
  frameworks?: Framework[];
}

/** Build a spec from already-extracted elements. */
export function buildSpec(elements: ParsedElement[], options: PipelineOptions): CodegenSpec {
  const tokens = options.tokens ?? emptyTokenMap();
  const mapped = mapElements(elements, tokens);
  return buildCodegenSpec(mapped, options.componentName);
}

/** Elements -> generated files. */
export function generateFromElements(elements: ParsedElement[], options: PipelineOptions): GeneratedFile[] {
  const spec = buildSpec(elements, options);
  return generate(spec, options.frameworks ?? ALL_FRAMEWORKS);
}

/** Figma `get_design_context` text -> generated files (MCP-primary path). */
export function generateFromDesignContext(designContext: string, options: PipelineOptions): GeneratedFile[] {
  const elements = parseDesignContext(designContext);
  return generateFromElements(elements, options);
}

/** Figma file key + node id (via REST + FIGMA_TOKEN) -> generated files (fallback path). */
export async function generateFromRest(
  fileKey: string,
  nodeId: string,
  options: PipelineOptions & { token?: string },
): Promise<GeneratedFile[]> {
  const elements = await extractViaRest(fileKey, nodeId, options.token);
  return generateFromElements(elements, options);
}
