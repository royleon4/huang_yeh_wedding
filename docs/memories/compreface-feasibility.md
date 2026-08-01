# CompreFace feasibility for standalone Memories

> **Status:** Research only; deferred after Product Phase 1  
> **Reviewed:** 2026-08-01T19:33:00+08:00 (Asia/Taipei)  
> **Approval state:** No face provider, hosting model, biometric retention policy or Product Phase 2 implementation is approved

Issue: #18

This document is a preliminary technical assessment. It must not be read as permission to upload wedding photos, faces, embeddings or temporary selfies to CompreFace or any external provider.

Before implementation, the owner must approve the Phase 2 scope, privacy notice, consent model, provider/hosting, recurring cost, retention, deletion, correction and incident responsibilities described in [`../phase-1-closeout-2026-08-01.md`](../phase-1-closeout-2026-08-01.md).

## Preliminary answer

CompreFace can supply the low-level face capabilities that a future Memories feature might need:

- face detection for one or many faces in an image;
- face embeddings and bounding boxes;
- enrollment of examples under named subjects;
- similarity-ranked recognition through a REST API;
- self-hosted CPU or GPU deployment through Docker.

It is not, by itself, the complete wedding-person-classification product. The documented recognition model is centred on already enrolled subjects. Memories begins with many unknown guests, so automatic candidate grouping still requires an application-owned clustering/grouping layer, persistent jobs, correction tools, and provider-neutral database records.

## Proposed responsibility split

### CompreFace

- Detect acceptable faces in a supplied photo.
- Return face boxes and embeddings.
- Compare a temporary selfie or cropped face with enrolled/reference faces.
- Delete provider-owned references when Memories permanently removes a face/photo.

### Memories application

- Keep Google Drive as the only original-photo store.
- Keep PostgreSQL as the canonical photo, face, person-group, job, correction, and audit index.
- Cluster unknown face embeddings into candidate person groups.
- Persist merge, split, ignore, rename, visibility, and threshold corrections.
- Ensure normal page views never rerun face processing.
- Discard temporary-selfie bytes after each request.
- Present all matches as candidates rather than verified identity.

## Provider-neutral contract to validate

```ts
interface FaceEngine {
  healthCheck(): Promise<{ healthy: boolean }>;

  detectAndEmbed(input: {
    image: Buffer;
    contentType: string;
  }): Promise<Array<{
    providerFaceRef?: string;
    embedding: number[];
    box: { xMin: number; yMin: number; xMax: number; yMax: number };
    detectionConfidence: number;
  }>>;

  compare(input: {
    probeEmbedding: number[];
    candidateEmbeddings: Array<{ faceId: string; embedding: number[] }>;
    limit: number;
  }): Promise<Array<{ faceId: string; similarity: number }>>;

  deleteReferences(providerFaceRefs: string[]): Promise<void>;
}
```

The final interface may differ after benchmarking, but application services must not depend directly on CompreFace subjects, endpoints, or response shapes.

## Major feasibility risks

1. **Unknown-person clustering**

   CompreFace recognition predicts enrolled subjects. It does not replace the application logic needed to group a large set of initially unknown wedding guests. The spike must demonstrate clustering quality and administrator correction, not assume it.

2. **Hosting**

   CompreFace expects a Docker-capable x86 host with AVX support. A separate Docker service may be required if the selected Replit deployment cannot run the full stack reliably. The owner must approve any external service or recurring cost.

3. **Maintenance and dependencies**

   The checked upstream master history and dependency files include an older Python/TensorFlow/Flask stack. Before production use, the spike must review current releases, container vulnerabilities, upgrade path, community activity, and supported image tags.

4. **Image duplication**

   CompreFace can store subject-example images by default. Memories should disable provider-side image persistence where supported, or otherwise ensure provider storage is limited to cropped technical references rather than duplicate wedding originals.

5. **Privacy and deletion**

   The service endpoint and API key must remain server-side and privately reachable. Logs must exclude image bytes, embeddings where unnecessary, API keys, and temporary selfies. Permanent deletion must also remove provider references.

6. **Consent and data-subject rights**

   Wedding guests may not expect biometric processing merely because a photo is visible in the archive. A future design must define notice, opt-out, correction, deletion and access rules before processing begins.

## Required benchmark

Use only a representative, owner-approved and consented test set containing:

- individual portraits;
- group photos with several faces;
- very small faces;
- side profiles and partial occlusion;
- glasses and masks;
- mixed indoor/outdoor lighting;
- repeated photos of the same people across different cameras.

Measure:

- detection recall and obvious false detections;
- clustering precision/fragmentation before and after correction;
- temporary-selfie top-result quality;
- CPU time per photo and per detected face;
- startup time, memory use, and sustained queue throughput;
- failure behaviour, retries, deletion, and restart persistence;
- storage growth and deletion completeness;
- false-match review burden and user complaint handling.

## Decision checkpoint

Do not implement a production adapter until the owner chooses one of:

1. CompreFace on an approved Docker-capable host;
2. Amazon Rekognition;
3. another provider;
4. defer face features while continuing gallery/upload maintenance;
5. reject biometric processing for this project.

The decision must also record:

- provider and region;
- maximum cost;
- source-photo and embedding retention;
- temporary-selfie deletion timing;
- consent and notice model;
- administrator correction workflow;
- permanent deletion propagation;
- incident and breach responsibilities.

## Current recommendation

Keep face features deferred until release confidence and architecture P0 work are complete. A provider-neutral benchmark may follow only after owner approval of the privacy and test-data plan.

CompreFace remains technically plausible, but hosting, maintenance, unknown-person clustering, privacy and operational ownership are unproven for this wedding workload.
