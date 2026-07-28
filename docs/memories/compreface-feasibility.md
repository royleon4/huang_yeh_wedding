# CompreFace feasibility for standalone Memories

Issue: #18

Status: **preliminary technical assessment — provider and hosting are not approved**

## Preliminary answer

CompreFace can supply the low-level face capabilities needed by Memories:

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

## Required benchmark

Use a representative, owner-approved test set containing:

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
- failure behaviour, retries, deletion, and restart persistence.

## Decision checkpoint

Do not implement a production adapter until the owner chooses one of:

1. CompreFace on an approved Docker-capable host;
2. Amazon Rekognition;
3. another provider;
4. defer face features while shipping the gallery/upload system.

## Current recommendation

Proceed with the benchmark and provider-neutral application design. CompreFace is technically plausible and may reduce per-request vendor charges, but it should not yet be treated as the final provider because hosting, maintenance, and unknown-person clustering remain unproven for this wedding workload.
