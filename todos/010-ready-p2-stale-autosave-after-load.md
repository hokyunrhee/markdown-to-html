---
status: completed
priority: p2
issue_id: "010"
tags: [race-condition, autosave, data-integrity]
dependencies: []
---

# Stale Debounced Autosave Fires After Document Load

## Problem Statement
When a user is editing and `debouncedSave()` has been scheduled (1-second timer), then quickly loads a different document via the sidebar, the pending debounce timer can fire *after* the new document's content is loaded — overwriting the autosave slot with stale content from the previous document.

## Findings
- Location: `js/storage.js:107-117` (`debouncedSave` with 1s debounce), `js/app.js:362-368` (`loadDocument`)
- `debouncedSave` uses `setTimeout`/`clearTimeout` but only exposes the save function, not a cancel method
- `loadDocument()` sets `editor.value` and `lastSavedContent` but does not cancel the pending autosave timer
- Same issue exists in `resetToNewDocument()`
- Window of vulnerability: up to 1 second after the last keystroke

## Proposed Solutions

### Option 1: Expose `cancelPendingAutosave()` on Storage module
- **Pros**: Clean API, prevents stale writes, no behavior change for normal editing flow
- **Cons**: Minor API addition to Storage module
- **Effort**: Small (15 minutes)
- **Risk**: Low

## Recommended Action
1. Add a `cancelPendingAutosave()` method to the Storage module that calls `clearTimeout` on the debounce timer
2. Call `Storage.cancelPendingAutosave()` at the top of `loadDocument()` and `resetToNewDocument()` in `app.js`

## Technical Details
- **Affected Files**: `js/storage.js`, `js/app.js`
- **Related Components**: Autosave system, document loading
- **Database Changes**: No

## Resources
- Original finding: Frontend Races Reviewer, PR #2

## Acceptance Criteria
- [ ] `Storage` module exposes `cancelPendingAutosave()` method
- [ ] `loadDocument()` cancels pending autosave before loading new content
- [ ] `resetToNewDocument()` cancels pending autosave before resetting
- [ ] Normal autosave still works during editing
- [ ] Rapid document switching does not corrupt autosave slot

## Work Log

### 2026-02-08 - Approved for Work
**By:** Claude Triage System
**Actions:**
- Issue approved during triage session
- Status: **ready**

**Learnings:**
- Debounce timers must be cancelled when the context they operate in changes (e.g., switching documents)

## Notes
Source: Triage session on 2026-02-08
