# Approved Memories visual baseline

Issue: #26

## Source of truth

The visual source of truth is the project-chat prototype:

- Product title: **詠葉婚禮照片檔案館**
- Selected direction: **靜謐婚禮檔案館**
- Prototype: `https://yongye-photo-archive.royleon4.chatgpt.site`

The React implementation must reproduce the prototype rather than reinterpret it. Changes are permitted only for accessibility, responsive correctness, performance, browser compatibility, or real-data integration, and each visible deviation must be recorded.

## Product composition

The approved page is a quiet, archival wedding gallery rather than a social-media feed.

1. A restrained wedding-archive masthead establishes the couple, date, and archival mood.
2. Four persistent primary destinations remain visible:
   - 全部照片 / All photos
   - 人物 / People
   - 上傳 / Upload
   - 找找我 / Find me
3. During Phase 1, People and Find me remain in their original visual positions and show `即將推出 / Coming soon`; they make no face-related request.
4. A horizontally scrollable wedding-process rail sits before the gallery on mobile.
5. Photos use a varied-height waterfall/masonry arrangement rather than square cropping.
6. Administrator presentation includes process add, delete, rename, reorder, and photo membership controls.
7. A process with no photos shows a deliberate archive-style waiting state rather than an empty white area.
8. Guest uploads are a separate visible category and are never assigned to wedding processes.

## Twelve default wedding processes

These labels and this order are binding:

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

`訪客上傳 / Guest uploads` is a separate category and is not process number 13.

## Visual inventory

### Mood

- quiet archive;
- warm, tactile paper rather than bright white application chrome;
- elegant and intimate rather than playful or corporate;
- wedding-green, cream, restrained warm yellow/gold, and a muted coral accent;
- botanical or archival ornament used sparingly.

### Colour roles

These are implementation starting points and should be visually compared with the prototype:

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

## State inventory

The visual acceptance pass must include:

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

## Screenshot matrix

The following comparison assets are still required before #26 can close:

| View | Prototype | React implementation | Status |
|---|---|---|---|
| Phone, gallery top | pending capture | pending capture | open |
| Phone, process rail | pending capture | pending capture | open |
| Phone, lightbox | pending capture | pending capture | open |
| Tablet, full page | pending capture | pending capture | open |
| Desktop, full page | pending capture | pending capture | open |
| Admin process editor | pending capture | pending capture | open |
| Empty process | pending capture | pending capture | open |
| People/Find-me Coming soon | pending capture | pending capture | open |

The prototype site could not be fetched by the automated repository workflow at the time this baseline was written. The owner-provided prototype or screenshots remain authoritative; this document does not replace visual side-by-side review.

## Deviation log template

| Component | Prototype behaviour | Implementation difference | Technical reason | Owner accepted |
|---|---|---|---|---|
| — | — | — | — | — |
