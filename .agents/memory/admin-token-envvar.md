---
name: Admin token environment variable name
description: The Replit Secret for the Memories admin password is MEMORIES_ADMIN_TOKEN, not SECRET_TOKEN. All server call-sites must use this name or the session handler returns 503.
---

## Rule
Read the admin password from `env.MEMORIES_ADMIN_TOKEN` everywhere — never `env.SECRET_TOKEN`.

**Why:** The Replit Secret is named `MEMORIES_ADMIN_TOKEN`. Using the wrong name makes `adminToken` undefined, causing `createAdminSessionApi` to immediately return 503 "Administrator access is not configured" on every login attempt instead of checking the password.

**How to apply:** Any time `adminToken` is sourced from `process.env` or the `env` option object, use the `MEMORIES_ADMIN_TOKEN` key. The affected files are `src/app.mjs` (two places), `src/server/runtime.mjs` (three places), and `vite.config.js` (one place). The login page hint text (`src/client/AdminLoginPage.jsx`) should also name `MEMORIES_ADMIN_TOKEN` so users know which secret to set.
