# Memories administrator route

The administrator surface belongs to the standalone Memories artifact and uses the same routed prefix as the gallery.

Canonical routes:

```text
/Memories/admin/
/Memories/admin/login
/Memories/admin/api/session
/Memories/admin/api/albums
/Memories/admin/api/photos
/Memories/admin/api/categories
```

The Replit path router assigns `/Memories/admin` and `/memories/admin` to `artifacts/memories-album`. Lowercase `/memories/...` requests are redirected to the canonical `/Memories/...` spelling.

The old root-level `/admin` prefix is routed only as a compatibility alias and returns a permanent redirect to `/Memories/admin/`. The session cookie is scoped to `/Memories/admin`, so it is not sent to unrelated applications in the repository.
