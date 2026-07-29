---
name: CSP blocks React Fast Refresh preamble in dev
description: The production Content-Security-Policy (no 'unsafe-inline' for scripts) blocked the inline <script> that @vitejs/plugin-react injects into index.html in dev mode, causing every JSX module to throw "can't detect preamble".
---

## Rule
Strip `Content-Security-Policy` from HTML responses in the Vite dev server. Use a wrapper (`applyDevDocumentHeaders`) that calls `applyDocumentSecurityHeaders` then removes the CSP header.

**Why:** The React Fast Refresh preamble is an inline `<script>` injected by `@vitejs/plugin-react` into `index.html` via `transformIndexHtml`. The production CSP has `default-src 'self'` with no `'unsafe-inline'` for scripts, which is correct for production (no inline scripts in the built bundle). But in dev mode, browsers block this inline script, so `window.__vite_plugin_react_preamble_installed__` is never set, and every JSX module throws `@vitejs/plugin-react can't detect preamble. Something is wrong.` at runtime.

**How to apply:** Any time `applyDocumentSecurityHeaders` is called from `vite.config.js` (dev server middleware), replace with `applyDevDocumentHeaders` which removes the CSP after setting all other headers. Production `app.mjs` keeps the full CSP unchanged.

**Symptom:** White screen + `unhandlederror` in browser console pointing to a JSX file at a line number much higher than the source file length (the injected preamble check is at the bottom of the transformed module).
