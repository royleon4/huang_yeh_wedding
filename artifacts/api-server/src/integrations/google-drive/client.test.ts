import assert from "node:assert/strict";
import { Readable } from "node:stream";
import test from "node:test";
import { GoogleDriveAdapter, type DriveProxy } from "./client";

test("uses the Replit Google Drive proxy for upload, download, and delete", async () => {
  const calls: Array<{
    path: string;
    options?: {
      method?: string;
      headers?: Record<string, string>;
      body?: string | Buffer;
    };
  }> = [];
  const proxy: DriveProxy = async (_connector, path, options) => {
    calls.push({ path, options });
    if (path.startsWith("/upload/")) {
      return new Response(JSON.stringify({ id: "drive-file-1" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    if (options?.method === "DELETE") {
      return new Response(null, { status: 204 });
    }
    return new Response("photo-bytes", {
      status: 200,
      headers: { "content-type": "image/webp", "content-length": "11" },
    });
  };
  const drive = new GoogleDriveAdapter({ proxy, folderId: "folder-1" });

  const uploaded = await drive.upload({
    filename: "memory.webp",
    contentType: "image/webp",
    body: Buffer.from("photo-bytes"),
  });
  const downloaded = await drive.download(uploaded.fileId);
  const chunks: Buffer[] = [];
  for await (const chunk of downloaded.body as Readable) {
    chunks.push(Buffer.from(chunk));
  }
  await drive.delete(uploaded.fileId);

  assert.equal(uploaded.fileId, "drive-file-1");
  assert.equal(downloaded.contentType, "image/webp");
  assert.equal(Buffer.concat(chunks).toString(), "photo-bytes");
  assert.match(calls[0]?.path ?? "", /^\/upload\/drive\/v3\/files\?/);
  assert.equal(calls[0]?.options?.method, "POST");
  assert.match(
    String(calls[0]?.options?.headers?.["Content-Type"]),
    /^multipart\/related/,
  );
  assert.equal(String(calls[0]?.options?.body).includes("folder-1"), true);
  assert.equal(
    calls[1]?.path,
    "/drive/v3/files/drive-file-1?alt=media&supportsAllDrives=true",
  );
  assert.equal(calls[2]?.options?.method, "DELETE");
});

test("redacts response bodies from Drive errors", async () => {
  const proxy: DriveProxy = async () =>
    new Response("sensitive connector response", { status: 403 });
  const drive = new GoogleDriveAdapter({ proxy, folderId: "folder-1" });

  await assert.rejects(
    drive.download("file-id"),
    /Google Drive API request failed with status 403/,
  );
});
