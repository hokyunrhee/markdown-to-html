---
status: completed
priority: p3
issue_id: "008"
tags: [security, defense-in-depth, html-escaping]
dependencies: []
---

# `dateStr` and `doc.id` Not Escaped in `innerHTML`

## Problem Statement
In `renderDocumentList()`, `doc.title` is properly escaped via `escapeHtml()`, but `dateStr` and `doc.id` are inserted raw into `innerHTML`. Under the current schema neither can produce injectable output, but inconsistent escaping is a defense-in-depth gap that could become exploitable if the data model evolves.

## Findings
- Location: `js/app.js:275` (`dateStr` unescaped), `js/app.js:278-283` (`doc.id` unescaped in `data-id` attributes)
- `doc.id` is an IndexedDB auto-increment integer -- always a number today
- `dateStr` comes from `formatDate()` which produces strings like "Just now", "5m ago", locale dates -- always safe today
- `doc.title` is escaped on the same line, making the inconsistency visible

## Proposed Solutions

### Option 1: Apply `escapeHtml()` consistently to all dynamic values
- **Pros**: Consistent pattern, defense-in-depth, prevents future issues if schema changes
- **Cons**: Negligible overhead
- **Effort**: Small (10 minutes)
- **Risk**: Low

## Recommended Action
Change `${dateStr}` to `${escapeHtml(dateStr)}` and `data-id="${doc.id}"` to `data-id="${escapeHtml(String(doc.id))}"`.

## Technical Details
- **Affected Files**: `js/app.js`
- **Related Components**: Document sidebar list rendering
- **Database Changes**: No

## Resources
- Original finding: Security Sentinel code review agent, PR #2

## Acceptance Criteria
- [ ] All dynamic values in `renderDocumentList()` innerHTML are escaped
- [ ] Document list still renders correctly
- [ ] Rename and delete buttons still work (data-id preserved)

## Work Log

### 2026-02-08 - Approved for Work
**By:** Claude Triage System
**Actions:**
- Issue approved during triage session
- Status: **ready**

**Learnings:**
- Consistent escaping is easier to audit than selective escaping

## Notes
Source: Triage session on 2026-02-08
