# Memories thumbnails and fullscreen viewer

## Thumbnail policy

- Every indexed original photo must have a compressed WebP thumbnail.
- Existing database-linked thumbnails are reused.
- If the database link is missing, the system first searches `系統縮圖` for the deterministic thumbnail filename.
- Only when no existing derivative is found does the server download the original and generate a new thumbnail.
- Concurrent requests for the same photo share one generation operation.
- Cross-photo thumbnail and responsive-variant work uses the same bounded
  generation queue.
- If multiple application instances race, the database keeps the first linked thumbnail and the duplicate derivative is removed best-effort.
- Background reconciliation fills missing thumbnails in bounded batches.
- A thumbnail request may generate the missing derivative on demand. If Drive thumbnail repair is temporarily unavailable, it may return metadata-sanitized public media for that request only; it never sends the raw Drive original.

## Delivery behavior

- Waterfall pages use versioned 480/960 WebP `srcset` variants at
  `/Memories/api/photos/:id/thumbnail?v=...&width=...`.
- Clicking a photo opens the versioned `/Memories/api/photos/:id/media?v=...`,
  which returns a decoded and re-encoded copy with EXIF/GPS removed.
- Public media decoding is limited by source bytes and pixel dimensions, and
  cross-photo sanitization uses a bounded queue plus a bounded in-memory cache.
- Thumbnails and sanitized media use `private, no-store`. This intentionally
  trades repeat-request bandwidth for withdrawal privacy: shared caches must not
  keep serving a photo after it enters the seven-day trash.

## Fullscreen viewer

- Covers the full viewport, including mobile safe areas.
- Loads full public media only after the user opens a photo.
- Supports previous/next buttons, keyboard arrows, and horizontal swipe.
- Supports mouse wheel, buttons, double-click, and pinch zoom from 100% to 500%.
- Supports dragging a zoomed image within bounded visible edges.
- Resets zoom when changing photos and does not preload adjacent full media.
- Locks background scrolling, traps focus, makes the background inert and restores focus to the originating gallery item when closed.
