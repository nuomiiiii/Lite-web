import assert from "node:assert/strict";
import test from "node:test";
import { uploadArchive } from "../src/utils/archiveUpload.ts";

type FetchCall = { url: string; init?: RequestInit };

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

test("uploads backup archives in server-sized chunks and merges last", async () => {
  const originalFetch = globalThis.fetch;
  const calls: FetchCall[] = [];
  const progress: number[] = [];
  globalThis.fetch = async (input, init) => {
    calls.push({ url: String(input), init });
    if (String(input).endsWith("/init")) {
      return jsonResponse({
        status: "success",
        data: { upload_id: "upload-1", chunk_size: 4, chunks: 3 },
      });
    }
    if (String(input).endsWith("/merge")) {
      return jsonResponse({ status: "success", data: {} });
    }
    return jsonResponse({ status: "success", data: { received: true } });
  };

  try {
    const file = new File(["abcdefghij"], "backup.zip");
    await uploadArchive({
      basePath: "/api/admin/upload",
      purpose: "backup",
      file,
      onProgress: (value) => progress.push(value),
    });

    assert.deepEqual(
      calls.map((call) => call.url),
      [
        "/api/admin/upload/init",
        "/api/admin/upload/chunk",
        "/api/admin/upload/chunk",
        "/api/admin/upload/chunk",
        "/api/admin/upload/merge",
      ],
    );
    const chunkForms = calls.slice(1, 4).map((call) => call.init?.body as FormData);
    assert.deepEqual(chunkForms.map((form) => form.get("upload_id")), ["upload-1", "upload-1", "upload-1"]);
    assert.deepEqual(chunkForms.map((form) => form.get("chunk_index")), ["0", "1", "2"]);
    const chunks = chunkForms.map((form) => form.get("chunk_data") as File);
    assert.deepEqual(chunks.map((chunk) => chunk.size), [4, 4, 2]);
    assert.equal(calls[0].init?.body, JSON.stringify({
      purpose: "backup",
      filename: "backup.zip",
      size: 10,
    }));
    assert.deepEqual(progress, [0, 38, 76, 95, 100]);
    assert.equal(calls.at(-1)?.init?.body, JSON.stringify({ upload_id: "upload-1" }));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("retries only a failed chunk and cancels the session on terminal failure", async () => {
  const originalFetch = globalThis.fetch;
  const calls: FetchCall[] = [];
  let chunkAttempts = 0;
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    calls.push({ url, init });
    if (url.endsWith("/init")) {
      return jsonResponse({
        status: "success",
        data: { upload_id: "upload-2", chunk_size: 4, chunks: 1 },
      });
    }
    if (url.endsWith("/chunk")) {
      chunkAttempts += 1;
      return jsonResponse({ status: "error", message: "temporary" }, 503);
    }
    return jsonResponse({ status: "success", data: {} });
  };

  try {
    await assert.rejects(
      uploadArchive({
        basePath: "/api/install/upload",
        purpose: "backup",
        file: new File(["data"], "backup.zip"),
        maxChunkAttempts: 2,
      }),
      /temporary/,
    );
    assert.equal(chunkAttempts, 2);
    assert.equal(calls.filter((call) => call.url.endsWith("/init")).length, 1);
    assert.equal(calls.filter((call) => call.url.endsWith("/cancel")).length, 1);
    assert.equal(calls.filter((call) => call.url.endsWith("/merge")).length, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("does not report 100 percent when merge validation fails", async () => {
  const originalFetch = globalThis.fetch;
  const progress: number[] = [];
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.endsWith("/init")) {
      return jsonResponse({
        status: "success",
        data: { upload_id: "upload-3", chunk_size: 4, chunks: 1 },
      });
    }
    if (url.endsWith("/merge")) {
      return jsonResponse({ status: "error", message: "invalid backup" }, 400);
    }
    return jsonResponse({ status: "success", data: {} });
  };

  try {
    await assert.rejects(
      uploadArchive({
        basePath: "/api/admin/upload",
        purpose: "backup",
        file: new File(["data"], "backup.zip"),
        onProgress: (value) => progress.push(value),
      }),
      /invalid backup/,
    );
    assert.deepEqual(progress, [0, 95]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("uses only same-origin relative upload endpoints", () => {
  const source = String(uploadArchive);
  assert.doesNotMatch(source, /https?:\/\//);
});
