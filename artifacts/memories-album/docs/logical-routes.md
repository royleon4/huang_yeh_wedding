# Memories identity routes

Canonical URLs are tied to the stable identity of the album, label, administrator tab, or photo they represent. Display order is presentation only and never changes an existing URL.

## Language

Traditional Chinese is the default and has no language segment. English adds `/en` immediately after `/Memories`.

| Language | Example |
| --- | --- |
| Traditional Chinese | `/Memories/albums/guest/labels/Leon` |
| English | `/Memories/en/albums/guest/labels/Leon` |

Changing the language updates only the language segment while preserving the selected album, label, and opened photo.

## Public archive

| Surface | Canonical path |
| --- | --- |
| Album | `/Memories/albums/:albumKey` |
| Label inside an album | `/Memories/albums/:albumKey/labels/:labelKey` |
| English album | `/Memories/en/albums/:albumKey` |
| Open photo | append `/photos/:photoId` |
| Upload | `/Memories/upload` or `/Memories/en/upload` |
| People placeholder | `/Memories/people` or `/Memories/en/people` |
| Find-me placeholder | `/Memories/find` or `/Memories/en/find` |
| Private upload management | `/Memories/manage/:batchId#token=...` |

Album keys use the saved album identity. Wedding-process labels use their process identity. Guest-name labels use the normalized visitor label itself, URL encoded. The virtual latest-photo label uses the stable key `latest`.

The guest album itself, `/Memories/albums/guest`, is also the all-visitors view. Hiding the “所有訪客” selector chip does not invalidate that parent album route. Hiding “最新照片” makes `/labels/latest` unavailable; hiding name labels makes every guest-name `/labels/:name` route unavailable while the names are hidden.

Reordering albums or labels does not alter any canonical URL. Renaming, removing, or hiding an otherwise addressable guest label removes that route from the current public surface. A stale route is treated as not found and replaced with the nearest valid parent route. A missing album redirects to the first available album, a missing label redirects to its album, and a missing photo redirects to its label or album. The replacement history entry records `{ status: 404, missingPath }`, and the application emits `memories:route-not-found` before recovery.

Opening a label URL directly, clicking a label, refreshing, and browser Back/Forward all restore the same identity and request gallery-anchor positioning.

`/Memories/` and `/Memories/en/` remain compatibility roots and redirect to the first available album. Previous ordinal routes such as `/Memories/group2/subgroup3` and older semantic routes remain readable only as migration aliases; after resolution they are replaced by the stable identity URL.

## Administrator

Administrator tabs use stable semantic identifiers:

| Tab | Canonical path |
| --- | --- |
| General | `/Memories/admin/general` |
| Albums | `/Memories/admin/albums` |
| Photos | `/Memories/admin/photos` |
| Categories | `/Memories/admin/categories` |
| Login | `/Memories/admin/login` |

Moving or relabeling a tab does not change its route. Previous `/Memories/admin/groupN` paths remain migration aliases and are replaced with the semantic route.

## Identity rules

- URLs are never generated from current display indexes.
- Reordering an entity cannot change its URL.
- A route resolves only while the referenced identity exists and is available on that surface.
- Deleted, hidden or otherwise unavailable label identities are marked as not found before replacement with the nearest valid parent.
- The guest album parent route remains valid even when its all-visitors selector chip is hidden.
- Photo routes retain the existing opaque photo identity.
- User-visible text is URL encoded and normalized with NFKC before use as a guest-label identity.
