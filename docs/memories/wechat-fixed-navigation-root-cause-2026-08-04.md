# WeChat fixed bottom navigation root cause

Date: 2026-08-04

## Symptom

Inside the WeChat built-in browser, the mobile collection navigation appeared at the bottom of the complete scrollable document instead of staying at the visible viewport bottom. Chrome did not reproduce the issue.

## Root cause

`bottom-collection-nav.css` declared `container-type: inline-size` on `body` so the desktop sidebar could use a container query. Size/layout containment can establish a containing block for fixed-position descendants. The WeChat WebView consequently resolved `.bottom-collection-nav { position: fixed; bottom: 0; }` against the document/body containing block rather than the visual viewport.

A VisualViewport offset cannot repair this case because the element is attached to the wrong containing block, not merely offset from the correct viewport.

## Fix

- Remove container containment from `body`.
- Replace the page-width container query with a viewport media query.
- Use a `44rem` viewport threshold: the former `42.875rem` content requirement plus `1.125rem` for classic 15–18px scrollbars.
- Remove the obsolete WeChat-only VisualViewport offset helper.

The added scrollbar allowance preserves the previous Chrome behavior at 700px and 720px while maintaining the original minimum right-pane width. Overlay-scrollbar browsers switch no earlier than before, so the change cannot create a sidebar overlap.

## Regression guard

`public-layout-polish.test.mjs` and `fixed-navigation-containing-block.test.mjs` reject `container-name: memories-page`, `container-type: inline-size`, and `@container memories-page` in the bottom navigation stylesheet while requiring the scrollbar-safe `@media (min-width: 44rem)` desktop breakpoint.
