// Build the framework-agnostic CodegenSpec from mapped elements.
// This is the deterministic hand-off between extraction/mapping and rendering:
// the generators consume only the spec, never the raw Figma data.

import type { MappedElement, CodegenSpec } from './types.js';
import { collectTokens, splitMapped } from './tokens/mapped-value.js';

/** Build a CodegenSpec from mapped Figma elements. */
export function buildCodegenSpec(elements: MappedElement[], componentName: string): CodegenSpec {
  // Distinct CSS custom properties referenced anywhere in the mapped values.
  const cssVariables = collectTokens(
    elements.flatMap((el) => Object.values(el.mapped)),
  );

  // One-line layout summary from the first element that carries layout info.
  const layoutParts: string[] = [];
  for (const el of elements) {
    const raw = (key: string): string | null => {
      const v = el.mapped[key];
      return v === undefined ? null : splitMapped(v).raw;
    };
    if (raw('display')) layoutParts.push(raw('display') as string);
    if (raw('gap')) layoutParts.push(`gap: ${raw('gap')}`);
    if (raw('paddingTop')) layoutParts.push(`padding-top: ${raw('paddingTop')}`);
    if (raw('paddingRight')) layoutParts.push(`padding-right: ${raw('paddingRight')}`);
    if (raw('paddingBottom')) layoutParts.push(`padding-bottom: ${raw('paddingBottom')}`);
    if (raw('paddingLeft')) layoutParts.push(`padding-left: ${raw('paddingLeft')}`);
    if (layoutParts.length > 0) break;
  }

  const specElements = elements.map((el) => ({
    name: el.name,
    nodeId: el.nodeId,
    mapped: el.mapped,
    texts: el.texts,
  }));

  const texts = elements.flatMap((el) => el.texts);

  const warnings: string[] = [];
  for (const el of elements) {
    for (const entry of el.unmapped) {
      warnings.push(`${el.name || el.nodeId}: ${entry}`);
    }
  }

  return {
    componentName,
    cssVariables,
    layout: layoutParts.join(', '),
    elements: specElements,
    texts,
    warnings,
  };
}
