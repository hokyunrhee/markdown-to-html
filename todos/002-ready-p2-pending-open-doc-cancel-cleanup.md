---
status: completed
priority: p2
issue_id: "002"
tags: [architecture, state-management, bug-prevention]
dependencies: []
---

# `pendingOpenDoc` Not Cleared on Cancel

## Problem Statement
After the PR fix removed `pendingOpenDoc = null` from `closeConfirmModal()`, clicking "Cancel" on the confirm modal no longer clears the stale `pendingOpenDoc` reference. While currently harmless (the value is always overwritten before consumption), it leaves orphaned state that could cause subtle bugs if the confirm flow is ever extended.

## Findings
- Location: `js/app.js:594` (Cancel event binding), `js/app.js:427-429` (closeConfirmModal)
- `confirmCancel.addEventListener('click', closeConfirmModal)` calls `closeConfirmModal()` directly
- After the PR fix, `closeConfirmModal()` only hides the modal -- does not clear `pendingOpenDoc`
- `pendingOpenDoc` retains a stale document reference until the next `requestOpenDocument` call

## Proposed Solutions

### Option 1: Create explicit `handleConfirmCancel()` function
- **Pros**: Clear intent, defensive cleanup, mirrors `handleConfirmDiscard` and `handleConfirmSave` naming
- **Cons**: One more function
- **Effort**: Small (15 minutes)
- **Risk**: Low

## Recommended Action
Create `handleConfirmCancel()` that calls `closeConfirmModal()` then sets `pendingOpenDoc = null`. Update the event binding at line 594 to use this new handler.

## Technical Details
- **Affected Files**: `js/app.js`
- **Related Components**: Confirm modal, document navigation state machine
- **Database Changes**: No

## Resources
- Original finding: Architecture Strategist and Frontend Races Reviewer, PR #2

## Acceptance Criteria
- [ ] `handleConfirmCancel()` function created
- [ ] Cancel button uses `handleConfirmCancel` instead of `closeConfirmModal`
- [ ] `pendingOpenDoc` is null after Cancel is clicked
- [ ] Existing Discard and Save & Open flows still work

## Work Log

### 2026-02-08 - Approved for Work
**By:** Claude Triage System
**Actions:**
- Issue approved during triage session
- Status: **ready**

**Learnings:**
- Defensive state cleanup prevents future bugs as the confirm flow evolves

## Notes
Source: Triage session on 2026-02-08
