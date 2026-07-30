function json(response, status, body) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  response.end(JSON.stringify(body));
}

function publicProcess(process) {
  return {
    id: process.id,
    labelZh: process.labelZh,
    labelEn: process.labelEn,
    displayOrder: process.displayOrder,
    youtubeVideoId: process.youtubeVideoId ?? null,
    youtubeAutoplay: Boolean(process.youtubeAutoplay),
    syncState: process.syncState,
    lastSyncedAt: process.lastSyncedAt,
  };
}

export function createProcessApi({ repository }) {
  if (!repository) throw new Error("Process repository is required");

  return async function handleProcessApi(
    request,
    response,
    url = new URL(request.url ?? "/", "http://localhost"),
  ) {
    if (
      request.method !== "GET" ||
      url.pathname !== "/Memories/api/processes"
    ) {
      return false;
    }
    const processes = await repository.listProcesses();
    json(response, 200, { processes: processes.map(publicProcess) });
    return true;
  };
}
