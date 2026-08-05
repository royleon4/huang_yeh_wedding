# Phase 2 performance gate

Status: Active
Parent issue: #207
Date: 2026-08-05

## Scope

This stage changes loading and build behaviour only. It does not change established layout, spacing, typography, dimensions, colors, or DOM order.

## Corrections

### Public entry code splitting

The administrator application, administrator login page, and private batch-management page are loaded through dynamic imports. The public archive no longer downloads those private-route modules in its entry chunk. Each lazy wrapper uses a `null` Suspense fallback, so no additional visible DOM, spacing, or styling is introduced.

### Progressive photo feed

The first public photo request is reduced from 100 records to 24. The first page is exposed immediately, the first thumbnail remains high-priority, and additional cursor pages yield to an idle or timer turn before continuing. The loader exposes every page snapshot for incremental adoption while preserving the existing final combined result.

### Native diagnostics

The browser exposes a read-only diagnostic snapshot at:

```js
window.__MEMORIES_WEB_VITALS__
```

It records:

- Largest Contentful Paint from `largest-contentful-paint` entries;
- cumulative layout shift excluding recent-input shifts;
- the largest observed interaction event duration as an INP diagnostic;
- navigation response, DOM content loaded, load, transfer, and encoded-body timing.

Adding `?performance=1` prints the current snapshot to the browser console. No metrics are transmitted to a third party.

### Bundle evidence and budgets

Every production build emits a Vite manifest and writes:

- `dist/performance/bundle-report.json`
- `dist/performance/bundle-report.md`

The build fails when:

- the public entry exceeds 450 KiB gzip;
- any JavaScript chunk exceeds 800 KiB gzip;
- all JavaScript chunks exceed 2 MiB gzip in total;
- the administrator, login, or batch-management route is no longer a dynamic import.

These budgets are regression ceilings, not performance targets. Tighten them only after recording several stable production baselines.

## Measurement interpretation

LCP and CLS can be measured during loading. INP requires a real user interaction and therefore remains `null` until an eligible interaction occurs. Lab engine results should be compared with physical-device observations, especially on low-end Android hardware and in-app browsers.

## Remaining work

- Record physical-device LCP, CLS, and interaction timings.
- Add responsive image variants and `srcset` when the server image pipeline can produce and persist multiple sizes.
- Replace background accumulation with server-driven on-demand cursor loading after the current transform chain is reduced.
