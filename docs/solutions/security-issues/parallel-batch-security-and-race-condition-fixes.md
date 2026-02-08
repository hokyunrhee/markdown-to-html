---
title: "Resolve 10 Security, Race Condition, and Quality Issues in Markdown-to-HTML Converter"
date: 2026-02-08
category: security-issues
tags: [security, xss, race-conditions, ui-bugs, event-delegation, html-escaping, sri-hashes, autosave, double-click, state-management]
module: [js/app.js, js/markdown.js, js/storage.js, index.html]
symptoms:
  - Mermaid diagrams can execute arbitrary JavaScript via click callbacks
  - Crafted image URLs can break out of src attribute and inject onerror handlers
  - CDN resources load without integrity verification
  - Dynamic values in innerHTML templates not consistently escaped
  - Preview flashes stale content when rapidly switching documents
  - Autosave overwrites newly loaded document with previous content
  - Double-clicking modal Save creates duplicate documents
  - Cancelling confirm modal leaves stale pendingOpenDoc reference
  - Document list creates 3*N event listeners on every re-render
severity: high
resolution_time: "~90 seconds wall-clock (10 parallel agents)"
confidence: high
---

# Parallel Batch: 10 Security, Race Condition, and Quality Fixes

## Problem

A vanilla JS markdown-to-HTML converter app accumulated 10 independent issues across security, async race conditions, state management, and architecture. Issues ranged from P1 (Mermaid XSS) to P3 (missing SRI hashes). All were identified during a code review triage session and tracked as TODO files.

## Root Causes

### Security Vulnerabilities (4 issues)

**Mermaid XSS** (`js/markdown.js:69`): Mermaid initialized with `securityLevel: 'loose'`, permitting arbitrary JavaScript execution via crafted `click` callbacks in diagram definitions. Exported HTML files propagate the payload.

**Image href injection** (`js/markdown.js:51`): Image renderer used raw `href` in `src="${href}"` while `title` and `text` were properly escaped. A URL containing `"` could break out of the attribute and inject `onerror` handlers.

**Missing SRI hashes** (`index.html:176-187`): Eight CDN script/link tags loaded without `integrity` attributes. A compromised CDN could inject malicious code with full access to IndexedDB documents.

**Inconsistent HTML escaping** (`js/app.js:275-288`): In `renderDocumentList()`, `doc.title` was escaped but `dateStr` and `doc.id` were inserted raw into `innerHTML`. Defense-in-depth gap.

### Race Conditions (3 issues)

**Preview render race** (`js/app.js:162-170`): `updatePreview()` is async but called fire-and-forget. Rapidly loading two documents causes concurrent parses writing to the same preview container, leaking Mermaid SVGs across documents.

**Stale autosave** (`js/storage.js:107-117`, `js/app.js:362-368`): `debouncedSave` uses a 1-second timer. Loading a new document doesn't cancel the pending timer, so the old content overwrites the autosave slot up to 1 second later.

**Modal double-click** (`js/app.js:398-454`): `handleConfirmSave()` and `handleSaveConfirm()` are async with no re-entry guard. Double-clicking creates duplicate documents; clicking Discard during in-flight save corrupts `lastSavedContent`.

### State Management & Architecture (3 issues)

**Stale pendingOpenDoc** (`js/app.js:594`): Cancel button bound directly to `closeConfirmModal()` which doesn't clear `pendingOpenDoc`, leaving a stale document reference.

**Per-render event listeners** (`js/app.js:264-311`): `renderDocumentList()` creates 3 listeners per item on every render. While old nodes are GC'd, event delegation is the standard pattern.

**Documentation drift** (`CLAUDE.md`): States "no tests" despite Playwright E2E tests existing. Plan doc doesn't mark deferred bugs.

## Solution

### Security Fixes

**1. Mermaid securityLevel** -- one-word change:
```javascript
// js/markdown.js:69
securityLevel: 'strict',  // was 'loose'
```

**2. Image href escaping** -- one-line change:
```javascript
// js/markdown.js:51
return `<div class="image-wrapper"><img src="${escapeHtml(href)}"${altAttr}${titleAttr} loading="lazy"></div>`;
```

**3. CDN SRI hashes** -- added `integrity` and `crossorigin="anonymous"` to all 8 CDN tags:
```html
<script src="https://cdn.jsdelivr.net/npm/marked@12.0.0/marked.min.js"
        integrity="sha384-NNQgBjjuhtXzPmmy4gurS5X7P4uTt1DThyevz4Ua0IVK5+kazYQI1W27JHjbbxQz"
        crossorigin="anonymous"></script>
```

