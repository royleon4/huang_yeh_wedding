function json(response, status, body) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  response.end(JSON.stringify(body));
}

export function createSettingsApi({ repository }) {
  if (!repository) throw new Error("Settings repository is required");

  return async function handleSettingsApi(
    request,
    response,
    url = new URL(request.url ?? "/", "http://localhost"),
  ) {
    if (request.method !== "GET" || url.pathname !== "/Memories/api/settings") {
      return false;
    }
    json(response, 200, await repository.getPublicSettings());
    return true;
  };
}
