# Memories logical routes

The URL mirrors the ordered visual hierarchy rather than database IDs or display names. Renaming an album, process, guest group, or administrator tab therefore does not expose its internal identifier in the address bar.

## Language

Traditional Chinese is the default and has no language segment. English adds `/en` immediately after `/Memories`.

| Language | Example |
| --- | --- |
| Traditional Chinese | `/Memories/group1/subgroup2` |
| English | `/Memories/en/group1/subgroup2` |

Changing the language updates the URL while preserving the selected group, subgroup, and opened photo. Opening an English URL directly also opens the English interface.

## Public archive

The current display order defines the logical numbers:

- `group1`, `group2`, `group3`, … are the ordered album tabs.
- `subgroup1`, `subgroup2`, `subgroup3`, … are the ordered process, guest, or future child-category tabs inside the selected group.
- Selecting “all” uses the parent group URL without a subgroup segment.

| Surface | Canonical path |
| --- | --- |
| First album, all children | `/Memories/group1` |
| Second album, third child | `/Memories/group2/subgroup3` |
| English first album | `/Memories/en/group1` |
| Open photo | append `/photos/:photoId` |
| Upload | `/Memories/upload` or `/Memories/en/upload` |
| People placeholder | `/Memories/people` or `/Memories/en/people` |
| Find-me placeholder | `/Memories/find` or `/Memories/en/find` |
| Private upload management | `/Memories/manage/:batchToken` |

Opening or refreshing a subgroup URL performs the same selection and gallery-anchor positioning as pressing that subgroup in the interface. Browser Back and Forward restore both selection and positioning.

`/Memories/` and `/Memories/en/` are compatibility aliases for their respective `group1` paths. The former semantic album-ID routes remain readable and are replaced client-side with the corresponding logical-number route.

## Administrator

Administrator tabs use their visible order:

| Ordered tab | Canonical path |
| --- | --- |
| First tab | `/Memories/admin/group1` |
| Second tab | `/Memories/admin/group2` |
| Third tab | `/Memories/admin/group3` |
| Additional tabs | continue as `group4`, `group5`, … |
| Login | `/Memories/admin/login` |

Deep administrator routes pass through the same server-side session authorization as `/Memories/admin/`. The previous semantic tab paths remain readable and are canonicalized to logical group paths.

## Ordering rules

A logical number always comes from the currently saved display order, never from a label, database ID, filename, or array key supplied by the visitor. Adding or reordering groups and subgroups updates their logical position consistently across clicks, refreshes, direct links, and browser history.
