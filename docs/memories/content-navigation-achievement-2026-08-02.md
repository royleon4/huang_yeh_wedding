# Memories content navigation refactor and acceptance

> **Status:** Current dated achievement record  
> **Completed:** 2026-08-02T22:09:00+08:00（Asia/Taipei）  
> **Scope:** Standalone Memories public gallery navigation under `/Memories/`  
> **Implementation branch:** `refactor/memories-scroll-responsibilities`  
> **Pull request:** #166 — `refactor(memories): separate gallery movement responsibilities`  
> **Implementation head:** `f5cdc73b20ad8f17b1ce27282023f7796e961800`  
> **Merged to `main`:** `0e5feba386537080d2db3d8ef14729c9b43c202b`

## Achievement summary

The public Memories gallery now moves to the **first actually visible content block of the newly selected label**, instead of treating the whole gallery container or a specific media type as the destination.

The completed behavior was accepted by the repository owner after merge with the report:

> It is working.

This closes the concrete failure where selecting or swiping to a wedding-process label often moved the page upward only slightly and stopped before the selected content began. A YouTube embed exposed the problem clearly, but the solution is deliberately **not video-specific**. It applies equally to video, rich text, wedding photos, guest photos, state cards, and future content types that participate in the same content-block contract.

## Original user-visible failure

The reproducible symptom was:

1. Open the Wedding album.
2. Click or swipe to a different process label.
3. The active label and content change correctly.
4. The page moves upward only a small amount.
5. The beginning of the selected content remains below the intended viewing position; an embedded YouTube video may not be fully visible.

The important diagnostic detail was that the page **stopped at the wrong location immediately**. It was not primarily a delayed image-load jump.

## Root causes identified

The issue was not one isolated line. Several navigation responsibilities had accumulated across components.

### 1. The navigation destination was too broad

The previous shared formula targeted `#archive-gallery`, a large container that may contain several ordered media blocks. Its top is not guaranteed to be the top of the content the visitor should begin viewing.

### 2. The formula compensated for the entire sticky process section

The old calculation used the gallery position minus the full `.process-section` height and a small margin. On mobile, that sticky section can contain the collection heading, album tabs, summary, and process selector. Subtracting its full height can produce a target close to the visitor's current scroll position, which explains the observed small upward movement.

### 3. Selection and positioning were coupled too early

A label selection previously called the filter update and immediately scheduled navigation. Two animation frames were used as a timing assumption, but there was no explicit confirmation that the requested `activeId` had committed before resolving the target.

### 4. Old asynchronous requests could remain pending

Fast wheel movement can create several selection requests in succession. Without a latest-request guard, an older request may still be eligible to move the viewport after a newer selection.

### 5. More than one feature could influence vertical position

Process selection, collection-tab navigation, route restoration, and masonry anchor preservation each had a legitimate reason to interact with scrolling. Their responsibilities were distributed and partially duplicated, making the final movement difficult to reason about.

### 6. Masonry ownership was global instead of per grid

A page-level masonry query could resolve only the first `.masonry-grid`. Wedding-process content can contain more than one logical photo group, so each rendered grid needed its own measurement and observer lifecycle.

## Final behavior contract

### Selection flow

For a process or guest label selection, the current contract is:

```text
user click / wheel selection / keyboard selection
    -> ProcessWheel or TraditionalSelector reports the selected identity
    -> ProcessSelector records a pending selection
    -> the application updates activeFilter
    -> ProcessSelector observes the committed activeId
    -> masonry anchor restoration is suspended for navigation
    -> the latest content-navigation request waits for two animation frames
    -> the first actually visible content block is resolved
    -> one vertical scroll request moves to that block
```

Selecting the already-active label remains a valid navigation action and can reposition the current content without requiring a state change.

### Content-target resolution

`gallery-navigation.mjs` resolves the destination in this order:

1. The first visible direct media item matching:

   ```css
   .process-media-sequence > .process-media-item[data-media-block]
   ```

