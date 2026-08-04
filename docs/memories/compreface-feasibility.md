# CompreFace feasibility for standalone Memories

> **Status:** Active Product Phase 2 decision spike  
> **Reviewed:** 2026-08-05 (Asia/Taipei)  
> **Approval state:** Phase 2 research is approved to proceed; no face provider, hosting model, biometric retention policy, production indexing, People activation or Find-me activation is approved

Issue: #18  
Umbrella: #24

This document is the active provider and hosting decision record for Product Phase 2. It must not be read as permission to upload production wedding photos, faces, embeddings or temporary selfies to CompreFace, Amazon Rekognition or any other provider.

The owner explicitly reactivated Product Phase 2 on 2026-08-05. Work therefore moves from the Phase 1 `Coming soon` placeholder into the provider-evaluation and provider-neutral architecture stage. The final production provider and hosting model remain gated by an explicit owner decision.

Before real biometric processing begins, the owner must approve the Phase 2 scope, privacy notice, consent model, provider/hosting, recurring cost, retention, deletion, correction and incident responsibilities described in [`../phase-1-closeout-2026-08-01.md`](../phase-1-closeout-2026-08-01.md).

## Current answer

CompreFace can supply several low-level face capabilities that Memories needs:

- face detection for one or many faces in an image;
- face embeddings and bounding boxes;
- enrollment of examples under named subjects;
- similarity-ranked recognition through a REST API;
- self-hosted CPU or GPU deployment through Docker.

It is not, by itself, the complete wedding-person-classification product. The documented recognition model is centred on already enrolled subjects. Memories begins with many unknown guests, so automatic candidate grouping still requires an application-owned clustering/grouping layer, persistent jobs, correction tools, and provider-neutral database records.

The current maintenance evidence also prevents an immediate production recommendation:

- the latest official CompreFace release is `1.2.0`, published on 2023-08-22;
- the latest commit visible on the official default branch is from 2023-11-14;
- official Docker images were last pushed roughly three years ago;
- the single-container `1.2.0` CPU image is about 2.07 GB compressed, while model-specific images range from about 1.06 GB to 3.93 GB compressed;
- the default deployment is a multi-service Docker Compose stack and requires x86 with AVX support.

These facts do not prove that CompreFace is unsafe, but they make a current dependency/container scan, isolated benchmark, upgrade test and rollback plan mandatory before any production use.

Primary current sources:

