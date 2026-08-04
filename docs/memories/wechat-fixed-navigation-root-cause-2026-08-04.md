# WeChat fixed bottom navigation root cause

Date: 2026-08-04

## Symptom

Inside the WeChat built-in browser, the mobile collection navigation appeared at the bottom of the complete scrollable document instead of staying at the visible viewport bottom. Chrome did not reproduce the issue.

## Root cause

`bottom-collection-nav.css` declared `container-type: inline-size` on `body` so the desktop sidebar could use a container query. Size/layout containment can establish a containing block for fixed-position descendants. The WeChat WebView consequently resolved `.bottom-collection-nav { position: fixed; bottom: 0; }` against the document/body containing block rather than the visual viewport.

A VisualViewport offset cannot repair this case because the element is attached to the wrong containing block, not merely offset from the correct viewport.

## Fix

- Remove container containment from `body`.
- Replace the single page-width container query with a viewport media query at the same `42.875rem` threshold.
- Remove the obsolete WeChat-only VisualViewport offset helper.

The page container occupied the viewport width, so changing from a page-width container query to the same viewport media-query threshold preserves the existing desktop breakpoint while allowing fixed positioning to remain viewport-relative.

## Regression guard

`public-layout-polish.test.mjs` now rejects `container-name: memories-page`, `container-type: inline-size`, and `@container memories-page` in the bottom navigation stylesheet while requiring the unchanged `@media (min-width: 42.875rem)` desktop breakpoint.
