export type ArchiveUploadPurpose = "backup" | "theme";

type APIResponse<T> = {
  status: "success" | "error";
  message?: string;
  data?: T;
};

type UploadInit = {
  upload_id: string;
  chunk_size: number;
  chunks: number;
};

export type ArchiveUploadOptions = {
  basePath: string;
  purpose: ArchiveUploadPurpose;
  file: File;
  signal?: AbortSignal;
  onProgress?: (progress: number) => void;
  maxChunkAttempts?: number;
};

export class ArchiveUploadError extends Error {
  status: number;

  constructor(message: string, status = 0) {
    super(message);
    this.name = "ArchiveUploadError";
    this.status = status;
  }
}

async function parseResponse<T>(response: Response): Promise<APIResponse<T>> {
  const contentType = response.headers.get("content-type") || "";
  let payload: APIResponse<T> = {
    status: response.ok ? "success" : "error",
  };
  if (contentType.toLowerCase().includes("application/json")) {
    payload = (await response.json()) as APIResponse<T>;
  }
  if (!response.ok || payload.status !== "success") {
    throw new ArchiveUploadError(
      payload.message || `HTTP ${response.status}`,
      response.status,
    );
  }
  return payload;
}

async function requestJSON<T>(
  path: string,
  body: unknown,
  signal?: AbortSignal,
): Promise<APIResponse<T>> {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
    signal,
  });
  return parseResponse<T>(response);
}

function isRetryable(reason: unknown): boolean {
  if (reason instanceof DOMException && reason.name === "AbortError") {
    return false;
  }
  if (reason instanceof ArchiveUploadError) {
    return (
      reason.status === 408 ||
      reason.status === 429 ||
      reason.status >= 500
    );
  }
  return true;
}

function waitForRetry(delay: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const cleanup = () => signal?.removeEventListener("abort", abort);
    const timer = globalThis.setTimeout(() => {
      cleanup();
      resolve();
    }, delay);
    const abort = () => {
      globalThis.clearTimeout(timer);
      cleanup();
      reject(new DOMException("Upload cancelled", "AbortError"));
    };
    if (signal?.aborted) {
      abort();
      return;
    }
    signal?.addEventListener("abort", abort, { once: true });
  });
}

async function uploadChunk(
  path: string,
  uploadID: string,
  chunkIndex: number,
  chunk: Blob,
  signal: AbortSignal | undefined,
  maxAttempts: number,
): Promise<void> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const body = new FormData();
      body.append("upload_id", uploadID);
      body.append("chunk_index", String(chunkIndex));
      body.append("chunk_data", chunk, "chunk.part");
      const response = await fetch(path, {
        method: "POST",
        body,
        cache: "no-store",
        signal,
      });
      await parseResponse(response);
      return;
    } catch (reason) {
      lastError = reason;
      if (attempt === maxAttempts || !isRetryable(reason)) throw reason;
      await waitForRetry(250 * 2 ** (attempt - 1), signal);
    }
  }
  throw lastError;
}

async function cancelUpload(basePath: string, uploadID: string): Promise<void> {
  try {
    await requestJSON(`${basePath}/cancel`, { upload_id: uploadID });
  } catch {
    // The server also expires abandoned sessions and clears them on restart.
  }
}

export async function uploadArchive({
  basePath,
  purpose,
  file,
  signal,
  onProgress,
  maxChunkAttempts = 3,
}: ArchiveUploadOptions): Promise<APIResponse<unknown>> {
  if (!file.name.toLowerCase().endsWith(".zip")) {
    throw new ArchiveUploadError("Only ZIP archives are supported");
  }
  if (file.size <= 0) {
    throw new ArchiveUploadError("The archive is empty");
  }

  let uploadID = "";
  try {
    const init = await requestJSON<UploadInit>(
      `${basePath}/init`,
      { purpose, filename: file.name, size: file.size },
      signal,
    );
    uploadID = init.data?.upload_id || "";
    const chunkSize = init.data?.chunk_size || 0;
    const chunkCount = init.data?.chunks || 0;
    if (!uploadID || chunkSize <= 0 || chunkCount <= 0) {
      throw new ArchiveUploadError("The server returned invalid upload metadata");
    }

    onProgress?.(0);
    for (let index = 0; index < chunkCount; index += 1) {
      const start = index * chunkSize;
      const end = Math.min(file.size, start + chunkSize);
      await uploadChunk(
        `${basePath}/chunk`,
        uploadID,
        index,
        file.slice(start, end),
        signal,
        Math.max(1, maxChunkAttempts),
      );
      onProgress?.(Math.min(95, Math.round((end / file.size) * 95)));
    }

    const result = await requestJSON<unknown>(
      `${basePath}/merge`,
      { upload_id: uploadID },
      signal,
    );
    onProgress?.(100);
    return result;
  } catch (reason) {
    if (uploadID) await cancelUpload(basePath, uploadID);
    throw reason;
  }
}
