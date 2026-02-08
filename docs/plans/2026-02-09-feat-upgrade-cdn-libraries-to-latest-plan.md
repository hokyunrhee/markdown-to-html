---
title: Upgrade CDN Libraries to Latest Versions
type: feat
date: 2026-02-09
---

# Upgrade CDN Libraries to Latest Versions

## Overview

Update all CDN-loaded libraries to latest stable versions. **Security necessity** — current KaTeX and Mermaid have known CVEs.

| Library | Current | Latest | Risk | Security |
|---------|---------|--------|------|----------|
| marked.js | 12.0.0 | **17.0.1** | **HIGH** — renderer API rewrite | — |
| KaTeX | 0.16.9 | **0.16.28** | LOW — patch only | **CVE-2025-23207** (XSS via `\htmlData`) |
| Prism.js | 1.29.0 | **1.30.0** | LOW — minor | — |
| Mermaid | 10.6.1 | **11.12.2** | LOW-MEDIUM | **CVE-2025-54881** (XSS via MathML) |

## marked.js Breaking Changes (v12 → v17)

### CDN Path Change (v16)

```
OLD: https://cdn.jsdelivr.net/npm/marked@12.0.0/marked.min.js
NEW: https://cdn.jsdelivr.net/npm/marked@17.0.1/lib/marked.umd.js
```

UMD build still exposes global `marked` identically.

### Renderer API (v13, mandatory from v14)

Methods receive a **single token object** instead of positional params. `new marked.Renderer()` is deprecated — use a plain object.

### Escaping Change (v15)

`token.text` in code blocks is now **raw unescaped text**. The renderer is responsible for escaping. Check the `escaped` boolean before escaping.

### Config Change

`marked.setOptions()` deprecated. Consolidate into a single `marked.use()` call.

## Renderer Rewrite

Replace `initMarked()` in `js/markdown.js:13-60` with:

```javascript
function initMarked() {
    const renderer = {
        code({ text, lang, escaped }) {
            const safeLang = (lang || '').replace(/[^a-zA-Z0-9_-]/g, '') || 'text';

            if (lang === 'mermaid') {
                const id = `mermaid-${mermaidIdCounter++}`;
                return `<div class="mermaid-wrapper"><div class="mermaid" id="${id}">${escapeHtml(text)}</div></div>`;
            }

            if (safeLang !== 'text' && Prism.languages[safeLang]) {
                const highlighted = Prism.highlight(text, Prism.languages[safeLang], safeLang);
                return `<div class="code-block"><pre class="language-${safeLang}"><code class="language-${safeLang}">${highlighted}</code></pre></div>`;
            }

            const safeText = escaped ? text : escapeHtml(text);
            return `<div class="code-block"><pre><code class="language-${safeLang}">${safeText}</code></pre></div>`;
        },

        table({ header, rows }) {
            const validAligns = ['left', 'center', 'right'];

            let headerHtml = '';
            for (const cell of header) {
                const content = this.parser.parseInline(cell.tokens);
                const alignAttr = cell.align && validAligns.includes(cell.align)
                    ? ` align="${cell.align}"` : '';
                headerHtml += `<th${alignAttr}>${content}</th>`;
            }

            let bodyHtml = '';
            for (const row of rows) {
                bodyHtml += '<tr>';
                for (const cell of row) {
                    const content = this.parser.parseInline(cell.tokens);
                    const alignAttr = cell.align && validAligns.includes(cell.align)
                        ? ` align="${cell.align}"` : '';
                    bodyHtml += `<td${alignAttr}>${content}</td>`;
                }
                bodyHtml += '</tr>';
            }

            return `<div class="table-wrapper"><table><thead><tr>${headerHtml}</tr></thead><tbody>${bodyHtml}</tbody></table></div>`;
        },

        image({ href, title, text }) {
            const titleAttr = title ? ` title="${escapeHtml(title)}"` : '';
            const altAttr = text ? ` alt="${escapeHtml(text)}"` : '';
            return `<div class="image-wrapper"><img src="${escapeHtml(href)}"${altAttr}${titleAttr} loading="lazy"></div>`;
        },

        blockquote({ tokens }) {
            const body = this.parser.parse(tokens);
            return `<div class="blockquote-wrapper"><blockquote>${body}</blockquote></div>`;
        }
    };

    marked.use({ gfm: true, breaks: true, renderer });
}
```

**Critical:** Use method shorthand for ALL renderers — arrow functions break `this.parser` access in `table` and `blockquote`.

