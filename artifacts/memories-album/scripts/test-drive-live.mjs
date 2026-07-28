/**
 * Live Google Drive integration smoke-test.
 *
 * Creates a temporary folder and a small file under the configured
 * MEMORIES_DRIVE_PHOTOS_FOLDER_ID root, reads the file back, then
 * deletes both. Intentionally avoids printing folder IDs, tokens,
 * or any Google API response bodies to stdout/stderr.
 *
 * Usage:
 *   node scripts/test-drive-live.mjs
 *
 * Required env:
 *   MEMORIES_DRIVE_PHOTOS_FOLDER_ID  — root folder id (Replit secret)
 *
 * Optional env:
 *   MEMORIES_DRIVE_THUMBNAILS_FOLDER_ID — may be empty; test does not use it
 */

const { createReplitDriveStorage } = await import(
  "../src/server/storage/replit-drive.mjs"
);

function pass(msg) {
  console.log(`  ✓ ${msg}`);
}
function fail(msg, error) {
  console.error(`  ✗ ${msg}`);
  if (error) {
    // Print only the sanitized code/name, never response bodies or IDs
    console.error(`    code=${error.code ?? "none"}  name=${error.name ?? "Error"}`);
  }
  process.exitCode = 1;
}

async function run() {
  console.log("Live Google Drive integration test");

  if (!process.env.MEMORIES_DRIVE_PHOTOS_FOLDER_ID) {
    console.log("  SKIP — MEMORIES_DRIVE_PHOTOS_FOLDER_ID not set");
    process.exit(0);
  }

  let drive;
  try {
    drive = await createReplitDriveStorage(process.env);
    pass("connector proxy initialized");
  } catch (error) {
    fail("connector proxy initialization failed", error);
    return;
  }

  const rootFolderId = process.env.MEMORIES_DRIVE_PHOTOS_FOLDER_ID;
  const testFolderName = `test-live-${Date.now()}`;
  let testFolderId = null;
  let testFileId = null;

  // ── 1. Create a temporary test folder ──────────────────────────────────────
  try {
    const folder = await drive.createFolder({
      parentId: rootFolderId,
      name: testFolderName,
    });
    if (!folder?.id) throw new Error("No folder id returned");
    testFolderId = folder.id;
    pass("createFolder succeeded");
  } catch (error) {
    fail("createFolder failed", error);
    return;
  }

  // ── 2. Upload a small text file into the test folder ───────────────────────
  const testContent = Buffer.from(`memories-live-test-${Date.now()}`);
  try {
    const file = await drive.uploadOriginal({
      bytes: testContent,
      filename: "live-test.txt",
      contentType: "text/plain",
      parentId: testFolderId,
    });
    if (!file?.fileId) throw new Error("No fileId returned");
    testFileId = file.fileId;
    pass("uploadOriginal succeeded");
  } catch (error) {
    fail("uploadOriginal failed", error);
    // Still attempt cleanup
  }

  // ── 3. List the folder's children and verify the file is present ───────────
  if (testFolderId && testFileId) {
    try {
      const children = await drive.listChildren(testFolderId);
      const found = children.some((item) => item.id === testFileId);
      if (!found) throw new Error("Uploaded file not found in listing");
      pass(`listChildren found ${children.length} item(s) — file present`);
    } catch (error) {
      fail("listChildren verification failed", error);
    }
  }

  // ── 4. Download the file and verify content round-trips ───────────────────
  if (testFileId) {
    try {
      const { body } = await drive.download(testFileId);
      // body may be a ReadableStream (fetch) or a Buffer (FakeDrive) — handle both
      let bytes;
      if (Buffer.isBuffer(body)) {
        bytes = body;
      } else {
        // Consume the stream
        const chunks = [];
        for await (const chunk of body) chunks.push(chunk);
        bytes = Buffer.concat(chunks);
      }
      if (!bytes.equals(testContent)) throw new Error("Downloaded content mismatch");
      pass("download content verified");
    } catch (error) {
      fail("download failed", error);
    }
  }

  // ── 5. Delete the test file ────────────────────────────────────────────────
  if (testFileId) {
    try {
      await drive.delete(testFileId);
      pass("delete file succeeded");
    } catch (error) {
      fail("delete file failed", error);
    }
  }

  // ── 6. Delete the test folder ──────────────────────────────────────────────
  if (testFolderId) {
    try {
      await drive.delete(testFolderId);
      pass("delete folder succeeded");
    } catch (error) {
      fail("delete folder failed", error);
    }
  }

  if (process.exitCode === 1) {
    console.log("\nLive test FAILED");
  } else {
    console.log("\nLive test PASSED");
  }
}

await run();
