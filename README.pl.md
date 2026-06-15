# sdet-figma-kit

[English version](README.md)

Deterministyczny Figma → kod. Wyciąga wartości designu z node'a Figmy, mapuje je na Twoje design tokeny i generuje szkielet komponentu (CSS, Vue albo React). Żadnego LLM w ścieżce danych: każda wartość pochodzi z designu, a właściwość, której design nie określił, nigdy nie pojawia się w wyniku.

## Pochodzenie

To publiczna, wydestylowana połowa „generate" większego prywatnego pipeline'u Figma. Dyscyplina ekstrakcji, którą niesie — wartości z `get_design_context`, nigdy ze screenshota — jest tą samą, której używa [qa-pack](https://github.com/darco81/qa-pack), publiczna połowa „verify". Prywatna została część niedeterministyczna i komercyjna (auto-detekcja elementów, orkiestracja multi-runtime, zintegrowana pętla generate→verify→fix). Tutaj jest deterministyczny rdzeń: parsuj, mapuj, generuj.

## Po co

- **Deterministyczne.** Ten sam node Figmy + te same tokeny → identyczny co do bajta wynik, za każdym razem. Bez modelu, bez temperatury, bez zgadywania.
- **RULE ZERO.** Właściwość nieobecna w designie jest nieobecna w kodzie. Żadnego wymyślonego `border-radius: 0`, żadnego szacowanego spacingu. Brak jest prawdą i jest zachowany.
- **Świadome tokenów.** Surowe wartości są mapowane z powrotem na Twoje design tokeny (`gap: var(--space-4)`), nie zamrażane jako magiczne liczby. Wartości bez dopasowania są raportowane, nigdy po cichu zgadywane w token.
- **Wiele wyjść.** Jeden spec → CSS, Vue SFC albo komponent React. Te same wartości, trzy szkielety.

## Instalacja

```bash
npm install
npm run build
# opcjonalnie: zlinkuj CLI globalnie
npm link
```

Wymaga Node ≥ 20.

## Użycie

```
sdet-figma-kit generate [input] [opcje]
```

| Opcja | Znaczenie |
| --- | --- |
| `-c, --design-context <plik>` | Output `get_design_context` z Figmy (`-` czyta stdin) |
| `--url <figma-url>` | URL designu Figmy — ekstrakcja REST (wymaga `FIGMA_TOKEN`) |
| `--node <id>` | Id node'a, gdy nie ma go w `--url` |
| `--tokens <plik-css>` | CSS z design tokenami (`--name: value;`) do mapowania |
| `--tailwind` | Użyj standardowej skali Tailwind zamiast pliku tokenów |
| `-n, --name <nazwa>` | Nazwa komponentu (domyślnie `Component`) |
| `-f, --framework <lista>` | `css` \| `vue` \| `react` \| `all` (domyślnie `all`) |
| `-o, --out <katalog>` | Katalog wyjściowy (domyślnie `./out`) |
| `--stdout` | Wypisz na stdout zamiast zapisywać pliki |

### Przykładowa sesja

Pobierz design context z klienta z MCP (Claude Code, Cursor, …) i wygeneruj świadomy tokenów komponent Vue:

```bash
# 1. W kliencie MCP wywołaj get_design_context na node'zie i zapisz output:
#    design.txt

# 2. Generuj
sdet-figma-kit generate -c design.txt -n PriceTag --tokens tokens.css -f vue -o ./out
# Generated 1 file(s) for "PriceTag" [vue]:
#   wrote out/PriceTag.vue
```

Albo prosto z Figmy przez REST:

```bash
export FIGMA_TOKEN=figd_...
sdet-figma-kit generate --url "https://www.figma.com/design/KEY/App?node-id=12-34" -n Card --tailwind
```

Wygenerowany `.vue` (świadomy tokenów):

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

Zwróć uwagę, czego *nie ma*: `.price` nie ma `border-radius`, `gap` ani `padding` — design ich nie określił, więc są nieobecne. To jest RULE ZERO.

## Jak to działa

Pipeline to łańcuch czystych transformacji:

```
Figma  →  ParsedElement[]  →  MappedElement[]  →  CodegenSpec  →  GeneratedFile[]
        ekstrakcja         mapowanie na tokeny   budowa spec      render
```

### Ekstrakcja (dwie ścieżki)

- **MCP-primary** — podaj `get_design_context` (React + Tailwind JSX) do `parseDesignContext`. To zalecana ścieżka: Twój klient MCP obsługuje auth Figmy, a kit parsuje deterministyczny output kodu. Wartości pochodzą z wygenerowanego kodu, nigdy ze screenshota.
- **REST fallback** — `extractViaRest(fileKey, nodeId)` pobiera drzewo node'a z `FIGMA_TOKEN` i konwertuje je bezpośrednio. W pełni samodzielne, bez klienta MCP.

