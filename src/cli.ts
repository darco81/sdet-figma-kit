#!/usr/bin/env node
// sdet-figma-kit CLI — deterministic Figma -> code generation.

import { parseArgs } from 'node:util';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import type { Framework, TokenMap, GeneratedFile } from './types.js';
import { ALL_FRAMEWORKS } from './generate/index.js';
import { loadTokensFromFiles, emptyTokenMap } from './tokens/loader.js';
import { loadTailwindTokens } from './tokens/tailwind.js';
import { parseFigmaTarget } from './extract/figma-url.js';
import { generateFromDesignContext, generateFromRest } from './pipeline.js';

const USAGE = `sdet-figma-kit — deterministic Figma -> code

Usage:
  sdet-figma-kit generate [input] [options]

Input (one required):
  -c, --design-context <file>  Figma get_design_context output (use '-' for stdin)
      --url <figma-url>        Figma design URL (REST extraction; needs FIGMA_TOKEN)
      --node <id>              Node id, when not present in --url

Tokens (optional, for token-aware output):
      --tokens <css-file>      Design-token CSS (--name: value;) for reverse mapping
      --tailwind               Use the standard Tailwind scale instead

Output:
  -n, --name <name>            Component name (default: Component)
  -f, --framework <list>       css | vue | react | all (default: all)
  -o, --out <dir>              Output directory (default: ./out)
      --stdout                 Print to stdout instead of writing files
  -h, --help                   Show this help

RULE ZERO: a property absent in the design is absent in the output. Never guessed.

Examples:
  sdet-figma-kit generate -c design.txt -n PriceTag --tailwind -f vue -o ./out
  sdet-figma-kit generate --url "https://figma.com/design/KEY/...?node-id=12-34" -n Card
  pbpaste | sdet-figma-kit generate -c - -n Hero --stdout`;

function resolveFrameworks(value: string | undefined): Framework[] {
  if (!value || value === 'all') return ALL_FRAMEWORKS;
  const valid = new Set(ALL_FRAMEWORKS);
  const picked = value
    .split(',')
    .map((s) => s.trim())
    .filter((s): s is Framework => valid.has(s as Framework));
  if (picked.length === 0) {
    throw new Error(`Invalid --framework "${value}". Use css, vue, react, or all.`);
  }
  return picked;
}

function resolveTokens(tokensFile: string | undefined, tailwind: boolean): TokenMap {
  if (tokensFile) return loadTokensFromFiles([tokensFile]);
  if (tailwind) return loadTailwindTokens();
  return emptyTokenMap();
}

function readInput(file: string): string {
  if (file === '-') return readFileSync(0, 'utf-8');
  return readFileSync(file, 'utf-8');
}

function writeFiles(files: GeneratedFile[], outDir: string): void {
  for (const f of files) {
    const target = join(outDir, f.path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, f.content);
    console.log(`  wrote ${target}`);
  }
}

function printFiles(files: GeneratedFile[]): void {
  for (const f of files) {
    console.log(`\n===== ${f.path} =====`);
    console.log(f.content);
  }
}

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      'design-context': { type: 'string', short: 'c' },
      url: { type: 'string' },
      node: { type: 'string' },
      tokens: { type: 'string' },
      tailwind: { type: 'boolean', default: false },
      name: { type: 'string', short: 'n' },
      framework: { type: 'string', short: 'f' },
      out: { type: 'string', short: 'o' },
      stdout: { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });

  const command = positionals[0];
  if (values.help || command !== 'generate') {
    console.log(USAGE);
    process.exit(values.help ? 0 : 1);
  }

  const componentName = values.name ?? 'Component';
  const frameworks = resolveFrameworks(values.framework);
  const tokens = resolveTokens(values.tokens, values.tailwind);
  const outDir = values.out ?? './out';

  let files: GeneratedFile[];

  if (values['design-context']) {
    const text = readInput(values['design-context']);
    files = generateFromDesignContext(text, { componentName, tokens, frameworks });
  } else if (values.url || values.node) {
    if (!values.url) throw new Error('REST extraction needs --url (to resolve the file key).');
    const target = parseFigmaTarget(values.url, values.node);
    files = await generateFromRest(target.fileKey, target.nodeIdColon, { componentName, tokens, frameworks });
  } else {
    console.error('Error: provide an input (--design-context or --url).\n');
    console.log(USAGE);
    process.exit(1);
  }

  if (values.stdout) {
    printFiles(files);
  } else {
    console.log(`Generated ${files.length} file(s) for "${componentName}" [${frameworks.join(', ')}]:`);
    writeFiles(files, outDir);
  }
}

main().catch((err) => {
  console.error(`sdet-figma-kit: ${(err as Error).message}`);
  process.exit(1);
});
