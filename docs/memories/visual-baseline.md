# Approved Memories visual baseline

> **Status:** Historical design baseline; partly superseded  
> **Reviewed:** 2026-08-01T19:33:00+08:00 (Asia/Taipei)  
> **Current contract:** `main`, [`../../README.md`](../../README.md), [`../../MAINTAINER_GUIDE.md`](../../MAINTAINER_GUIDE.md), [`../../artifacts/memories-album/README.md`](../../artifacts/memories-album/README.md) and current route/administrator documentation

This file preserves the original visual direction and early Product Phase 1 assumptions. It is **not** a current functional specification.

Important superseded assumptions include:

- wedding processes are no longer a bundled fixed list; numbered Google Drive folders are canonical;
- guest originals remain physically in `訪客上傳`, but they may be logically classified into wedding or life collections;
- current navigation, guest-label visibility and route behavior are defined by saved settings and stable identity routes;
- Product Phase 1 is complete, while People and Find-me remain unimplemented future features;
- the screenshot matrix below was an early acceptance plan, not evidence that those captures were completed.

Keep this document for visual provenance. Do not implement a current feature solely from this file without reconciling it against `main` and the Current documents indexed by [`../../DOCUMENTATION.md`](../../DOCUMENTATION.md).

Issue: #26

## Source of truth at the time of the original baseline

The original visual source of truth was the project-chat prototype:

- Product title: **詠葉婚禮照片檔案館**
- Selected direction: **靜謐婚禮檔案館**
- Prototype: `https://yongye-photo-archive.royleon4.chatgpt.site`

The React implementation was originally expected to reproduce the prototype rather than reinterpret it. Changes were permitted for accessibility, responsive correctness, performance, browser compatibility, or real-data integration, with visible deviations intended to be recorded.

## Original product composition

The approved page direction was a quiet, archival wedding gallery rather than a social-media feed.

1. A restrained wedding-archive masthead establishes the couple, date, and archival mood.
2. Four persistent primary destinations were planned:
   - 全部照片 / All photos
   - 人物 / People
   - 上傳 / Upload
   - 找找我 / Find me
3. During the original Phase 1 plan, People and Find me remained in their original visual positions and showed `即將推出 / Coming soon`; they made no face-related request.
4. A horizontally scrollable wedding-process rail sat before the gallery on mobile.
5. Photos used a varied-height waterfall/masonry arrangement rather than square cropping.
6. Administrator presentation included process add, delete, rename, reorder, and photo membership controls.
7. A process with no photos showed a deliberate archive-style waiting state rather than an empty white area.
8. Guest uploads were treated as a separate visible category in the original baseline.

## Original twelve-process inventory

The following list was the original design inventory. It is retained for history and is no longer the current source of truth for process creation or identity.

| Order | Traditional Chinese | English working label | Stable key |
|---:|---|---|---|
| 01 | 進場 | Entrance | `entrance` |
| 02 | 祈禱 | Prayer | `prayer` |
| 03 | 讚美 | Praise | `praise` |
| 04 | 聖經 | Scripture | `scripture` |
| 05 | 勉勵 | Message | `message` |
| 06 | 證婚 | Vows | `vows` |
| 07 | 謝親恩 | Honouring Parents | `parents` |
| 08 | 祝福 | Blessing | `blessing` |
| 09 | 答禮 | Response | `response` |
| 10 | 影片 | Film | `video` |
| 11 | 退場 | Recessional | `recessional` |
| 12 | 分組照相 | Group Photos | `group-photo` |

`訪客上傳 / Guest uploads` was treated as a separate category rather than process number 13.

## Visual inventory

### Mood

- quiet archive;
- warm, tactile paper rather than bright white application chrome;
- elegant and intimate rather than playful or corporate;
- wedding-green, cream, restrained warm yellow/gold, and a muted coral accent;
- botanical or archival ornament used sparingly.

### Colour roles

These were implementation starting points for comparison with the prototype:

| Role | Working value | Use |
|---|---|---|
| Paper background | `#f3eee2` | overall page and archival surfaces |
| Deep paper | `#e9e0d0` | subtle layers and dividers |
| Ink | `#223b31` | headings and primary text |
| Leaf green | `#355f4d` | selected controls and primary actions |
| Muted text | `#6e776f` | descriptions and secondary metadata |
| Archive gold | `#b59657` | numbering, rules, small accents |
| Muted coral | `#b96e5d` | date, notices, Coming-soon badges |

### Typography

- Display and archive headings: elegant high-contrast serif, with Playfair Display or the closest approved rendering.
- Traditional Chinese body and labels: Noto Serif TC or a compatible readable serif.
- Small English archival labels: compact sans serif with wide tracking.
- Avoid a generic dashboard appearance and avoid heavy bold weights.

### Shape and depth

- rounded archival panels and photo cards, but not exaggerated bubble UI;
- fine low-contrast borders;
- soft, broad shadows rather than dark floating cards;
- paper texture/grain may be present at low opacity;
- selected controls become deep green with cream text;
- guest-upload category uses a distinguishable dashed or coral treatment.

### Responsive behaviour

#### Phone

- two waterfall columns;
- four primary destinations remain readable without hiding People or Find me;
- wedding processes scroll horizontally with touch and snap naturally;
- controls have at least a 44px target where practical;
- lightbox supports swipe, close, previous/next, counter, and background scroll lock.

#### Tablet

- three waterfall columns;
- process rail remains horizontal unless the prototype clearly wraps it;
- archive masthead gains more breathing room.

#### Desktop

- four waterfall columns at the approved maximum content width;
- masthead remains centred and restrained;
- administrator process rows may place controls inline;
- do not turn the page into a dense desktop dashboard.

## Original state inventory

The original visual acceptance pass was intended to include:

- loading/skeleton;
- normal gallery;
- process with no photos;
- guest-upload category;
- partial load failure and retry;
- offline or slow-network notice;
- album closed;
- upload entry;
- People Coming-soon state;
- Find-me Coming-soon state;
- administrator process editor;
- photo lightbox;
- bilingual Traditional Chinese and English.

## Original screenshot matrix

The following comparison assets were still pending when the baseline was written:

| View | Prototype | React implementation | Historical status |
|---|---|---|---|
| Phone, gallery top | pending capture | pending capture | not recorded here |
| Phone, process rail | pending capture | pending capture | not recorded here |
| Phone, lightbox | pending capture | pending capture | not recorded here |
| Tablet, full page | pending capture | pending capture | not recorded here |
| Desktop, full page | pending capture | pending capture | not recorded here |
| Admin process editor | pending capture | pending capture | not recorded here |
| Empty process | pending capture | pending capture | not recorded here |
| People/Find-me Coming soon | pending capture | pending capture | not recorded here |

The prototype site could not be fetched by the automated repository workflow at the time this baseline was written. The owner-provided prototype or screenshots were authoritative for the original design review; this historical document did not replace visual side-by-side review.

## Historical deviation log template

| Component | Prototype behaviour | Implementation difference | Technical reason | Owner accepted |
|---|---|---|---|---|
| — | — | — | — | — |
