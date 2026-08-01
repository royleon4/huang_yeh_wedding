# Memories administrator route

> **Status:** Current  
> **Reviewed:** 2026-08-01T19:33:00+08:00 (Asia/Taipei)

The administrator surface belongs to the standalone Memories artifact and uses the same routed prefix as the gallery.

Canonical routes:

```text
/Memories/admin/login
/Memories/admin/general
/Memories/admin/albums
/Memories/admin/photos
/Memories/admin/categories
/Memories/admin/api/session
/Memories/admin/api/*
```

`/Memories/admin/` is a compatibility entry that resolves to the current administrator surface. Stable semantic tab routes are authoritative; display order does not define a URL.

The Replit path router assigns `/Memories/admin` and `/memories/admin` to `artifacts/memories-album`. Lowercase `/memories/...` requests are redirected to the canonical `/Memories/...` spelling.

The old root-level `/admin` prefix is compatibility-only and permanently redirects beneath `/Memories/admin/`. Removed `/Memories/api/admin/*` routes are not restored.

The administrator session cookie is scoped to `/Memories/admin`, so it is not sent to unrelated applications in the repository. The login password source is the exact Replit Secret name:

```text
MEMORIES_ADMIN_TOKEN
```

Do not widen the cookie path, duplicate the administrator API beneath another namespace, or make administrator login depend on Google Drive initialization.

Full stable-route behavior is documented in [`../../artifacts/memories-album/docs/logical-routes.md`](../../artifacts/memories-album/docs/logical-routes.md).
