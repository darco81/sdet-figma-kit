# sdet-figma-kit

[Wersja polska](README.pl.md)

Deterministic Figma → code. Extract design values from a Figma node, map them to your design tokens, and generate a component skeleton (CSS, Vue, or React). No LLM in the data path: every value comes from the design, and a property the design did not specify never appears in the output.

## Origin

This is the public, distilled "generate" half of a larger private Figma pipeline. The extraction discipline it carries — values from `get_design_context`, never from a screenshot — is the same one used by [qa-pack](https://github.com/darco81/qa-pack), the public "verify" half. What stayed private is the non-deterministic, commercial part (element auto-detection, multi-runtime orchestration, the integrated generate→verify→fix loop). What is here is the deterministic core: parse, map, generate.

## Why

- **Deterministic.** Same Figma node + same tokens → byte-identical output, every run. No model, no temperature, no guessing.
- **RULE ZERO.** A property absent in the design is absent in the code. No invented `border-radius: 0`, no estimated spacing. Absence is the truth and is preserved.
- **Token-aware.** Raw values are mapped back to your design tokens (`gap: var(--space-4)`), not frozen as magic numbers. Unmapped values are reported, never silently guessed into a token.
- **Multi-output.** One spec → CSS, a Vue SFC, or a React component. Same values, three skeletons.

## Install

```bash
npm install
npm run build
# optional: link the CLI globally
npm link
```

Requires Node ≥ 20.

## Usage

```
sdet-figma-kit generate [input] [options]
```

| Option | Meaning |
| --- | --- |
| `-c, --design-context <file>` | Figma `get_design_context` output (`-` reads stdin) |
| `--url <figma-url>` | Figma design URL — REST extraction (needs `FIGMA_TOKEN`) |
| `--node <id>` | Node id, when not present in `--url` |
| `--tokens <css-file>` | Design-token CSS (`--name: value;`) for reverse mapping |
| `--tailwind` | Use the standard Tailwind scale instead of a token file |
| `-n, --name <name>` | Component name (default `Component`) |
| `-f, --framework <list>` | `css` \| `vue` \| `react` \| `all` (default `all`) |
| `-o, --out <dir>` | Output directory (default `./out`) |
| `--stdout` | Print to stdout instead of writing files |

### Example session

Get the design context from an MCP-enabled client (Claude Code, Cursor, …) and generate a token-aware Vue component:

```bash
# 1. In your MCP client, call get_design_context on the node and save the output:
#    design.txt

# 2. Generate
sdet-figma-kit generate -c design.txt -n PriceTag --tokens tokens.css -f vue -o ./out
# Generated 1 file(s) for "PriceTag" [vue]:
#   wrote out/PriceTag.vue
```

Or pull straight from Figma over REST:

```bash
export FIGMA_TOKEN=figd_...
sdet-figma-kit generate --url "https://www.figma.com/design/KEY/App?node-id=12-34" -n Card --tailwind
```

The generated `.vue` (token-aware):

```html
<template>
  <div class="price-tag">
    <div class="price">99,00 zł</div>
    <div class="label">Cena brutto</div>
  </div>
</template>

<style scoped>
.price-tag {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  padding-top: var(--space-6);
  background: var(--white);
  border-radius: var(--radius-md);
}
.price {
  color: var(--gray-900);
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-bold);
}
</style>
```

Note what is *not* there: `.price` has no `border-radius`, no `gap`, no `padding` — the design did not specify them, so they are absent. That is RULE ZERO.

## How it works

The pipeline is a chain of pure transforms:

```
Figma  →  ParsedElement[]  →  MappedElement[]  →  CodegenSpec  →  GeneratedFile[]
        extract            map to tokens       build spec       render
```

### Extraction (two paths)

- **MCP-primary** — feed `get_design_context` (React + Tailwind JSX) into `parseDesignContext`. This is the recommended path: your MCP client handles Figma auth, the kit parses the deterministic code output. Values come from the generated code, never a screenshot.
- **REST fallback** — `extractViaRest(fileKey, nodeId)` fetches the node tree with `FIGMA_TOKEN` and converts it directly. Fully self-contained, no MCP client required.

### Token mapping

`loadTokensFromCss` reads any design-token stylesheet (`--name: value;`), resolves `var()` chains and rem→px, and builds reverse maps (value → token name). Categories are matched by configurable name patterns, so `--space-*`, `--font-size-*`, `--radius-*`, etc. are recognized out of the box for any design system. A matched value renders as `var(--token)`; an unmatched-but-mappable value is reported as a warning — the kit never invents a token.

### RULE ZERO

Throughout the pipeline an absent property is `null`, and every generated declaration is routed through a single helper (`declare`) that emits nothing for an absent value. Generators physically cannot output a property the design did not specify. This is enforced and tested (`tests/rule-zero.test.ts`).

## What's in / What's not (yet)

**In:**
- Deterministic extraction from `get_design_context` and from the Figma REST API
- Generic design-token reverse mapping (any prefix) + the standard Tailwind scale
- CSS, Vue SFC, and React (+ CSS) generation
- RULE ZERO as an enforced, tested invariant
- A library API and a CLI

**Not (yet) — roadmap:**
- A bundled live MCP client (today the MCP path consumes `get_design_context` text; auth is handled by your MCP client)
- Element auto-detection / mapping a design to an existing implementation *(private)*
- Multi-runtime beyond CSS/Vue/React, and full generate→verify→fix orchestration *(private)*
- Interactive-state (hover/focus/disabled) extraction from Figma variants

The seams are deliberately clean: extraction, mapping, spec, and generation are separate modules you can compose.

## FAQ

**Does it need Figma Desktop?** No. The MCP path uses the remote/cloud design context; the REST path uses the public API with a token.

**Does it replace a developer?** No. It produces an honest skeleton from the design's actual values. You complete the structure, semantics, and behavior.

**What does it send externally?** Nothing on the parse path (it is offline). The REST path calls `api.figma.com` with your `FIGMA_TOKEN`. The token is read from the environment and never logged.

**Why are some values left as literals?** Because no token matched them. They are reported as warnings so you decide token-vs-literal — the kit will not guess a token for you.

**Why AGPL?** To keep the public distillate open and copyleft. The commercial pipeline parts are separate and private.

## Requirements

- Node ≥ 20 (uses the built-in `fetch` and `node:util` `parseArgs`)
- For the REST path: a Figma personal access token in `FIGMA_TOKEN`

## Library API

```ts
import {
  parseDesignContext, extractViaRest,
  loadTokensFromCss, loadTailwindTokens,
  generateFromDesignContext, generateFromRest,
} from 'sdet-figma-kit';

const tokens = loadTokensFromCss(designTokenCss);
const files = generateFromDesignContext(designContextText, {
  componentName: 'PriceTag',
  tokens,
  frameworks: ['vue'],
});
// files: { path, content }[]
```

## Repository structure

```
src/
  extract/
    design-context.ts   parse get_design_context (React+Tailwind) -> ParsedElement[]
    rest.ts             Figma REST node tree -> ParsedElement[]
    figma-url.ts        parse/normalize Figma URLs and node ids
  tokens/
    loader.ts           generic design-token reverse-map loader
    tailwind.ts         standard Tailwind scale
    mapper.ts           map element CSS values to tokens
    mapped-value.ts     "raw (--token)" encode/decode helpers
  rule-zero.ts          the absent-means-absent invariant (enforced)
  spec.ts               build the framework-agnostic CodegenSpec
  generate/
    css.ts vue.ts react.ts   per-framework renderers
    shared.ts index.ts       class naming, dispatch
  pipeline.ts           high-level extract -> generate helpers
  cli.ts                command-line entry
tests/                  vitest suites + fixtures
```

## License

[AGPL-3.0-only](LICENSE)
