# Code health audit — 2026-07

## Scope

This audit reviewed the repository-level package graph, Replit artifacts, application entry points, GitHub Actions boundaries, Memories upload/runtime paths, Vite transform chain, current READMEs and recent merged feature history.

The review distinguishes three categories:

1. **Proven dead code** — no source, runtime, build, workflow or dynamic artifact consumer.
2. **Architecture debt** — actively used code that should be refactored, not deleted.
3. **Suspicious generated inventory** — probably oversized, but requires a complete import graph before removal.

No database table, column, migration or production data is changed by this audit.

## Proven dead code removed

### Generated React API client package

Removed `lib/api-client-react` because:

- no application imported `@workspace/api-client-react`;
- the only runtime hook was a generated health query;
- the wedding invitation used a `QueryClientProvider` but never called any React Query hook;
- Orval generated the package even though only `api-zod` has an active server consumer.

Related cleanup:

- removed the TypeScript project reference;
- removed the wedding-invitation workspace dependency;
- removed the unused React Query catalog entry;
- changed Orval to generate only Zod output.

### Wedding invitation shell code

Removed:

- the unused `QueryClient` and provider wrapper;
- `wouter`, which had no source import;
- `not-found.tsx`, which was never mounted because the application has no router.

### Root Google API dependency

Removed root `googleapis` and its unused API-server externalization entry. The legacy API uses its own `@google-cloud/storage` and `google-auth-library`; Memories uses Replit Connectors rather than this package.

### Memories transformed-away administrator code

The source `AdminApp.jsx` still contained a legacy single-photo uploader, upload state, save branch, photo pagination function and full photo-tab UI. Production never rendered that code because `admin-photo-workspace-ui-transform.mjs` replaced the entire photo tab with `AdminPhotoWorkspace` before React compilation.

The audit removes the unreachable implementation and keeps only an explicit transform placeholder. It also removes process-content transform rules that targeted the already-replaced legacy form.

## Code-smell inventory

### 1. Shotgun Surgery — critical

**Where**

- `process-content-ui-transform.mjs`
- `album-refresh-ui-transform.mjs`
- `admin-photo-workspace-ui-transform.mjs`
- `admin-photo-uploader-ui-transform.mjs`
- `admin-responsive-layout-ui-transform.mjs`
- `vite.config.js`

**Problem**

A small UI feature often requires coordinated exact-string edits across several transforms, source components, CSS contracts and source-text tests. Multiple transforms mutate the same `App.jsx` and `AdminApp.jsx` in sequence without a shared AST or component contract.

This already caused a production-only reference error when one transform removed the declaration of `orderedAvailableMediaKeys` while another generated code still referenced it.

**Recommendation**

Move one feature slice at a time into real React composition:

1. Make `AdminPhotoWorkspace` a direct import and render in `AdminApp.jsx`.
2. Move `GeneralSettings`, process content and selector settings into direct tab components.
3. Move gallery media sequencing into a real `ProcessMediaSequence` component.
4. Remove the corresponding transform immediately after each extraction.
5. Delete exact-string source tests and replace them with component behavior tests.

Do not attempt a single big-bang rewrite.

### 2. God Component / Large Class — high

**Where**

- `src/client/AdminApp.jsx`
- `src/client/App.jsx`
- `src/client/ProcessContentEditor.jsx`

**Problem**

`AdminApp` coordinates authentication, bootstrap loading, album/category/photo drafts, global saves, partial-failure recovery, deletion, tabs and editor rendering. Public `App` coordinates language, albums, processes, settings, filtering, media ordering, pagination, lightbox and upload modal state.

These components have many reasons to change and amplify regression risk.

**Recommendation**

Extract hooks and feature boundaries:

```text
AdminApp
├── useAdminBootstrap
├── useAdminDraftStore
├── useAdminSaveCoordinator
├── GeneralSettingsPanel
├── AlbumManagementPanel
├── PhotoManagementPanel
└── ProcessManagementPanel
```

```text
PublicArchive
├── useArchiveBootstrap
├── useArchiveSelection
├── useGallerySettings
├── CollectionNavigation
├── ProcessMediaSequence
└── GalleryLightboxController
```

### 3. Feature Envy — high

**Where**

- `AdminPhotoWorkspace`
- `ProcessContentEditor`
- administrator save orchestration

**Problem**

`AdminPhotoWorkspace` knows guest-batch creation, upload policy, administrator classification, album membership rules and post-upload PATCH semantics. `ProcessContentEditor` knows how to fetch every administrator photo, filter public wedding candidates, load settings and persist pinned-photo maps.

The UI is manipulating another subsystem’s data and rules more than its own presentation state.

**Recommendation**

Introduce domain-facing services:

```text
adminPhotoService.uploadAndClassifyBatch()
processContentService.loadEditor(processKey)
processContentService.saveEditor(command)
pinnedPhotoService.listCandidates(processKey, cursor)
```

The server should accept an administrator upload command that atomically finalizes classification instead of requiring a client-side upload-then-PATCH sequence.

### 4. Primitive Obsession — high

Repeated raw strings include:

- album IDs: `wedding`, `guest`, `life`;
- upload modes: `single`, `chunked`;
- media keys: `video`, `text`, `weddingPhotos`, `guestPhotos`;
- status strings: `queued`, `uploading`, `processing`, `failed`;
- route paths and setting keys.

