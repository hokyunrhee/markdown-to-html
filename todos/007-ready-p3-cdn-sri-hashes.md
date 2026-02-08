---
status: completed
priority: p3
issue_id: "007"
tags: [security, supply-chain, cdn, sri]
dependencies: []
---

# No Subresource Integrity (SRI) Hashes on CDN Resources

## Problem Statement
Six JavaScript and three CSS files are loaded from `cdn.jsdelivr.net` without `integrity` attributes. If the CDN were compromised, a supply-chain attack could inject malicious code into every user's browser session, with full access to IndexedDB documents.

## Findings
- Location: `index.html:176-187`
- Affected resources: marked.js, KaTeX (JS + CSS + auto-render), Prism.js (+ autoloader), Mermaid, Google Fonts CSS
- No `integrity` or `crossorigin` attributes on any CDN tag
- A CDN compromise would grant full control over the application

## Proposed Solutions

### Option 1: Add SRI hashes to all CDN resources
- **Pros**: Industry standard defense against CDN compromise, zero runtime cost
- **Cons**: Hashes must be regenerated if CDN versions are updated
- **Effort**: Small (30 minutes -- generate hashes for each resource)
- **Risk**: Low

## Recommended Action
Generate SHA-384 hashes for each CDN resource and add `integrity` and `crossorigin="anonymous"` attributes to all `<script>` and `<link>` tags in `index.html`.

## Technical Details
- **Affected Files**: `index.html`
- **Related Components**: All CDN-loaded dependencies
- **Database Changes**: No

## Resources
- Original finding: Security Sentinel code review agent, PR #2
- SRI specification: https://developer.mozilla.org/en-US/docs/Web/Security/Subresource_Integrity

## Acceptance Criteria
- [ ] All CDN `<script>` tags have `integrity` and `crossorigin="anonymous"` attributes
- [ ] All CDN `<link>` tags have `integrity` and `crossorigin="anonymous"` attributes
- [ ] Application loads correctly with SRI hashes in place
- [ ] Hash values verified against known-good resource content

## Work Log

### 2026-02-08 - Approved for Work
**By:** Claude Triage System
**Actions:**
- Issue approved during triage session
- Status: **ready**

**Learnings:**
- Pre-existing issue, not introduced by PR #2
- Standard security hardening for any app loading scripts from CDN

## Notes
Source: Triage session on 2026-02-08
