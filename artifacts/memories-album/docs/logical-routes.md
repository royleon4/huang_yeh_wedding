# Memories logical routes

The URL is the source of truth for the currently visible public collection, subcategory, modal, photo, and administrator tab. Display labels may change without changing album, process, photo, or administrator route identifiers.

## Public archive

| Surface | Canonical path |
| --- | --- |
| Default archive | `/Memories/albums/wedding` |
| Album | `/Memories/albums/:albumId` |
| Wedding process | `/Memories/albums/:albumId/processes/:processId` |
| Guest uploader group | `/Memories/albums/:albumId/guests/:guestGroupId` |
| Future album-specific filter | `/Memories/albums/:albumId/filters/:filterId` |
| Open photo | append `/photos/:photoId` to any gallery route |
| Upload | `/Memories/upload` |
| People placeholder | `/Memories/people` |
| Find-me placeholder | `/Memories/find` |
| Private upload management | `/Memories/manage/:batchToken` |

`/Memories/` remains a compatibility alias and is replaced client-side with `/Memories/albums/wedding`. Missing or deleted albums, processes, guest groups, filters, and photos recover to the closest valid parent route.

## Administrator

| Tab | Canonical path |
| --- | --- |
| General | `/Memories/admin/general` |
| Albums | `/Memories/admin/albums` |
| Photos | `/Memories/admin/photos` |
| Categories and video | `/Memories/admin/categories` |
| Subcategory interaction | `/Memories/admin/subcategory-ui` |
| Login | `/Memories/admin/login` |

Deep administrator routes pass through the same server-side session authorization as `/Memories/admin/`. Unknown administrator tab identifiers recover to the albums tab.

## Identifier rules

Dynamic route segments use stored entity IDs. They are URI-encoded and never use array positions. Future administrator tabs must be added to `ADMIN_TAB_IDS` in `src/client/route-state.mjs`; future public filter kinds should use the generic `filters/:filterId` route unless they have a stable domain-specific name.
