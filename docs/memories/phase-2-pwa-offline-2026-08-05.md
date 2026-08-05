# Phase 2 PWA and offline policy

Status: Active
Parent issue: #207
Date: 2026-08-05

## Scope

This stage adds install metadata, a public service worker, a bounded cache policy, and a bilingual offline fallback. It does not alter the existing archive layout, spacing, typography, dimensions, colors, or DOM order.

## Manifest

The web app manifest is scoped to `/Memories/`, launches the archive in standalone mode, and uses the existing administrator-configurable PNG site icon. The theme and background values match the existing document theme color.

## Registration boundary

Registration occurs after the browser `load` event and only when:

- Service Worker is supported;
- the page is served over HTTPS or localhost;
- the current page is not an administrator or private batch-management surface.

`updateViaCache: "none"` ensures the browser checks the worker script without relying on its HTTP cache entry.

## Cache policy

The worker deliberately does **not** intercept or cache:

- `/Memories/admin...`;
- `/Memories/manage/...`;
- `/Memories/api/...`;
- upload, guestbook, administrator, private-token, original-photo, or thumbnail responses.

Public document navigation is network-first. A successful navigation may be reused only when the network is unavailable. Static hashed assets are cache-first after their first successful request. The manifest and offline page are pre-cached during installation.

This boundary prevents offline support from retaining private management responses or unbounded wedding-photo data in browser Cache Storage.

## Offline fallback

When neither the network nor a previously visited public document is available, the worker serves `offline.html`. The fallback is bilingual and contains only a reload action. It does not claim that photos or messages are available offline.

## Versioning

Every cache revision must change `CACHE_NAME`. Activation deletes older `memories-shell-*` caches. Changes to manifest or offline policy require relevant tests, a production build, and browser validation.
