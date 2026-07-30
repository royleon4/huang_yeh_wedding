const YOUTUBE_VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

function invalidYoutubeUrl() {
  const error = new Error("Enter a valid YouTube video link");
  error.status = 422;
  error.code = "INVALID_YOUTUBE_URL";
  return error;
}

export function normalizeYoutubeVideoId(value) {
  const input = String(value ?? "").trim();
  if (!input) return null;
  if (YOUTUBE_VIDEO_ID_PATTERN.test(input)) return input;

  let url;
  try {
    url = new URL(input);
  } catch {
    throw invalidYoutubeUrl();
  }

  const hostname = url.hostname.toLowerCase().replace(/^www\./, "");
  let candidate = null;
  if (hostname === "youtu.be") {
    candidate = url.pathname.split("/").filter(Boolean)[0] ?? null;
  } else if (
    hostname === "youtube.com" ||
    hostname === "m.youtube.com" ||
    hostname === "music.youtube.com" ||
    hostname === "youtube-nocookie.com"
  ) {
    if (url.pathname === "/watch") {
      candidate = url.searchParams.get("v");
    } else {
      const segments = url.pathname.split("/").filter(Boolean);
      if (["embed", "shorts", "live"].includes(segments[0])) {
        candidate = segments[1] ?? null;
      }
    }
  }

  if (!candidate || !YOUTUBE_VIDEO_ID_PATTERN.test(candidate)) {
    throw invalidYoutubeUrl();
  }
  return candidate;
}

export function youtubeWatchUrl(videoId) {
  return videoId ? `https://www.youtube.com/watch?v=${videoId}` : "";
}
