export function createAbortError(reason?: unknown): Error {
  if (reason instanceof Error && reason.name === "AbortError") {
    return reason;
  }

  const message = typeof reason === "string" ? reason : "The operation was aborted";
  if (typeof DOMException !== "undefined") {
    return new DOMException(message, "AbortError");
  }

  const error = new Error(message);
  error.name = "AbortError";
  return error;
}

export function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw createAbortError(signal.reason);
  }
}
