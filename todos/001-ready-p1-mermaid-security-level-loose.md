---
status: completed
priority: p1
issue_id: "001"
tags: [security, xss, mermaid]
dependencies: []
---

# Mermaid `securityLevel: 'loose'` Enables Script Execution in Diagrams

## Problem Statement
Mermaid is initialized with `securityLevel: 'loose'`, which disables its built-in XSS protections. Crafted Mermaid diagrams can execute arbitrary JavaScript via `click` callbacks and HTML labels. If a user pastes content from an untrusted source, or if exported HTML files are shared, this becomes a persistent XSS vector.

## Findings
- Location: `js/markdown.js:69`
- Mermaid's `securityLevel: 'loose'` allows script execution in diagram definitions
- Exported HTML files carry rendered SVGs, propagating the payload to anyone who opens them
- IndexedDB stores all documents, so a malicious diagram could exfiltrate or destroy all saved data

## Proposed Solutions

### Option 1: Change to `'strict'`
- **Pros**: One-word change, highest security, Mermaid default
- **Cons**: Disables interactive click events on diagram nodes (unlikely to be needed)
- **Effort**: Small (5 minutes)
- **Risk**: Low

## Recommended Action
Change `securityLevel: 'loose'` to `securityLevel: 'strict'` in `js/markdown.js` line 69.

## Technical Details
- **Affected Files**: `js/markdown.js`
- **Related Components**: Markdown preview, HTML export
- **Database Changes**: No

## Resources
- Original finding: Security Sentinel code review agent, PR #2
- Mermaid security docs: https://mermaid.js.org/config/usage.html#securitylevel

## Acceptance Criteria
- [ ] `securityLevel` changed to `'strict'`
- [ ] Mermaid diagrams still render correctly in preview
- [ ] Exported HTML files do not contain executable scripts from diagrams

## Work Log

### 2026-02-08 - Approved for Work
**By:** Claude Triage System
**Actions:**
- Issue approved during triage session
- Status: **ready**
- Ready to be picked up and worked on

**Learnings:**
- Pre-existing issue, not introduced by PR #2
- One-word fix with high security impact

## Notes
Source: Triage session on 2026-02-08
