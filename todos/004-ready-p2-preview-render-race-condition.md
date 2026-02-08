---
status: completed
priority: p2
issue_id: "004"
tags: [race-condition, preview, mermaid, async]
dependencies: []
---

# `updatePreview()` Called Without `await` -- Concurrent Parse Race

## Problem Statement
`updatePreview()` is async (calls `MarkdownParser.parse()` which does async Mermaid rendering), but it's called fire-and-forget in `loadDocument()` and `resetToNewDocument()`. If the user quickly loads two different documents, two concurrent parses write to the same `preview` container, causing DOM corruption -- Mermaid SVGs from the first document can leak into the second document's preview.

## Findings
- Location: `js/app.js:367,375` (fire-and-forget calls), `js/markdown.js:182-205` (async parse)
- `container.innerHTML = html` at `markdown.js:196` runs synchronously, but `await renderMermaid(container)` is async
- A second `parse()` call replaces `innerHTML` mid-render, leaving the first call's Mermaid rendering orphaned
- Same pattern exists in `debouncedUpdatePreview` during normal typing, but the 300ms debounce makes it less likely

## Proposed Solutions

### Option 1: Generation counter to discard stale renders
- **Pros**: Simple, no API changes needed, works for both document loads and typing
- **Cons**: Stale render still starts before being discarded (minor wasted work)
- **Effort**: Small (30 minutes)
- **Risk**: Low

## Recommended Action
Add a `previewGeneration` counter in `App`. Increment on each `updatePreview()` call. After each `await` point inside the render pipeline, check if the generation is still current and bail if not.

## Technical Details
- **Affected Files**: `js/app.js` (generation counter), potentially `js/markdown.js` (staleness check between innerHTML and Mermaid render)
- **Related Components**: Preview rendering, Mermaid diagram rendering
- **Database Changes**: No

## Resources
- Original finding: Frontend Races Reviewer, PR #2

## Acceptance Criteria
- [ ] Rapidly loading two documents with Mermaid diagrams does not cause SVG leaking
- [ ] Normal typing preview still works correctly with debounce
- [ ] No console errors from stale Mermaid renders
- [ ] Preview shows correct content for the most recently loaded document

## Work Log

### 2026-02-08 - Approved for Work
**By:** Claude Triage System
**Actions:**
- Issue approved during triage session
- Status: **ready**

**Learnings:**
- Fire-and-forget async calls to shared DOM containers are a common source of UI races
- Generation counter is the standard pattern for this class of problem

## Notes
Source: Triage session on 2026-02-08
