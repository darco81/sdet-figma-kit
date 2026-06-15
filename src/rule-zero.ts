// RULE ZERO — the one invariant this whole kit is built around.
//
//   If a CSS property is ABSENT in the extracted design, its value is
//   0 / none / nothing. It is NEVER estimated, defaulted, or guessed —
//   least of all from a screenshot.
//
//   No `rounded-*` in the design  ->  no `border-radius` in the output.
//   No `gap-*`                     ->  no `gap`.
//   No `shadow-*`                  ->  no `box-shadow`.
//
// In code this means: an absent property is `null` all the way through the
// pipeline, and every generated declaration is routed through `declare()` /
// `cssBlock()` below, which physically cannot emit a property whose value is
// null/absent. Absence is preserved, not invented.
//
// This is the deliberate opposite of synthesizing "0px" for missing values:
// a guessed `border-radius: 0px` on every corner-less element is a lie about
// what the design said. "The design did not specify" is the honest state.

/** A value counts as absent when there is nothing real to emit. */
export function isAbsent(value: string | null | undefined): boolean {
  return value === null || value === undefined || value.trim() === '';
}

/**
 * Render a single CSS declaration, honoring RULE ZERO.
 * Returns `""` for any absent value — the property simply does not appear.
 * Pass `indent` to prefix the line (default two spaces).
 */
export function declare(prop: string, value: string | null | undefined, indent = '  '): string {
  if (isAbsent(value)) return '';
  return `${indent}${prop}: ${value};`;
}

/**
 * Join declarations into a CSS body, dropping every absent one.
 * The result contains only properties the design actually specified.
 */
export function cssBlock(declarations: Array<string>): string {
  return declarations.filter((line) => line.length > 0).join('\n');
}

/**
 * Assert that an object of declarations contains no fabricated values.
 * Used in tests to prove the pipeline never turned an absent property into a
 * concrete one. Throws if any key maps to an absent value (which would mean a
 * generator emitted a key it should have omitted entirely).
 */
export function assertNoAbsentEmitted(declarations: Record<string, string | null | undefined>): void {
  for (const [prop, value] of Object.entries(declarations)) {
    if (isAbsent(value)) {
      throw new Error(`RULE ZERO violation: property "${prop}" was emitted with an absent value`);
    }
  }
}
