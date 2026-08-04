# Cross-browser validation plan

Date: 2026-08-04

## Browser-engine coverage

The Memories production bundle is validated by rendering and geometry rather than browser-brand screenshots alone:

- Chromium desktop: representative of Chrome and Edge.
- Chromium mobile: representative of Chrome Android, Samsung Internet, Android System WebView, and most Android embedded browsers.
- Firefox desktop: Gecko-specific layout behavior.
- WebKit desktop: representative WebKit coverage for Safari layout behavior.
- WebKit mobile: representative coverage for iOS Safari and iOS embedded browsers.
- WeChat Android: Chromium mobile with a current `MicroMessenger` user agent, combined with structural regression tests that prevent fixed navigation from acquiring a document containing block.

Playwright WebKit on Linux validates the WebKit engine but is not a branded macOS or iOS Safari binary. Proprietary WeChat browser chrome also still requires a final real-device confirmation after deployment.

## Production surfaces

`artifacts/memories-album/e2e/cross-browser-layout.spec.mjs` checks the built production server with deterministic API fixtures:

- mobile bottom navigation remains at the visible viewport bottom before and after scrolling;
- the established 700px bottom-bar and 720px sidebar boundary remains unchanged;
- desktop sidebar, header, main content, process selector, video, rich text, and photo cards do not overlap or overflow;
- long Chinese and English labels remain inside the viewport;
- the guestbook and administrator surface do not create horizontal page scrolling;
- browser page errors and `console.error` output fail the gate.

## Execution policy

The heavy browser suite is intentionally separate from Fast CI:

- manually through `workflow_dispatch`;
- weekly on Tuesday;
- on non-Draft pull requests that change a public client, CSS, UI transform, Vite configuration, browser test, or its workflow;
- after matching changes merge to `main`.

A newer run cancels an older run for the same PR or branch. Failure evidence retains screenshots, traces, video, and the HTML report for 14 days.

## Change rule

Browser-specific corrections must be scoped by capability or the smallest proven affected environment. Existing dimensions, spacing, typography, colors, and DOM order are not changed unless a reproduced browser defect cannot be corrected without doing so.