## CDN URLs to Hash

Generate SRI hashes with: `curl -s <URL> | openssl dgst -sha384 -binary | openssl base64 -A`

| Resource | URL |
|----------|-----|
| marked.js | `https://cdn.jsdelivr.net/npm/marked@17.0.1/lib/marked.umd.js` |
| KaTeX CSS | `https://cdn.jsdelivr.net/npm/katex@0.16.28/dist/katex.min.css` |
| KaTeX JS | `https://cdn.jsdelivr.net/npm/katex@0.16.28/dist/katex.min.js` |
| KaTeX auto-render | `https://cdn.jsdelivr.net/npm/katex@0.16.28/dist/contrib/auto-render.min.js` |
| Prism CSS | `https://cdn.jsdelivr.net/npm/prismjs@1.30.0/themes/prism-tomorrow.min.css` |
| Prism JS | `https://cdn.jsdelivr.net/npm/prismjs@1.30.0/prism.min.js` |
| Prism autoloader | `https://cdn.jsdelivr.net/npm/prismjs@1.30.0/plugins/autoloader/prism-autoloader.min.js` |
| Mermaid JS | `https://cdn.jsdelivr.net/npm/mermaid@11.12.2/dist/mermaid.min.js` |

## Mermaid v11 Notes

- API compatible: `mermaid.initialize()` and `mermaid.render(id, code) → { svg }` unchanged
- IIFE bundle works — `.default` issue was fixed before stable release
- Add `suppressErrorRendering: true` to `mermaid.initialize()` to prevent duplicate error display
- Flowchart labels are Markdown-by-default in v11 (opt-in in v10)

## Implementation Steps

### Step 1: Update all CDN versions and SRI hashes

**Files:**
- `index.html` — lines 21, 24, 176, 179-180, 183-184, 187
- `js/html.js` — lines 8-9 (`KATEX_CSS_URL`, `PRISM_CSS_URL`)

Update all version numbers, change marked.js CDN path to `lib/marked.umd.js`, regenerate all 8 SRI hashes.

Add to `<head>` (before other CDN links):
```html
<link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin>
```

### Step 2: Rewrite marked.js renderers

Rewrite `initMarked()` in `js/markdown.js:13-60` per the code above.

Key changes:
- `marked.setOptions()` + `new marked.Renderer()` → single `marked.use({ gfm: true, breaks: true, renderer })`
- `code(code, language)` → `code({ text, lang, escaped })` with sanitized `lang`
- `table(header, body)` → `table({ header, rows })` with cell iteration via `this.parser.parseInline()`
- `image(href, title, text)` → `image({ href, title, text })` (destructure only)
- `blockquote(quote)` → `blockquote({ tokens })` with `this.parser.parse(tokens)`

Add `suppressErrorRendering: true` to `mermaid.initialize()` in `initMermaid()`.

### Step 3: Test

- `npm run test` (Playwright E2E suite)
- Browser console: verify zero SRI integrity errors
- Test XSS payloads: `<script>alert(1)</script>` in code blocks, `" onerror="alert(1)` in image hrefs
- Verify HTML export embeds correct CSS versions

## Acceptance Criteria

- [x] All 4 CDN libraries updated to latest versions with correct SRI hashes
- [x] marked.js CDN path changed to `lib/marked.umd.js`
- [x] All 4 renderers rewritten with method shorthand (no arrow functions)
- [x] `lang` sanitized in code renderer (alphanumeric only)
- [x] `cell.align` validated against allowlist in table renderer
- [x] `escaped` boolean checked in code renderer
- [x] `KATEX_CSS_URL` and `PRISM_CSS_URL` updated in `js/html.js`
- [x] `suppressErrorRendering: true` added to mermaid init
- [x] `preconnect` hint added for jsdelivr
- [x] Existing Playwright E2E tests pass
- [x] XSS regression: no script execution from code blocks, images, or math

## References

- [marked.js v13 — renderer token-object API](https://github.com/markedjs/marked/releases/tag/v13.0.0)
- [marked.js custom renderer docs](https://marked.js.org/using_pro)
- [KaTeX CVE-2025-23207](https://github.com/KaTeX/KaTeX/security/advisories)
- [Mermaid CVE-2025-54881](https://security.snyk.io/vuln/SNYK-JS-MERMAID-12027649)
- [Mermaid v11 breaking changes](https://github.com/orgs/mermaid-js/discussions/4710)
