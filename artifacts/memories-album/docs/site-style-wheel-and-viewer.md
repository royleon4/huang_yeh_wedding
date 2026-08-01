# Site style, wheel looping, and photo viewer

This document describes the administrator and public behavior introduced for the Memories appearance controls, per-album wheel looping, responsive bottom navigation, and fullscreen photo viewer.

## Administrator location

Open:

```text
/Memories/admin/general
```

The General tab contains **樣式與首頁首圖**. Changes participate in the existing page-level **儲存所有變更** workflow. Choosing, removing, or resetting an image remains a draft until that global action succeeds.

## Hero background

The style card accepts:

- PNG
- JPG or JPEG
- WebP
- up to 10 MB

The recommended source is a horizontal 16:9 image at **1600 × 900** or larger. The server:

1. reads orientation metadata;
2. centers and cover-crops the source to 1600 × 900;
3. converts the result to WebP;
4. stores the normalized asset in `memories_app_settings`;
5. exposes only metadata through `/Memories/api/settings`;
6. serves image bytes through `/Memories/api/settings/site-style/hero-background` with ETag handling.

The administrator can replace, remove, or cancel a pending background change. The preview uses the selected local file before save.

## Overlay and colors

The hero overlay opacity ranges from 0% through 95%. Higher values make the background less prominent and improve text contrast.

Editable color groups cover:

- page and secondary backgrounds;
- primary and secondary text;
- primary, soft-primary, detail, and accent colors;
- hero title, date, subtitle, and overlay colors;
- bottom-navigation background, labels, and selected-item background.

Colors are stored as six-digit hexadecimal values. Public CSS variables are applied before React creates the public gallery root, avoiding a flash of the bundled default palette.

## Website title

The style card owns the bilingual website title, including deliberate line breaks. The separate website-copy card edits the remaining text only. Both cards read the latest saved copy before merging their own fields, so saving one card cannot overwrite pending or newly saved fields owned by the other card.

## Responsive bottom navigation

The bottom navigation keeps its compact, Safe-Area-aware container while using responsive `clamp()` sizing for:

- collection icons;
- collection labels;
- the central upload action;
- button widths and spacing.

Labels wrap instead of truncating. Buttons retain at least a 44-pixel-equivalent touch target. The administrator-selected navigation colors reuse the global style variables.

## Per-album wheel looping

Under **子分類操作方式**, the administrator can enable infinite horizontal looping independently for:

- 婚禮流程 (`wedding`)
- 訪客上傳 (`guest`)

When looping is disabled, the wheel remains finite. When enabled, the component renders non-interactive start/end sentinels, recenters on the corresponding real item, and keeps one logical identity for each album label. Arrow-key navigation follows the same wrap rule.

The setting is stored as `process_wheel_loop_album_ids`. Unsupported or duplicate album IDs are rejected by the administrator API.

## Fullscreen photo viewer

The fullscreen viewer intentionally displays the already loaded thumbnail for immediate, bandwidth-conscious viewing. It does not label that thumbnail as an original.

The toolbar contains:

- **查看原圖 / View original** at the upper left; it opens the controlled `mediaUrl` in a new tab with `noopener noreferrer`;
- the close control at the upper right.

Visible minus, percentage, and plus controls are removed. Existing interaction remains available through:

- mouse wheel;
- pinch gesture;
- double-click or double-tap style activation where supported;
- keyboard `+`, `-`, and `0`;
- panning while zoomed.

The loading message is the neutral **正在載入照片… / Loading photo…**.

## Persistence and migration

The feature reuses the existing `memories_app_settings` JSON key/value table. It introduces no database migration and makes no Google Drive schema or folder change.

Stored keys:

```text
site_style
hero_background
process_wheel_loop_album_ids
```

## Tests

The preservation coverage includes:

- site-style validation and generated CSS variables;
- metadata-only public settings;
- 1600 × 900 WebP normalization;
- pre-render bootstrap application;
- independent title and copy merging;
- wheel sentinel order and keyboard wrapping;
- per-album loop persistence and validation;
- responsive bottom-navigation sizing;
- thumbnail viewer behavior and true-original link;
- production build and server health smoke test.
