const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class BatchManagementClientError extends Error {
  constructor(message, { status = 0, code = "REQUEST_FAILED" } = {}) {
    super(message);
    this.name = "BatchManagementClientError";
    this.status = status;
    this.code = code;
  }
}

export function parsePrivateBatchLocation(pathname, hash) {
  const match = pathname.match(/^\/Memories\/manage\/([^/]+)\/?$/);
  if (!match || !UUID_PATTERN.test(match[1])) return null;
  const token = new URLSearchParams(String(hash).replace(/^#/, "")).get(
    "token",
  );
  return {
    batchId: match[1],
    token: token?.trim() || null,
  };
}

async function requestJson({ url, token, method = "GET", fetchImpl = fetch }) {
  const response = await fetchImpl(url, {
    method,
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new BatchManagementClientError(
      body.error || "The private management link could not be opened",
      {
        status: response.status,
        code: body.code,
      },
    );
  }
  return body;
}

export function fetchPrivateBatch({ batchId, token, fetchImpl }) {
  return requestJson({
    url: `/Memories/api/upload-batches/${encodeURIComponent(batchId)}`,
    token,
    fetchImpl,
  });
}

export function withdrawPrivatePhoto({ batchId, photoId, token, fetchImpl }) {
  return requestJson({
    url: `/Memories/api/upload-batches/${encodeURIComponent(batchId)}/photos/${encodeURIComponent(photoId)}`,
    token,
    method: "DELETE",
    fetchImpl,
  });
}

export function rotatePrivateLink({ batchId, token, fetchImpl }) {
  return requestJson({
    url: `/Memories/api/upload-batches/${encodeURIComponent(batchId)}/management-token`,
    token,
    method: "POST",
    fetchImpl,
  });
}
