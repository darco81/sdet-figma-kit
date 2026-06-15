// Parse a Figma design URL into the pieces the extractors need.
//
// Accepts the shapes Figma produces:
//   https://www.figma.com/design/<fileKey>/<slug>?node-id=11468-18657&...
//   https://www.figma.com/file/<fileKey>/<slug>?node-id=11468:18657
//   bare "<fileKey>" + a separate node id
//
// Node ids appear in two forms: dash ("11468-18657", as in URLs) and colon
// ("11468:18657", as the REST API expects). We keep both.

export interface FigmaTarget {
  fileKey: string;
  /** Dash form, e.g. "11468-18657" (URL form). */
  nodeIdDash: string;
  /** Colon form, e.g. "11468:18657" (REST/API form). */
  nodeIdColon: string;
}

export function toColon(nodeId: string): string {
  return nodeId.replace(/-/g, ':');
}

export function toDash(nodeId: string): string {
  return nodeId.replace(/:/g, '-');
}

/** Extract the fileKey from a Figma URL, or return the input if it is already a bare key. */
export function parseFileKey(input: string): string {
  const m = input.match(/\/(?:design|file)\/([a-zA-Z0-9]+)/);
  if (m && m[1]) return m[1];
  // Not a URL — assume it is already a file key.
  return input.trim();
}

/** Extract the node id (dash form) from a Figma URL's `node-id` query param. */
export function parseNodeId(input: string): string | null {
  const m = input.match(/[?&]node-id=([^&]+)/);
  if (!m || !m[1]) return null;
  return decodeURIComponent(m[1]);
}

/**
 * Parse a full Figma URL (or a fileKey + explicit nodeId) into a FigmaTarget.
 * Throws if no node id can be resolved.
 */
export function parseFigmaTarget(url: string, explicitNodeId?: string): FigmaTarget {
  const fileKey = parseFileKey(url);
  const rawNode = explicitNodeId ?? parseNodeId(url);
  if (!rawNode) {
    throw new Error(
      'No Figma node id found. Pass a URL containing ?node-id=... or provide --node explicitly.',
    );
  }
  return {
    fileKey,
    nodeIdDash: toDash(rawNode),
    nodeIdColon: toColon(rawNode),
  };
}
