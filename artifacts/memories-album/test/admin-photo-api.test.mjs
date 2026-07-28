import assert from "node:assert/strict";
import test from "node:test";
import { createAdminPhotoApi } from "../src/server/photos/admin-api.mjs";

const PHOTO_ID = "11111111-1111-4111-8111-111111111111";

function request(token = null) {
  return {
    method: "DELETE",
    url: `/Memories/api/admin/photos/${PHOTO_ID}`,
    headers: token ? { authorization: `Bearer ${token}` } : {},
  };
}

function responseRecorder() {
  return {
    status: null,
    headers: null,
    body: null,
    writeHead(status, headers) {
      this.status = status;
      this.headers = headers;
    },
    end(body = "") {
      this.body = body ? JSON.parse(body) : null;
    },
  };
}

function photo() {
  return {
    id: PHOTO_ID,
    driveFileId: "original-drive-file",
    thumbnailDriveFileId: "thumbnail-drive-file",
  };
}

test("admin photo deletion requires the server-side password", async () => {
  let lookedUp = false;
  const api = createAdminPhotoApi({
    repository: {
      async findPhotoForAdmin() {
        lookedUp = true;
        return photo();
      },
    },
    drive: { async delete() {} },
    adminToken: "correct-password",
  });
  const response = responseRecorder();

  assert.equal(await api(request("wrong-password"), response), true);
  assert.equal(response.status, 401);
  assert.equal(response.body.code, "UNAUTHORIZED");
  assert.equal(lookedUp, false);
});

test("admin deletion removes thumbnail, original, then database record", async () => {
  const deletedDriveFiles = [];
  const deletedRecords = [];
  const api = createAdminPhotoApi({
    repository: {
      async findPhotoForAdmin() {
        return photo();
      },
      async clearThumbnail() {
        throw new Error("clearThumbnail should not be called");
      },
      async deletePhotoRecord(photoId) {
        deletedRecords.push(photoId);
      },
      async trashPhoto() {
        throw new Error("trashPhoto should not be called");
      },
    },
    drive: {
      async delete(fileId) {
        deletedDriveFiles.push(fileId);
      },
    },
    adminToken: "correct-password",
  });
  const response = responseRecorder();

  assert.equal(await api(request("correct-password"), response), true);
  assert.equal(response.status, 200);
  assert.deepEqual(deletedDriveFiles, [
    "thumbnail-drive-file",
    "original-drive-file",
  ]);
  assert.deepEqual(deletedRecords, [PHOTO_ID]);
  assert.deepEqual(response.body, { deleted: true, photoId: PHOTO_ID });
});

test("a failed original deletion clears the already removed thumbnail reference", async () => {
  const cleared = [];
  const driveError = new Error("Drive unavailable");
  driveError.code = "DRIVE_RETRYABLE";
  const api = createAdminPhotoApi({
    repository: {
      async findPhotoForAdmin() {
        return photo();
      },
      async clearThumbnail(photoId, fileId) {
        cleared.push([photoId, fileId]);
      },
      async deletePhotoRecord() {
        throw new Error("database record must remain");
      },
      async trashPhoto() {},
    },
    drive: {
      async delete(fileId) {
        if (fileId === "original-drive-file") throw driveError;
      },
    },
    adminToken: "correct-password",
  });

  await assert.rejects(
    api(request("correct-password"), responseRecorder()),
    (error) => error === driveError,
  );
  assert.deepEqual(cleared, [[PHOTO_ID, "thumbnail-drive-file"]]);
});

test("a database failure after Drive deletion hides the broken record", async () => {
  const trashed = [];
  const databaseError = new Error("database unavailable");
  const api = createAdminPhotoApi({
    repository: {
      async findPhotoForAdmin() {
        return photo();
      },
      async clearThumbnail() {},
      async deletePhotoRecord() {
        throw databaseError;
      },
      async trashPhoto(photoId) {
        trashed.push(photoId);
      },
    },
    drive: { async delete() {} },
    adminToken: "correct-password",
  });

  await assert.rejects(
    api(request("correct-password"), responseRecorder()),
    (error) => error === databaseError,
  );
  assert.deepEqual(trashed, [PHOTO_ID]);
});