2. The first visible direct child of `#archive-gallery`.
3. `#archive-gallery` itself as the final fallback.

A candidate is considered visible only when it has measurable width and height and is not hidden through `display: none` or `visibility: hidden`.

The algorithm does **not**:

- search specifically for `.process-video-block`;
- assume video is first;
- assume the first item is video, text, or photos;
- branch on `activeCollection === "wedding"`;
- force a video to override the administrator's configured media order.

The `data-media-block` attribute identifies a content boundary. Its value does not choose a special scroll formula.

### Media-order compatibility

The target follows the actual rendered order. Therefore:

| First visible content | Navigation result |
| --- | --- |
| YouTube video | Starts at the video content block |
| Rich text or attachment content | Starts at the text/content block |
| Wedding-photographer photos | Starts at that photo group |
| Guest photos inside a wedding process | Starts at that photo group when ordered first |
| Guest album photos | Starts at the guest-photo content block without requiring video support |
| Empty, loading, or error state | Falls back to the first visible gallery child |
| Future registered content type | Works through the same visible content-block contract |

This preserves administrator-controlled media order and protects albums that do not contain embedded media.

### Latest-request rule

Every scheduled content-navigation request receives a monotonically increasing request identity. Only the newest request may perform the final viewport movement. This prevents stale animation-frame callbacks from earlier wheel positions from winning after the visitor reaches a newer label.

## Responsibility split after the refactor

### `ProcessWheel.jsx`

Owns horizontal behavior only:

- centered-item detection;
- pointer, wheel, and keyboard selection;
- loop clone-to-real recentering;
- explicit selection context: `click`, `wheel`, or `keyboard`.

It does not know the gallery destination, sticky offset, route, or vertical viewport policy.

### `ProcessSelector.jsx`

Owns the selection-to-navigation bridge:

- records the pending selected identity;
- forwards the selection to application state;
- waits for `activeId` to commit;
- supports reselecting the current identity;
- suspends masonry anchor restoration around navigation;
- requests the shared active-content navigation.

### `gallery-navigation.mjs`

Owns the shared vertical navigation policy:

- resolves the first actually visible content block;
- calculates the destination using the existing sticky-section offset contract;
- waits for two animation frames after the committed selection;
- allows only the latest pending request to scroll;
- retains compatibility exports for callers still using the former gallery-start names.

### `useMasonryLayout.mjs`

Owns per-grid layout and anchor preservation:

- each `PhotoGroupGrid` supplies its own grid reference;
- each grid owns its `ResizeObserver`, `MutationObserver`, image listeners, and row-span calculation;
- visible-anchor restoration can be suspended during explicit navigation;
- one grid no longer relies on a page-global first-match query.

### `CollectionTabNavigation.jsx`

Owns collection-tab navigation triggering separately from process-label selection. It does not restore the removed global `.process-chip` click listener.

### `GalleryAdminEntry.jsx`

Owns only the hidden administrator-entry gesture. It no longer shares unrelated responsibilities with layout and navigation code.

### `GalleryEnhancements.jsx`

Acts as a small composition boundary for focused controllers instead of owning masonry, process clicks, collection clicks, anchor restoration, and admin-entry behavior in one component.

## Changed files in PR #166

### Runtime source

- `artifacts/memories-album/src/client/CollectionTabNavigation.jsx`
- `artifacts/memories-album/src/client/GalleryAdminEntry.jsx`
- `artifacts/memories-album/src/client/GalleryEnhancements.jsx`
- `artifacts/memories-album/src/client/PhotoGroupGrid.jsx`
- `artifacts/memories-album/src/client/ProcessSelector.jsx`
- `artifacts/memories-album/src/client/ProcessWheel.jsx`
- `artifacts/memories-album/src/client/gallery-navigation.mjs`
- `artifacts/memories-album/src/client/useMasonryLayout.mjs`

### Tests and source contracts

