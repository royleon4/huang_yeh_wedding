# Memories thumbnails and fullscreen viewer

## Thumbnail policy

- Every indexed original photo must have a compressed WebP thumbnail.
- Existing database-linked thumbnails are reused.
- If the database link is missing, the system first searches `系統縮圖` for the deterministic thumbnail filename.
- Only when no existing derivative is found does the server download the original and generate a new thumbnail.
- Concurrent requests for the same photo share one generation operation.
- If multiple application instances race, the database keeps the first linked thumbnail and the duplicate derivative is removed best-effort.
- Background reconciliation fills missing thumbnails in bounded batches.
- A thumbnail request may generate the missing derivative on demand, but it never silently streams the original as a gallery fallback.

## Delivery behavior

- Waterfall and multi-photo pages request `/Memories/api/photos/:id/thumbnail` only.
- Clicking a photo reuses the same thumbnail URL that the gallery already loaded, avoiding a second original-file download.
- Thumbnails use long immutable browser caching.
- Original media remains available through `/Memories/api/photos/:id/media` for future explicit download or original-view actions, but the fullscreen viewer does not request it.

## Fullscreen viewer

- Covers the full viewport, including mobile safe areas.
- Reuses the browser-cached thumbnail immediately when a photo is opened.
- Uses `object-fit: contain` in the complete remaining viewport, so portrait and landscape photos are fully visible at 100% zoom.
- Supports previous/next buttons, keyboard arrows, and horizontal swipe.
- Supports mouse wheel, buttons, double-click, and pinch zoom from 100% to 500%.
- Supports dragging a zoomed image.
- Resets zoom when changing photos and preloads only the adjacent thumbnails.
- Locks background scrolling while open and restores focus to the originating gallery item when closed.