**4. Consistent escaping** in `renderDocumentList()`:
```javascript
<div class="doc-list-item-date">${escapeHtml(dateStr)}</div>
<button class="doc-action-btn rename" data-id="${escapeHtml(String(doc.id))}">
```

### Race Condition Fixes

**5. Generation counter** for preview renders:
```javascript
let previewGeneration = 0;

async function updatePreview() {
    const generation = ++previewGeneration;
    const content = editor.value;
    try {
        await MarkdownParser.parse(content, preview);
    } catch (error) {
        if (generation !== previewGeneration) return; // stale, discard
        console.error('Preview update error:', error);
        preview.innerHTML = '<p class="error">Preview error occurred.</p>';
    }
}
```

**6. Cancel pending autosave** before document switch:
```javascript
// js/storage.js -- new method
function cancelPendingAutosave() {
    if (saveTimeout) {
        clearTimeout(saveTimeout);
        saveTimeout = null;
    }
}

// js/app.js -- called at top of loadDocument() and resetToNewDocument()
function loadDocument(doc) {
    Storage.cancelPendingAutosave();
    // ...
}
```

**7. Double-click guard** with busy flag + button disabling:
```javascript
let saveBusy = false;

async function handleSaveConfirm() {
    if (saveBusy) return;
    saveBusy = true;
    saveModalConfirm.disabled = true;
    saveModalCancel.disabled = true;
    try {
        // ... async save ...
    } finally {
        saveBusy = false;
        saveModalConfirm.disabled = false;
        saveModalCancel.disabled = false;
    }
}
```

### State & Architecture Fixes

**8. handleConfirmCancel()** clears stale reference:
```javascript
function handleConfirmCancel() {
    closeConfirmModal();
    pendingOpenDoc = null;
}
```

**9. Event delegation** -- single listener on `docList` using `e.target.closest()`:
```javascript
docList.addEventListener('click', async (e) => {
    const renameBtn = e.target.closest('.doc-action-btn.rename');
    if (renameBtn) { /* handle rename */ return; }
    const deleteBtn = e.target.closest('.doc-action-btn.delete');
    if (deleteBtn) { /* handle delete */ return; }
    const itemInfo = e.target.closest('.doc-list-item-info');
    if (itemInfo) { /* handle open */ return; }
});
```

**10. Documentation** -- updated CLAUDE.md to mention Playwright tests, marked deferred bugs in plan doc.

## Verification

- 3/3 Playwright E2E tests passed after all changes
- Commits: `535f17f` (fixes), `51804ad` (todo status updates)

## Prevention Strategies

### Security
- **Always escape at point of output**: Use `escapeHtml()` for every dynamic value in `innerHTML` templates
- **Audit third-party configs**: Check library docs for security options; use strictest settings
- **Require SRI hashes**: Every CDN `<script>` and `<link>` must have `integrity` + `crossorigin`
- **Escape all attributes**: `href`, `src`, `data-*`, `title` -- not just text content

### Async / Race Conditions
- **Generation counters**: For any async operation that modifies shared DOM, increment a counter and check staleness after each await
- **Cancel timers on context switch**: Any debounced operation must be cancellable; call cancel before changing state
- **Busy guards**: Async button handlers need `if (busy) return` + `try/finally` to reset

### State Management
- **Clear state on every exit path**: Cancel, Discard, Close, Error -- each must clean up pending references
- **Document state variables**: List all module-level state vars with their purpose at the top

### Architecture
- **Event delegation for dynamic lists**: Single listener on container, `e.target.closest()` to dispatch
- **Keep docs in sync**: Update CLAUDE.md and plan docs in the same PR as code changes

## Checklist for Future PRs

- [ ] No `innerHTML` with unescaped dynamic values
- [ ] All dynamic attribute values escaped
- [ ] New CDN resources have SRI hashes
- [ ] Third-party library security configs audited
- [ ] Async DOM operations use generation counter or AbortController
- [ ] Debounced timers cancelled on state change
- [ ] Modal buttons have busy guards
- [ ] All modal exit paths clear pending state
- [ ] Dynamic lists use event delegation
- [ ] CLAUDE.md reflects current state

## Related Files

- Todo items: `todos/001-010` (all marked completed)
- Plan doc: `docs/plans/2026-02-08-fix-document-sidebar-discard-navigation-bugs-plan.md`
- Original findings: Security Sentinel, Frontend Races Reviewer, Architecture Strategist (PR #2)