### Mapowanie tokenów

`loadTokensFromCss` czyta dowolny arkusz design tokenów (`--name: value;`), rozwiązuje łańcuchy `var()` oraz rem→px i buduje mapy odwrotne (wartość → nazwa tokenu). Kategorie są dopasowywane po konfigurowalnych wzorcach nazw, więc `--space-*`, `--font-size-*`, `--radius-*` itd. są rozpoznawane od ręki dla dowolnego design systemu. Dopasowana wartość renderuje się jako `var(--token)`; wartość mapowalna, ale bez dopasowania, jest raportowana jako warning — kit nigdy nie wymyśla tokenu.

### RULE ZERO

W całym pipeline nieobecna właściwość to `null`, a każda generowana deklaracja przechodzi przez jeden helper (`declare`), który dla nieobecnej wartości nie emituje nic. Generatory fizycznie nie mogą wypisać właściwości, której design nie określił. Jest to wymuszone i otestowane (`tests/rule-zero.test.ts`).

## Co jest / czego (jeszcze) nie ma

**Jest:**
- Deterministyczna ekstrakcja z `get_design_context` i z Figma REST API
- Generyczne mapowanie design tokenów (dowolny prefix) + standardowa skala Tailwind
- Generacja CSS, Vue SFC i React (+ CSS)
- RULE ZERO jako wymuszony, otestowany inwariant
- API biblioteki i CLI

**Nie ma (jeszcze) — roadmap:**
- Wbudowany żywy klient MCP (dziś ścieżka MCP konsumuje tekst `get_design_context`; auth obsługuje Twój klient MCP)
- Auto-detekcja elementów / mapowanie designu na istniejącą implementację *(prywatne)*
- Multi-runtime poza CSS/Vue/React i pełna orkiestracja generate→verify→fix *(prywatne)*
- Ekstrakcja stanów interaktywnych (hover/focus/disabled) z wariantów Figmy

Szwy są celowo czyste: ekstrakcja, mapowanie, spec i generacja to osobne moduły, które składasz.

## FAQ

**Czy potrzebuje Figma Desktop?** Nie. Ścieżka MCP używa zdalnego/chmurowego design contextu; ścieżka REST używa publicznego API z tokenem.

**Czy zastępuje developera?** Nie. Tworzy uczciwy szkielet z rzeczywistych wartości designu. Strukturę, semantykę i zachowanie uzupełniasz Ty.

**Co wysyła na zewnątrz?** Nic na ścieżce parsowania (jest offline). Ścieżka REST woła `api.figma.com` z Twoim `FIGMA_TOKEN`. Token jest czytany ze środowiska i nigdy nie logowany.

**Czemu część wartości zostaje literałami?** Bo żaden token ich nie dopasował. Są raportowane jako warningi, żebyś to Ty zdecydował token-czy-literał — kit nie zgadnie tokenu za Ciebie.

**Czemu AGPL?** Żeby publiczny destylat był otwarty i copyleft. Komercyjne części pipeline'u są osobne i prywatne.

## Wymagania

- Node ≥ 20 (używa wbudowanego `fetch` i `parseArgs` z `node:util`)
- Dla ścieżki REST: osobisty token Figmy w `FIGMA_TOKEN`

## API biblioteki

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

## Struktura repozytorium

```
src/
  extract/
    design-context.ts   parsuj get_design_context (React+Tailwind) -> ParsedElement[]
    rest.ts             drzewo node'a Figma REST -> ParsedElement[]
    figma-url.ts        parsuj/normalizuj URL-e Figmy i id node'ów
  tokens/
    loader.ts           generyczny loader map odwrotnych design tokenów
    tailwind.ts         standardowa skala Tailwind
    mapper.ts           mapuj wartości CSS elementu na tokeny
    mapped-value.ts     helpery encode/decode "raw (--token)"
  rule-zero.ts          inwariant absent-znaczy-absent (wymuszony)
  spec.ts               buduj niezależny od frameworka CodegenSpec
  generate/
    css.ts vue.ts react.ts   renderery per-framework
    shared.ts index.ts       nazewnictwo klas, dispatch
  pipeline.ts           helpery wysokopoziomowe extract -> generate
  cli.ts                wejście CLI
tests/                  zestawy vitest + fixtures
```

## Licencja

[AGPL-3.0-only](LICENSE)
