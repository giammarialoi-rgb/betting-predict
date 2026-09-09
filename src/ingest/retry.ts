export class RetryableError extends Error {
  readonly httpStatus?: number;

  constructor(message: string, httpStatus?: number) {
    super(message);
    this.name = "RetryableError";
    this.httpStatus = httpStatus;
  }
}

export class PermanentError extends Error {
  readonly httpStatus?: number;

  constructor(message: string, httpStatus?: number) {
    super(message);
    this.name = "PermanentError";
    this.httpStatus = httpStatus;
  }
}

export function classifyHttpStatus(status: number): "ok" | "retryable" | "permanent" {
  if (status >= 200 && status < 300) {
    return "ok";
  }
  if (status === 429 || status >= 500) {
    return "retryable";
  }
  return "permanent";
}

export function classifyFetchError(error: unknown): RetryableError | PermanentError {
  if (error instanceof RetryableError || error instanceof PermanentError) {
    return error;
  }

  if (error instanceof DOMException && error.name === "AbortError") {
    return new RetryableError("timeout");
  }

  if (error instanceof Error && /abort|timeout|network|fetch|econnreset|enotfound/i.test(error.message)) {
    return new RetryableError(error.message);
  }

  return new PermanentError(error instanceof Error ? error.message : "unknown error");
}

export function getMaxRetries(envValue: string | undefined): number {
  const parsed = Number(envValue);
  if (!Number.isInteger(parsed) || parsed < 0) {
    return 3;
  }
  return parsed;
}

export function getTimeoutMs(envValue: string | undefined): number {
  const parsed = Number(envValue);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 15_000;
  }
  return parsed;
}

export async function withRetry<T>(
  operation: () => Promise<T>,
  options: {
    maxRetries: number;
    sleep?: (ms: number) => Promise<void>;
  },
): Promise<{ value: T; retryCount: number }> {
  const sleep = options.sleep ?? delay;
  let attempt = 0;
  let lastError: unknown;

  while (attempt <= options.maxRetries) {
    try {
      const value = await operation();
      return { value, retryCount: attempt };
    } catch (error) {
      const classified = classifyFetchError(error);
      lastError = classified;
      if (
        classified instanceof PermanentError ||
        attempt === options.maxRetries
      ) {
        throw classified;
      }
      await sleep(2 ** attempt * 50);
      attempt += 1;
    }
  }

  throw lastError;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
