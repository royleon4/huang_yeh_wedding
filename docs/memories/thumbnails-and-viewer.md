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
- Clicking a photo opens `/Memories/api/photos/:id/media`, which streams the original.
- Thumbnails use long immutable browser caching.
- Original media uses a shorter cache policy.

## Fullscreen viewer

- Covers the full viewport, including mobile safe areas.
- Loads the original image only after the user opens a photo.
- Supports previous/next buttons, keyboard arrows, and horizontal swipe.
- Supports mouse wheel, buttons, double-click, and pinch zoom from 100% to 500%.
- Supports dragging a zoomed image.
- Resets zoom when changing photos and preloads the adjacent originals.
- Locks background scrolling while open and restores focus to the originating gallery item when closed.