- `artifacts/memories-album/test/feature-controls.test.mjs`
- `artifacts/memories-album/test/gallery-enhancements.test.mjs`
- `artifacts/memories-album/test/gallery-navigation.test.mjs`
- `artifacts/memories-album/test/gallery-scroll-stability.test.mjs`
- `artifacts/memories-album/test/process-rich-content.test.mjs`
- `artifacts/memories-album/test/process-wheel-selector.test.mjs`
- `artifacts/memories-album/test/public-bootstrap-ui-transform.test.mjs`

## Validation evidence

The final PR head passed both required GitHub Actions workflows before merge.

### Standalone Memories CI

- **454 tests passed**
- **0 failed**
- production Vite build passed;
- production Node server build passed;
- `/Memories/api/health` production smoke test passed.

The navigation-specific test coverage includes:

- first actually visible media block is selected regardless of type;
- fallback to the first visible gallery child;
- final fallback to the gallery container;
- exactly one scroll with the requested behavior;
- two-animation-frame scheduling;
- only the latest pending request can move the viewport;
- no-op behavior when the gallery is absent;
- masonry anchor restoration suspension;
- independent ownership for every photo grid;
- wheel and traditional selector integration with the shared content-navigation module.

### Memories legacy boundary

The legacy-boundary workflow passed, confirming that the standalone Memories changes did not cross into the protected legacy invitation surface.

### Manual acceptance

At 2026-08-02T22:09:00+08:00, after PR #166 had been merged to `main`, the repository owner reported that the corrected interaction was working.

This is a real acceptance signal for the originally reported flow. It is not a permanent substitute for a broader automated browser/device matrix; production Playwright coverage remains a separate architecture-hardening task.

## Explicitly unchanged

The achievement did not require changes to:

- CSS files;
- DOM display order;
- typography;
- spacing;
- component dimensions;
- colors, backgrounds, borders, or shadows;
- sticky visual styling;
- administrator-controlled media order;
- database schema or migrations;
- Google Drive storage behavior;
- public or administrator API contracts;
- photo, album, process, or upload data.

The refactor changed ownership, timing, target resolution, and concurrency control while preserving the approved visual presentation.

## Maintenance rules

Future work on this behavior should preserve the following rules:

1. Vertical content navigation must remain centralized in `gallery-navigation.mjs`.
2. `ProcessWheel.jsx` must not query gallery content or perform vertical scrolling.
3. Content targets must be resolved from actual visible content order, not from media-type assumptions.
4. New media types should participate through the content-block wrapper contract rather than by adding special-case selectors.
5. Process selection must not navigate before the requested `activeId` has committed.
6. Only the latest pending asynchronous navigation request may move the viewport.
7. Masonry anchor restoration must be suspended around explicit navigation.
8. Each photo grid must retain independent refs and observer ownership.
9. A visual or DOM-order change must be reviewed separately from this navigation contract.
10. Source-contract tests must describe the current intended architecture rather than preserve obsolete implementation strings.

## Remaining engineering risks

This achievement resolves the reported content-positioning failure, but it does not close every surrounding architecture risk.

- The production build still relies on exact-string Vite transforms in other areas.
- Full production browser behavior is not yet covered by Playwright.
- Mobile browser chrome, unusually short documents, and future fixed overlays should be included when a browser-level navigation test suite is added.
- Compatibility aliases for the old gallery-start function names still exist and may be retired in a later, separately reviewed cleanup.

These are follow-up hardening items, not evidence that the accepted fix is incomplete.

## Historical outcome

The work progressed through four distinct states:

1. **Diagnosis:** duplicated scroll ownership and an unsuitable gallery-level target were identified.
2. **Refactor:** movement responsibilities were separated on `refactor/memories-scroll-responsibilities`.
3. **Generalized fix:** navigation was changed from video-oriented reasoning to first-visible-content targeting after explicit review of variable media order.
4. **Acceptance:** PR #166 was merged into `main`, CI remained green, and the owner confirmed the interaction worked.

The lasting achievement is not only that one YouTube example now lands correctly. The gallery now has a maintainable, content-type-agnostic navigation contract that can support different albums and future media blocks without duplicating scroll logic.