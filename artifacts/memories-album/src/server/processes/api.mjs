function json(response, status, body) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  response.end(JSON.stringify(body));
}

function publicProcess(process, content = null) {
  return {
    id: process.id,
    albumId: process.albumId ?? "wedding",
    labelZh: process.labelZh,
    labelEn: process.labelEn,
    displayOrder: process.displayOrder,
    youtubeVideoId: process.youtubeVideoId ?? null,
    youtubeAutoplay: Boolean(process.youtubeAutoplay),
    contentHtmlZh: content?.contentHtmlZh ?? "",
    contentHtmlEn: content?.contentHtmlEn ?? "",
    dividerPaddingTop: content?.dividerPaddingTop ?? 12,
    dividerPaddingBottom: content?.dividerPaddingBottom ?? 12,
    syncState: process.syncState,
    lastSyncedAt: process.lastSyncedAt,
  };
}

function publicAllProcess(content) {
  return {
    id: "all",
    labelZh: content?.labelZh || "全部流程",
    labelEn: content?.labelEn || "All moments",
    displayOrder: 0,
    youtubeVideoId: content?.youtubeVideoId ?? null,
    youtubeAutoplay: Boolean(content?.youtubeAutoplay),
    showAllPhotos: content?.showAllPhotos !== false,
    contentHtmlZh: content?.contentHtmlZh ?? "",
    contentHtmlEn: content?.contentHtmlEn ?? "",
    dividerPaddingTop: content?.dividerPaddingTop ?? 12,
    dividerPaddingBottom: content?.dividerPaddingBottom ?? 12,
  };
}

export function createProcessApi({ repository, contentRepository = null }) {
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
    const labelsPromise =
      typeof repository.listLabels === "function"
        ? repository.listLabels()
        : repository.listProcesses();
    const [processes, contentRows] = await Promise.all([
      labelsPromise,
      contentRepository?.listContent?.() ?? [],
    ]);
    const contentByKey = new Map(
      contentRows.map((content) => [content.processKey, content]),
    );
    json(response, 200, {
      allProcess: publicAllProcess(contentByKey.get("all")),
      processes: processes.map((process) =>
        publicProcess(process, contentByKey.get(process.id)),
      ),
    });
    return true;
  };
}
