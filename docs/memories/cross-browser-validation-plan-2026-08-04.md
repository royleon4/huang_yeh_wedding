# Cross-browser validation plan

Date: 2026-08-04

## Browser-engine coverage

The public Memories layout is validated by rendering and geometry rather than browser-brand screenshots alone:

- Chromium: Chrome, Edge, Samsung Internet, Android System WebView, and most Android embedded browsers.
- Gecko: Firefox.
- WebKit: Safari, iOS Safari, and iOS embedded browsers.
- WeChat Android: Chromium-based WebView plus WeChat-specific fixed-position and viewport constraints.

## Required layout surfaces

- Bottom collection navigation remains at the visible viewport bottom on narrow screens and becomes the existing sticky sidebar at the unchanged desktop threshold.
- Navigation, process selectors, videos, rich content, photo grid, guestbook, upload controls, modals, and lightbox do not overflow the viewport horizontally.
- Safe-area padding remains intact.
- Long Chinese and English labels wrap instead of clipping controls.
- Visual fallback remains usable when backdrop blur, color mixing, dynamic viewport units, or container queries are unavailable.

## Change rule

Browser-specific workarounds must be scoped by capability or the smallest proven affected environment. Existing dimensions, spacing, typography, colors, and DOM order are not changed unless an observed browser defect cannot be corrected without doing so.
