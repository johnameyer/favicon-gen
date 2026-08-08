# Favicon

Generate transparent-background favicons from emojis or custom SVG artwork, entirely client-side.

## Status

Under incremental development. Built so far:

- Layer-based canvas preview (`src/app/canvas/`) — the canvas is modeled as a stack of `Layer` objects (`src/app/models/layer.ts`), each with its own SVG source and transform, so future features like multi-emoji compositing and per-layer recoloring can slot in without a rewrite.
- `favicon.ico` download (`src/app/export/`) — a hand-rolled ICO encoder (no dependency) renders the current layer stack at 16/32/48px and bundles them into a real multi-resolution `.ico` file, downloaded client-side.
- The placeholder emoji (😀 U+1F600) now loads asynchronously from the Noto Emoji CDN mirror on jsDelivr (`src/app/canvas/emoji-source.service.ts`), with a loading/error state shown in the preview while the fetch is in flight. It's still a single fixed emoji — no picker/search UI or codepoint-driven fetching yet.

Planned next: PNG set + manifest export, zip bundling, emoji picker/search UI, SVG upload/paste.

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