- [CompreFace releases](https://github.com/exadel-inc/CompreFace/releases)
- [CompreFace repository](https://github.com/exadel-inc/CompreFace)
- [CompreFace installation options](https://github.com/exadel-inc/CompreFace/blob/master/docs/Installation-options.md)
- [CompreFace architecture and scalability](https://github.com/exadel-inc/CompreFace/blob/master/docs/Architecture-and-scalability.md)
- [Official CompreFace Docker tags](https://hub.docker.com/r/exadel/compreface/tags)
- [Amazon Rekognition pricing](https://aws.amazon.com/rekognition/pricing/)
- [Replit Publishing documentation](https://docs.replit.com/learn/projects-and-artifacts/replit-deployments)

## Phase 2 execution order

1. Complete this provider/hosting decision spike and benchmark.
2. Obtain explicit owner approval for provider, region, hosting, maximum cost and biometric policy.
3. Implement provider-neutral jobs and one-time indexing under #8.
4. Implement persisted People browsing and basic administration under #9.
5. Implement merge, split, ignore and calibrated similarity controls under #10.
6. Implement temporary-selfie Find-me under #11.
7. Implement mutation-triggered person-index backup under #12.

No later item may bypass its existing dependency or decision gate.

## Proposed responsibility split

### Face provider

- Detect acceptable faces in a supplied photo.
- Return face boxes and either embeddings or opaque provider references required for comparison.
- Compare a temporary selfie or cropped face with stored/reference faces.
- Delete provider-owned references when Memories permanently removes a face/photo.
- Report health and deterministic provider errors without exposing provider credentials to the browser.

### Memories application

- Keep Google Drive as the only original-photo store.
- Keep PostgreSQL as the canonical photo, face, person-group, job, correction, and audit index.
- Cluster unknown face embeddings into candidate person groups when the selected provider does not supply an acceptable grouping primitive.
- Persist merge, split, ignore, rename, visibility, and threshold corrections.
- Ensure normal page views never rerun face processing.
- Discard temporary-selfie bytes after each request, including validation failure, timeout and provider error.
- Present all matches as candidates rather than verified identity.
- Enforce album closure, hidden people, ignored faces, hidden/trashed photos and permanent deletion.

## Provider-neutral contract to validate

```ts
interface FaceEngine {
  healthCheck(): Promise<{
    healthy: boolean;
    provider: string;
    modelVersion?: string;
  }>;

  detectAndEmbed(input: {
    image: Buffer;
    contentType: string;
    requestId: string;
  }): Promise<Array<{
    providerFaceRef?: string;
    embedding?: number[];
    box: { xMin: number; yMin: number; xMax: number; yMax: number };
    detectionConfidence: number;
    quality?: {
      blur?: number;
      pose?: number;
      occlusion?: number;
    };
  }>>;

  compare(input: {
    probeImage?: Buffer;
    probeEmbedding?: number[];
    candidateEmbeddings?: Array<{ faceId: string; embedding: number[] }>;
    limit: number;
    threshold: number;
    requestId: string;
  }): Promise<Array<{ faceId: string; similarity: number }>>;

  deleteReferences(providerFaceRefs: string[]): Promise<void>;
}
```

The final interface may differ after benchmarking. Application services must not depend directly on CompreFace subjects, AWS collection IDs, provider endpoints, or provider response shapes.

A fake in-memory adapter is required regardless of the selected provider so unit, API, retry, deletion and privacy tests never depend on a live biometric service.

## Current hosting assessment

### Existing Replit production app

Not recommended for hosting CompreFace directly at this stage.

Replit documents Autoscale, Reserved VM, Scheduled and Static publishing. It also explicitly says not to rely on the published app filesystem for persistent data. Reserved VM provides continuous compute, but current public documentation does not provide a supported contract for running a five-service Docker Compose stack inside the existing application deployment.

Direct co-hosting would also couple gallery availability to model startup, memory pressure and face-engine failure. That conflicts with the requirement that AI failure never blocks photo browsing.

### Separate private Docker-capable host

Technically plausible for an isolated CompreFace benchmark and, if later approved, production.

Required controls:

- x86/AVX-compatible compute;
- private network or strict source allow-list;
- TLS and server-side API key handling;
- persistent provider database volume;
- health checks, restart policy and monitored disk growth;
- pinned image digests rather than floating `latest` tags;
- container/SBOM vulnerability scanning before first use and on every rebuild;
- documented upgrade, database backup and rollback procedure;
- no public CompreFace administration UI unless separately protected.

This option has the highest operational burden and a continuously running compute cost.

### Amazon Rekognition

Technically plausible as a managed baseline and removes model hosting, Docker, AVX, persistent provider database and upgrade operations.

AWS charges per image/API operation and separately for stored face/user vectors. `IndexFaces`, `SearchFacesByImage`, `SearchFaces` and related operations are Group 1 image APIs. A group-photo workflow may require more than one billable operation when detection, indexing, association and search are separated.

`SearchFacesByImage` searches using the largest face in the supplied image. A multi-face workflow therefore still needs deliberate indexing or server-side face crops rather than assuming a single call handles every guest.

This option has lower infrastructure burden but sends biometric-derived data to the approved AWS region and introduces provider lock-in, IAM, billing and deletion-propagation responsibilities.

### Provider-neutral fake only

Required for development, tests and rollback, but not a production face solution.

It can validate job state, idempotency, UI states, authorization, deletion, temporary-selfie cleanup and provider failure behavior without processing real biometric data.

## Preliminary option matrix

| Option | Current feasibility | Main advantage | Main risk | Current decision |
| --- | --- | --- | --- | --- |
| CompreFace inside existing Replit deployment | Unproven and not recommended | Same platform | Docker Compose, persistence, startup and resource coupling | Do not implement |
| CompreFace on separate private Docker host | Benchmarkable | Self-hosted control and direct embeddings | Stale upstream, operations, security, continuous compute | Benchmark only after test-data approval |
| Amazon Rekognition | Technically plausible | Managed scaling and maintenance | External biometric processing, lock-in and per-call cost | Keep as managed comparison |
| Another maintained provider | Not yet assessed | May improve maintenance or deployment fit | New privacy, cost and integration review | Research only if needed |
| Fake adapter | Required | Deterministic testing and rollback | No real recognition | Implement with #8 after provider decision |
| Defer/reject biometric processing | Always possible | Lowest privacy and operational risk | People and Find-me remain unavailable | Owner may choose at checkpoint |

## Major feasibility risks

1. **Unknown-person clustering**

   CompreFace recognition predicts enrolled subjects. It does not replace the application logic needed to group a large set of initially unknown wedding guests. The spike must demonstrate clustering quality and administrator correction, not assume it.

2. **Upstream age and supply-chain risk**

   The official release and image line has not been refreshed since 2023. Before use, every selected image must be pinned, scanned and tested against the target host. A passing container scan does not replace application-level privacy and correctness review.

3. **Hosting**

   CompreFace expects a Docker-capable x86 host with AVX support and multiple services. A separate service is the realistic benchmark target unless a supported Replit deployment contract is demonstrated.

4. **Image duplication**

   CompreFace can store subject-example images. Memories should disable provider-side image persistence where supported, or otherwise ensure provider storage is limited to the minimum technical reference and never duplicate wedding originals unnecessarily.

5. **Privacy and deletion**

   The service endpoint and API key must remain server-side and privately reachable. Logs must exclude image bytes, embeddings where unnecessary, API keys, and temporary selfies. Permanent deletion must also remove provider references and verify completion.

6. **Consent and data-subject rights**

   Wedding guests may not expect biometric processing merely because a photo is visible in the archive. A future design must define notice, opt-out, correction, deletion and access rules before processing begins.

7. **False match and social harm**

   The system must never present a match as verified identity. False grouping, missed faces and incorrect selfie results require visible uncertainty, easy correction and an administrator review path.

## Required benchmark

Use only a representative, owner-approved and consented test set. Production Drive folders must not be scanned during the spike.

The test set should contain:

- individual portraits;
- group photos with several faces;
- very small faces;
- side profiles and partial occlusion;
- glasses and masks;
- mixed indoor/outdoor lighting;
- repeated photos of the same people across different cameras.

Measure:

- detection recall and obvious false detections;
- clustering precision, fragmentation and accidental merging before and after correction;
- temporary-selfie top-result quality;
- CPU time per photo and per detected face;
- startup time, peak/steady memory use, image pull size and sustained queue throughput;
- failure behaviour, retries, deletion, and restart persistence;
- storage growth and deletion completeness;
- false-match review burden and user complaint handling.

The benchmark report must record the model/image digest, host CPU/RAM, AVX support, dataset size, consent basis and exact test commands. Results from unrecorded hardware or unapproved photos are not acceptance evidence.

## Security and privacy test requirements

Before any adapter can be considered production-capable, tests must prove:

- browser responses never expose provider endpoints, API keys, collection IDs or raw embeddings;
- temporary selfie bytes are absent from database records, Drive, backups, queues, application logs and crash artifacts after success and every failure path;
- idempotent indexing does not reprocess unchanged photos during browsing;
- hidden/trashed photos, hidden people and ignored faces are excluded immediately;
- permanent deletion propagates to provider references and remains retryable after a temporary provider failure;
- a face-engine outage never blocks normal gallery browsing;
- closed-album state blocks public indexing/search entry points but preserves administrator recovery access.

## Rollback rule

Product Phase 2 must remain reversible:

1. Disable new face jobs and Find-me entry points.
2. Keep the gallery, upload, message and administrative photo workflows available.
3. Delete provider-side references through the adapter.
4. Retain only the minimum audited database state required to prove deletion/retry status.
5. Restore `People` and `Find me` to an honest unavailable state without changing the rest of the navigation or layout.

No provider-specific identifier may become a public URL or primary application identity.

## Decision checkpoint

Do not implement a production adapter until the owner chooses one of:

1. CompreFace on an approved separate Docker-capable host;
2. Amazon Rekognition in an approved AWS region;
3. another provider after equivalent review;
4. defer face features while continuing gallery/upload maintenance;
5. reject biometric processing for this project.

The decision must also record:

- provider and region;
- maximum one-time and monthly cost;
- source-photo, face-reference and embedding retention;
- temporary-selfie deletion timing;
- consent, notice and opt-out model;
- administrator correction workflow;
- permanent deletion propagation;
- incident and breach responsibilities.

## Current recommendation

Proceed with Product Phase 2 only through this decision spike and provider-neutral architecture preparation.

Do not host CompreFace inside the existing Replit production app. The first real-provider experiment should be an isolated, non-production benchmark on a separate private CPU host using a small owner-approved and consented dataset. Amazon Rekognition should remain the managed comparison baseline.

Because CompreFace release and image maintenance stopped in 2023, it should not be selected for production solely on the basis that it is free and self-hosted. Selection requires acceptable benchmark quality, a clean or explicitly accepted supply-chain review, a supported host, deletion verification and an operational owner.

Until that checkpoint is approved, the public People and Find-me controls remain unchanged and no production photo or selfie is processed.