**Recommendation**

Create small shared modules with runtime validation:

```text
album-ids.mjs
upload-mode.mjs
media-keys.mjs
upload-status.mjs
route-contracts.mjs
settings-registry.mjs
```

Prefer exported constants plus Zod/explicit validators over independent string comparisons.

### 5. Duplicate Code — medium/high

Examples:

- separate loops that fetch every photo page for public gallery, administrator editor and pinned-photo candidate loading;
- repeated image-card shells across public, private and administrator views;
- duplicated route adaptation between Vite development middleware and production server;
- repeated partial-failure and response-verification patterns in administrator settings.

**Recommendation**

- expose cursor-aware repository/client helpers rather than local pagination loops;
- share image loading and failure-state primitives while allowing different card layouts;
- define route adapters once and use them in both development and production;
- standardize command results as `{ key, status, persisted, error }`.

### 6. Temporal Coupling — high

Examples:

- upload batch creation must precede file upload;
- administrator classification PATCH must follow file upload;
- original Drive completion must precede database photo completion;
- thumbnail creation is intentionally deferred;
- category creation may require a second request for video settings.

These sequences are valid, but their invariants are distributed across browser, API and repository code.

**Recommendation**

Represent workflows explicitly with command/state-machine modules. Persist stage transitions and make each stage idempotent. For administrator uploads, move classification finalization server-side so the browser invokes one domain operation.

### 7. Data Clumps — medium

Frequently travelling groups include:

- `batchId`, `managementToken`, `clientUploadId`, `file`, `signal`;
- `albumIds`, `categoryId`, `classification`, `processId`;
- Drive session URI, offset, total bytes, upload mode;
- bilingual label/content pairs.

**Recommendation**

Use named command objects with validation at boundaries rather than long parameter lists.

### 8. Speculative Generality — medium

The legacy API build externalizes a long list of packages that are not imported or installed, justified as possible future dependencies. The invitation also contains a large generated shadcn component inventory and dependency set while its active page imports only a small subset.

**Recommendation**

- generate the esbuild external list from actual package dependencies plus a small documented native-module allowlist;
- build a static import graph for `wedding-invitation/src` and remove unused UI components and package dependencies in a dedicated PR;
- keep `mockup-sandbox`, because Replit Canvas loads it dynamically.

Do not remove generated UI files solely because direct text search finds no import; barrel exports and dynamic preview registries must be included in the graph.

### 9. Settings Shotgun Surgery — high

`memories_app_settings` avoids schema migrations, but every new key currently requires changes across defaults, normalization, public API, admin API, repository mapping, UI, tests and sometimes transforms.

**Recommendation**

Create a central settings registry:

```js
{
  key,
  defaultValue,
  public,
  validate,
  normalize,
  storageKey
}
```

Generate public/admin payload filtering from the registry. This keeps migration-free settings while eliminating duplicated key handling.

### 10. Test Smell: source-contract tests — critical

Many tests assert generated source strings or CSS text. They are useful as guardrails but can pass while the browser crashes after the full transform chain.

**Recommendation**

Keep focused unit tests, then add a required Playwright layer:

- load `/Memories/` production build and fail on `pageerror` or Error Boundary;
- switch albums/processes and render every media type;
- open admin login, authenticate with a test token and render all tabs;
- expand the pinned-photo picker and verify lazy image requests;
- validate private batch management routing;
- assert no console errors during core flows.

## Refactoring order

### Phase 1 — risk containment

- Add production Playwright smoke tests.
- Add one test that runs the complete transform chain in official Vite order.
- Introduce central route and settings registries.
- Finish deleting transformed-away source blocks.

### Phase 2 — remove Shotgun Surgery

- Directly render `AdminPhotoWorkspace`.
- Directly render process/general settings tabs.
- Extract `ProcessMediaSequence` from the public gallery.
- Delete transforms feature by feature.

### Phase 3 — domain services

- Add administrator photo command service.
- Move process editor data loading/persistence into a service.
- Consolidate all-photo pagination helpers.
- Model upload stages explicitly.

### Phase 4 — legacy and dependency hygiene

- Generate an invitation import graph.
- Remove unused shadcn files and dependencies.
- Replace the speculative esbuild external list.
- Decide whether legacy photo wall and API should be archived, retained or migrated.

## Priority matrix

| Priority | Work | Main benefit |
| --- | --- | --- |
| P0 | Browser smoke + full transform-chain test | Prevent production-only blank pages |
| P0 | Directly integrate AdminPhotoWorkspace | Remove the most dangerous transformed-away source |
| P1 | Central settings registry | Reduce settings Shotgun Surgery |
| P1 | Extract Admin save coordinator | Reduce God Component and temporal coupling |
| P1 | Server-side admin upload classification | Remove Feature Envy from UI |
| P2 | Public archive component extraction | Improve readability and testability |
| P2 | Invitation import-graph cleanup | Reduce dependencies and generated dead inventory |
| P3 | Legacy API external-list cleanup | Remove speculative build configuration |

## Definition of done for future refactors

A refactor is complete only when:

- public behavior and routes are unchanged unless explicitly specified;
- tests cover behavior rather than only source text;
- production build renders in a real browser without console errors;
- no migration or destructive schema plan is introduced accidentally;
- legacy-boundary changes are explicit and owner-approved;
- README and architecture notes match the merged implementation.
