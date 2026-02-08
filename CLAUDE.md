# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Client-side Markdown-to-HTML converter web app. No build tools, no bundler — vanilla JavaScript served as static files. All processing happens in the browser; no server-side logic.

## Development

```bash
npm run dev          # starts local server on http://localhost:3000 (uses npx serve)
```

No build step, no linter configured. Playwright E2E tests available via `npm run test`.

## Architecture

Four IIFE modules loaded via `<script>` tags in `index.html` (order matters):

1. **`js/storage.js` — `Storage`**: IndexedDB wrapper (`markdown-editor-db`). Two object stores: `autosave` (single-key current content) and `documents` (user-saved docs with title/content/timestamps). Migrates legacy `localStorage` data on first run. Exposes `debouncedSave` (1s delay) for autosave and full CRUD for documents.

2. **`js/markdown.js` — `MarkdownParser`**: Orchestrates markdown→HTML conversion. Uses `marked.js` (GFM mode) with a custom renderer that wraps code blocks, tables, images, and blockquotes in wrapper divs for styling. Math expressions (`$...$`, `$$...$$`) are extracted as placeholders before marked parsing, then rendered via KaTeX in post-processing. Mermaid diagrams are rendered async after DOM insertion. Prism.js handles syntax highlighting.

3. **`js/html.js` — `HTMLGenerator`**: Produces standalone downloadable HTML files. Fetches and embeds KaTeX CSS (with `@font-face` rules stripped), Prism theme CSS, and local `preview.css` into a single self-contained `<style>` block. Caches fetched CSS.

4. **`js/app.js` — `App`**: Main controller. Binds all DOM events, manages editor↔preview sync with 300ms debounce, handles document sidebar (open/save/rename/delete with unsaved-changes protection), and mobile tab switching.

## External Dependencies (loaded via CDN)

- marked.js 12.0.0 — markdown parsing
- KaTeX 0.16.9 — math rendering
- Prism.js 1.29.0 — syntax highlighting
- Mermaid 10.6.1 — diagram rendering
- Google Fonts Inter — typography

## Key Conventions

- All modules use the revealing module (IIFE) pattern — no ES modules, no imports
- CSS is split: `style.css` for app chrome, `preview.css` for rendered markdown content
- `preview.css` is also embedded in downloaded HTML files, so changes to it affect both preview and export
