---
status: completed
priority: p2
issue_id: "005"
tags: [security, xss, markdown-renderer]
dependencies: []
---

# Unescaped `href` in Image Renderer Allows Attribute Injection

## Problem Statement
In the custom marked.js image renderer, `href` is inserted directly into the `src` attribute without `escapeHtml()`. The `title` and `text` parameters are properly escaped, but `href` is not. A crafted URL containing `"` could break out of the attribute context, enabling attribute injection and potential script execution via `onerror`.

## Findings
- Location: `js/markdown.js:48-51`
- `title` and `text` are escaped: `escapeHtml(title)`, `escapeHtml(text)`
- `href` is raw: `src="${href}"` -- inconsistent with the other attributes
- Marked.js may partially sanitize, but defense-in-depth requires explicit escaping at the renderer level

## Proposed Solutions

### Option 1: Escape `href` through `escapeHtml()`
- **Pros**: One-line fix, consistent with existing escaping pattern, defense-in-depth
- **Cons**: None
- **Effort**: Small (5 minutes)
- **Risk**: Low

## Recommended Action
Change line 51 from `src="${href}"` to `src="${escapeHtml(href)}"`.

## Technical Details
- **Affected Files**: `js/markdown.js`
- **Related Components**: Markdown preview, HTML export
- **Database Changes**: No

## Resources
- Original finding: Security Sentinel code review agent, PR #2

## Acceptance Criteria
- [ ] `href` parameter passed through `escapeHtml()` in image renderer
- [ ] Normal image markdown still renders correctly
- [ ] Crafted URLs with `"` characters are safely escaped

## Work Log

### 2026-02-08 - Approved for Work
**By:** Claude Triage System
**Actions:**
- Issue approved during triage session
- Status: **ready**

**Learnings:**
- Pre-existing issue, not introduced by PR #2
- Inconsistent escaping across parameters in the same function is a common oversight

## Notes
Source: Triage session on 2026-02-08
