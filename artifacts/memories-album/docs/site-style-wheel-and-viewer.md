# Site style, site icon, wheel looping, and photo viewer

> **Status:** Current feature contract  
> **Reviewed:** 2026-08-01T19:33:00+08:00 (Asia/Taipei)

This document describes the administrator and public behavior for Memories appearance controls, the editable website icon, per-album wheel looping, responsive bottom navigation, language control, and fullscreen photo viewer.

## Administrator location and save model

Open:

```text
/Memories/admin/general
```

The General tab contains:

- **樣式與首頁首圖**
- **其他網站文字**
- **網站圖示**
- **上傳方式**
- **媒體順序**
- **子分類操作方式**

Appearance and icon changes participate in the page-level **儲存所有變更** workflow. Choosing, removing, resetting, or previewing an image remains a draft until the global action succeeds.

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

## Website title and other copy

The style card owns the bilingual website title, including deliberate line breaks.

The separate **其他網站文字** card edits dates, descriptions, and remaining public interface text. It does not edit the title.

Both sections read the latest saved copy before merging fields, so saving one section cannot overwrite fields owned by the other.

## Site icon

The **網站圖示** card accepts:

- PNG
- JPG or JPEG
- WebP
- up to 5 MB

A square, centered source with a transparent background is recommended. The server normalizes the saved icon to a **192 × 192 PNG**.

The administrator can:

- select or replace an icon;
- remove the custom icon;
- cancel a pending icon draft.

The controlled public icon route supplies the browser favicon and touch icon. Metadata is exposed to the client; stored image bytes are not embedded in the public settings JSON.

Browsers may cache favicons. After a successful save, refreshing or reopening the page may be required before the new tab icon appears.

## Responsive bottom navigation

The bottom navigation keeps its compact, Safe-Area-aware container while using responsive `clamp()` sizing for:

- collection icons;
- collection labels;
- the central upload action;
- button widths and spacing.

Labels wrap instead of truncating. Buttons retain at least a 44-pixel-equivalent touch target. Administrator-selected navigation colors reuse global style variables.

## Language switcher

The Chinese/English switcher remains inside the hero header. It is not a viewport-fixed floating control.

Changing language preserves the current album, label, and photo identity when that route is available in the other language.

## Per-album wheel looping

Under **子分類操作方式**, the administrator can enable infinite horizontal looping independently for:

- 婚禮流程 (`wedding`)
- 訪客上傳 (`guest`)

When looping is disabled, the wheel remains finite.

When looping is enabled, the wheel renders complete interactive copies of the logical sequence before and after the real items so visible options fill both directions without empty edge space. A visible copied item can be clicked and selects the same logical label as its real counterpart.

Copied items are deliberately excluded from the canonical tab role and keyboard tab order, so assistive technology still has one semantic tab identity for each logical item. After scrolling or choosing a copy, the wheel recenters on the matching real item without changing the selected route. Arrow-key navigation follows the same wrap rule.

Only one visible wheel item receives the active visual state. The real logical item retains canonical `aria-selected` and keyboard focus semantics even when a repeated copy was clicked.

The setting is stored as `process_wheel_loop_album_ids`. Unsupported or duplicate album IDs are rejected by the administrator API.

## Fullscreen photo viewer

The fullscreen viewer intentionally displays the already loaded thumbnail for immediate, bandwidth-conscious viewing. It does not label that thumbnail as an original.

The toolbar contains:

- **查看原圖 / View original** at the upper left; it opens the controlled `mediaUrl` in a new tab with `noopener noreferrer`;
- the close control at the upper right.

Previous and next navigation remain available for the current gallery sequence.

Visible minus, percentage, and plus controls are removed. Existing zoom interaction remains available through:

- mouse wheel;
- pinch gesture;
- double-click or double-tap style activation where supported;
- keyboard `+`, `-`, and `0`;
- panning while zoomed.

The loading message is the neutral **正在載入照片… / Loading photo…**.

## Persistence and migration

These features reuse the existing `memories_app_settings` JSON key/value table. They introduce no database migration and make no Google Drive folder change.

Stored settings include:

```text
site_style
hero_background
site_icon
process_wheel_loop_album_ids
```

## Tests

Preservation coverage includes:

- site-style validation and generated CSS variables;
- metadata-only public settings;
- 1600 × 900 WebP hero normalization;
- 192 × 192 PNG icon normalization;
- pre-render style application;
- independent title and copy merging;
- complete clickable looping copies on both sides;
- one visual active wheel item and canonical tab semantics;
- keyboard wrapping;
- per-album loop persistence and validation;
- responsive bottom-navigation sizing;
- hero-contained language control;
- thumbnail viewer behavior and true-original link;
- global save coordination;
- production build and server health smoke test.

Current CI does not yet render the completed surface through a required Playwright browser gate. Transform-sensitive appearance or wheel changes require a real-browser check in addition to source-contract tests.

## Maintainer change checklist

When changing these surfaces:

1. preserve the General-tab save coordinator contract;
2. keep image bytes out of public settings JSON;
3. verify title and body copy cannot overwrite one another;
4. verify Safe Area, label wrapping and minimum touch targets;
5. test finite and looping wheels with mouse, touch and keyboard;
6. keep clone semantics separate from canonical tabs;
7. verify the viewer on portrait and landscape photos;
8. run the final production transform chain and browser check;
9. update [`../../../ADMIN_GUIDE.md`](../../../ADMIN_GUIDE.md) and [`../../../MAINTAINER_GUIDE.md`](../../../MAINTAINER_GUIDE.md) when behavior changes.
