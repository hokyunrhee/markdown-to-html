---
status: completed
priority: p2
issue_id: "003"
tags: [bug, race-condition, ui, data-integrity]
dependencies: []
---

# No Double-Click Protection on Modal Buttons

## Problem Statement
`handleConfirmSave()` is async -- it awaits IndexedDB operations while the confirm modal stays fully interactive. Double-clicking "Save & Open" creates duplicate documents. Clicking "Discard" while the save is in-flight corrupts `lastSavedContent`, causing `hasUnsavedChanges()` to silently lie. The same issue affects `handleSaveConfirm()` in the save modal.

## Findings
- Location: `js/app.js:431-454` (confirm modal), `js/app.js:398-419` (save modal)
- Both `handleConfirmSave()` and `handleSaveConfirm()` are async with no re-entry guard
- User can click multiple buttons during the await, causing overlapping state mutations
- Worst case: `lastSavedContent` gets set to old content after editor already shows new document content, so `hasUnsavedChanges()` returns false when it should return true -- user loses work silently

## Proposed Solutions

### Option 1: Guard flag + button disabling
- **Pros**: Simple, explicit, covers both modals with the same pattern
- **Cons**: Need to re-enable in `finally` block for error paths
- **Effort**: Small (30 minutes)
- **Risk**: Low

## Recommended Action
Add a `confirmBusy` boolean guard. At the top of `handleConfirmSave()`, check and set the flag, disable all three buttons (Save, Discard, Cancel). Re-enable in `finally`. Apply the same pattern to `handleSaveConfirm()` with the save modal buttons.

## Technical Details
- **Affected Files**: `js/app.js`
- **Related Components**: Confirm modal, save modal, IndexedDB save operations
- **Database Changes**: No

## Resources
- Original finding: Frontend Races Reviewer, PR #2

## Acceptance Criteria
- [ ] Double-clicking "Save & Open" does not create duplicate documents
- [ ] Clicking "Discard" during in-flight save does not corrupt state
- [ ] Double-clicking save modal confirm does not create duplicate documents
- [ ] Buttons re-enable on error paths
- [ ] Existing happy-path flows still work

## Work Log

### 2026-02-08 - Approved for Work
**By:** Claude Triage System
**Actions:**
- Issue approved during triage session
- Status: **ready**

**Learnings:**
- "Click quickly" scenarios are not exotic -- users always click quickly
- ~10 lines of code per modal to fix

## Notes
Source: Triage session on 2026-02-08
