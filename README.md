# Favicon

Generate transparent-background favicons from emojis or custom SVG artwork, entirely client-side.

## Status

Under incremental development. Built so far:

- Layer-based canvas preview (`src/app/canvas/`) — the canvas is modeled as a stack of `Layer` objects (`src/app/models/layer.ts`), each with its own SVG source and transform, so future features like multi-emoji compositing and per-layer recoloring can slot in without a rewrite.
- `favicon.ico` download (`src/app/export/`) — a hand-rolled ICO encoder (no dependency) renders the current layer stack at 16/32/48px and bundles them into a real multi-resolution `.ico` file, downloaded client-side.
- Full favicon bundle export (`FaviconExportService.exportBundle`, zipped client-side with [`fflate`](https://github.com/101arrowz/fflate)) — a `favicon-package.zip` containing `favicon.ico`, `favicon-16x16.png`, `favicon-32x32.png`, `apple-touch-icon.png` (180×180), `android-chrome-192x192.png`, `android-chrome-512x512.png`, a `site.webmanifest` referencing the android-chrome icons, and a `snippet.html` with ready-to-paste `<head>` tags. A mode toggle ("ICO only" vs "Full bundle", defaulting to "Full bundle") in `App` switches the single Download button between the plain `.ico` flow and this bundle. Judgment call: `apple-touch-icon.png` is rendered on a transparent background rather than the conventionally-opaque one, consistent with this app's transparent-by-design premise — no background-color picker exists yet.
- Emoji SVG markup loads asynchronously from the Noto Emoji CDN mirror on jsDelivr (`src/app/canvas/emoji-source.service.ts`), with a loading/error state shown in the preview while a fetch is in flight. `EmojiSourceService.fetchEmoji(codepoints)` builds the CDN URL from any Noto codepoint filename fragment (single codepoint or multi-codepoint ZWJ sequence, e.g. `1f600` or `1f468_200d_1f469_200d_1f467`); `fetchPlaceholderEmoji()` is now a thin wrapper around it for the default grinning-face placeholder.
- Emoji picker/search UI (`src/app/emoji-picker/`) — a searchable grid backed by `emojilib`'s keyword data (~1900+ emoji, each with a list of search keywords/synonyms rather than just a single CLDR name), filtering by substring match against any keyword. This fixes searches like "car" not finding 🚗/🚙/🚕 (their CLDR names are "automobile"/"sport utility vehicle"/"taxi", so a name-only substring match missed them; `emojilib`'s keyword lists include "car" for all three). Selecting an emoji fetches its SVG via `EmojiSourceService.fetchEmoji`/`resolveEmojiSvgUrl` and feeds it into `CanvasPreview` as an explicit single-layer stack, overriding the default placeholder. Flag emoji are included in the catalog: plain country flags (regional-indicator pairs, e.g. 🇺🇸) and subdivision flags (tag-sequence encoded, e.g. the England/Scotland/Wales flags) are routed to their actual CDN location under `third_party/region-flags/svg/{CODE}.svg` instead of the standard `svg/emoji_u{codepoints}.svg` path. **Minor known gap:** a handful of flag emoji (white flag, rainbow flag, transgender flag, pirate flag) have no known asset under either scheme and will fail to load; this is handled generically rather than via exclusion — a broken picker thumbnail falls back to a plain placeholder box (`(error)` handler on the `<img>`), and a failed selection shows a visible error message near the picker instead of silently doing nothing (`App.selectionError`). The default (empty-search) results are sampled at a fixed stride across the whole catalog rather than a plain slice — `emojilib`'s underlying order starts with Smileys & Emotion, so a plain `slice(0, 60)` showed nothing but faces; striding across the ~1900-entry catalog gives a representative spread without needing category metadata. **Known limitation:** keyword-only search means some common abbreviations aren't findable (e.g. searching "SUV" doesn't surface 🚙, since its `emojilib` keywords are "sport_utility_vehicle"/"transportation"/"vehicle"/etc. with no literal "suv" substring) — not fixed, to avoid hand-maintaining a synonym list.
- Tabbed source UI (`src/app/app.ts`/`app.html`) — "Emoji" and "Custom SVG" tabs, tracked by a single `activeTab` signal, switch which picker component is shown. Both flows funnel into one shared `App.loadSvgAsCurrentSource(svgMarkup)` method that wraps the markup via `buildPlaceholderLayers` and sets `selectedLayers`, so `CanvasPreview` and the ICO download don't care which tab produced the SVG.
- Custom SVG upload (`src/app/svg-upload/`) — a drop zone + file input (`.svg`/`image/svg+xml`) that reads the dropped/selected file as text and validates it with `DOMParser` before accepting: rejects malformed XML, rejects non-`<svg>` root elements, and rejects files over 2 MB. **This validation is a UX guard, not a security boundary:** accepted SVG markup is only ever used as an `Image` `src` via a data URL for canvas drawing (see `render-layers.ts`/`svg-data-url.ts`), never injected into the live DOM, so embedded `<script>` tags can't execute through this render path — there is deliberately no sanitization/script-stripping step.
- Recoloring by color family (`src/app/recolor/`) — the current SVG's `fill`/`stroke` colors (attribute and inline-`style` forms) **and gradient `<stop>` colors** (`stop-color` attribute and inline-`style` forms) are extracted (`extractColorGroups`) and auto-grouped into "families" by hue proximity (`groupExtractedColors`), so e.g. a car body's 3 tonal shades of red are treated as one swatch instead of three. Gradient-stop extraction matters because many Noto emoji — most faces, plus some "glowing" subjects like sun/moon/fire — define their color entirely via `<radialGradient>`/`<linearGradient>` `<stop style="stop-color:...">` children rather than a flat `fill="#hex"`; without it, faces (the most common "I want to recolor this" case) showed zero recolorable swatches. Grouping is **gated by saturation** (colors under ~15% saturation, i.e. grays/whites/blacks, are never hue-clustered — their hue is numerically unstable and would otherwise wrongly merge into an adjacent hue family like red) **and by lightness** (colors below ~20% or above ~90% lightness are also excluded from hue-clustering), and uses a tuned hue-distance threshold (~11°, verified against real Noto sedan/SUV emoji SVGs so a gray never joins the red family and a body-blue family never merges with an adjacent-hue window-glass teal family). The lightness gate exists because saturation and lightness are independent axes: a color can be dark (or near-white) *and* well-saturated at the same time, and single-linkage hue-chaining can bridge such an extreme through a chain of intermediate mid-tone colors into a completely unrelated family. The motivating case: the grinning-face emoji's near-black eye/mouth "ink" outline (`#422B0D`, S≈67%, L≈15%) has a perfectly legitimate hue and was getting hue-chained — via intermediate mouth-shading/fill browns — all the way into the face's bright yellow skin gradient, merging two unrelated visual elements. The lightness gate fixes that specific merge without touching the saturation gate or the SUV body-blue/window-glass fix (those colors sit at 34-84% lightness, nowhere near the new gate boundaries).
  **Gradient stops are grouped structurally, not by hue distance.** Real Noto gradients frequently span far more hue than any fixed threshold could accommodate — the birthday-cake emoji's frosting gradients go pink→orange→yellow across ~64° of hue, the fire emoji's flame gradient spans ~32° (orange→red), the crystal-ball emoji's blue gradient spans ~21° — because a gradient's stops represent one continuous material regardless of how far their colors drift, and this genuinely overlaps with ranges that must stay *rejected* elsewhere (e.g. the SUV's body-paint-vs-window-glass false merge, ~25° combined span). Since no amount of color-math tuning can thread that needle, `extractColorGroups` instead reads the SVG's own structure: every `<stop>` sharing one `<linearGradient>`/`<radialGradient>` becomes one pre-formed, unconditional group (never split by hue/saturation/lightness), while `groupExtractedColors` threads each gradient into the same single-linkage hue-chaining algorithm as flat colors via a representative color (its first/dominant stop) — so a gradient can still merge with an adjacent-hue flat color or another gradient (the achromatic/extreme-lightness gates apply to that representative for cross-group eligibility, but never split the gradient's own stops apart). `color-utils.ts`'s public API is just these two functions plus `recolorGroup`/`applyColorMap` — the earlier flat, gradient-unaware `extractColors`/`groupColorsByHue` were removed once nothing called them anymore.
  Known minor limitation: gated non-gradient colors (including the eye ink) each become their own singleton group rather than being clustered among themselves, and a couple of the grinning face's mid-lightness mouth colors (shading/fill, ~34-46% lightness) still hue-chain into the face-yellow group since their lightness isn't extreme enough to trip the gate — the split/merge/per-member-override tools below let a user correct any group they disagree with. **A separate, deliberately out-of-scope follow-up:** a flat-fill color that's structurally grouped with another element via a sibling `<g>` (e.g. an eye's highlight/glint color sitting next to Noto's "peepers" group) but isn't part of any gradient still drifts into whatever hue cluster its own color happens to land in, rather than following its structural sibling — that would need a `<g>`-sibling-proximity signal distinct from the gradient-stop signal above, and is left for a future task. Because a fixed threshold can't always distinguish "same material, different shade" from "different material, similar hue," auto-grouping is explicitly a *suggestion*: the recolor panel (`RecolorPanel`) lets the user **split** a group back into its individual original colors, or **merge** two or more groups (via checkboxes + a "Merge selected" button — chosen over drag-and-drop as the simplest workable interaction). Picking a new color for a group recolors every member together via `recolorGroup`: hue shifts **additively** (`memberHue = originalHue + (newHue - dominantHue)`, shortest circular path, dominant = the group's first-added color), while saturation and lightness scale **by ratio** relative to the dominant color (`memberSat = originalSat * (newSat / dominantSat)`, same for lightness) so each member's relative shading is preserved rather than flattened. Beyond whole-group recoloring, each group can be **expanded** to reveal one swatch/picker per individual original color, letting the user fine-tune a single shade (e.g. one of a merged group's members) independently of the group's bulk ratio math — an individual override, once set, is pinned and wins over the group-level computation for that color until explicitly cleared (an "×" button next to the overridden swatch), and both group-level picks and individual overrides are wiped by "Reset colors". Splitting or merging groups preserves any individual overrides on the colors involved, since the override is keyed by the color's own hex, not by group membership. Overrides are stored as a `colorOverrides` map on the `Layer` (`{originalHex: newHex}`) rather than mutating `svgMarkup`, and applied on the fly at render/export time (`effectiveSvgMarkup` in `render-layers.ts`), so ICO and bundle export automatically reflect recolored output with no export-service changes needed.

Planned next: per-file granular export toggles (choosing individual files within the bundle) are a deferred future enhancement.

## Development server

```bash
ng serve
```

Open `http://localhost:4200/` — the app reloads automatically on source changes.

## Building

```bash
ng build
```

Compiles the project and stores build artifacts in `dist/`. Production builds are optimized by default.

## Running unit tests

Unit tests run via [Vitest](https://vitest.dev/):

```bash
ng test
```

## Running end-to-end tests

E2e tests run via [Playwright](https://playwright.dev/) (`e2e/`):

```bash
ng e2e
```

## Linting

```bash
ng lint
```

## Additional Resources

For more on the Angular CLI, see the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli).
