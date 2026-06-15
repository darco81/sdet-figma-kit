// A mapped CSS value is encoded as "rawValue (--token-name)" when a token
// matched, or just "rawValue" when it did not. These helpers are the single
// place that encoding is read or written, so the spec, mapper, and generators
// never re-implement the parsing.

export interface MappedValue {
  /** The literal value, e.g. "16px" or "#2a2a2a". */
  raw: string;
  /** The token name, e.g. "--space-4", or null when no token matched. */
  token: string | null;
}

const TOKEN_RE = /\((--[^)]+)\)/;

/** Encode a raw value + optional token into the "raw (--token)" form. */
export function encodeMapped(raw: string, token: string | null): string {
  return token ? `${raw} (${token})` : raw;
}

/** Split a "raw (--token)" string back into its parts. */
export function splitMapped(value: string): MappedValue {
  const m = value.match(TOKEN_RE);
  if (!m || m[1] === undefined) return { raw: value.trim(), token: null };
  const idx = value.indexOf(' (');
  const raw = idx >= 0 ? value.slice(0, idx).trim() : value.trim();
  return { raw, token: m[1] };
}

/** All distinct token names referenced across a set of mapped values. */
export function collectTokens(values: Iterable<string>): string[] {
  const set = new Set<string>();
  for (const v of values) {
    const { token } = splitMapped(v);
    if (token) set.add(token);
  }
  return [...set];
}

/** Render a mapped value for CSS output: `var(--token)` when present, else the literal. */
export function toCssValue(value: string): string {
  const { raw, token } = splitMapped(value);
  return token ? `var(${token})` : raw;
}
