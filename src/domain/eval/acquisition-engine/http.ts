/**
 * Ordinary GET with retries. 403/401 are permanent. No WAF/CAPTCHA bypass:
 * those statuses are recorded as BLOCKED, never retried as a challenge solve.
 */
import {
  PermanentError,
  RetryableError,
  classifyHttpStatus,
  getMaxRetries,
  getTimeoutMs,
  withRetry,
} from "@/ingest/retry";
import { waitForProviderSlot } from "@/ingest/rate-limit";

export const ACQUISITION_USER_AGENT =
  "betmind-acquisition/1.0 (+ordinary GET; no WAF bypass; no captcha)";

export type AcquisitionHttpResult = {
  ok: boolean;
  status: number;
  text: string;
  retries: number;
  url: string;
  error: string | null;
};

export async function acquisitionGet(input: {
  url: string;
  sourceId: string;
  minIntervalMs: number;
  headers?: Record<string, string>;
  fetchImpl?: typeof fetch;
  maxRetries?: number;
  timeoutMs?: number;
}): Promise<AcquisitionHttpResult> {
  await waitForProviderSlot(input.sourceId, input.minIntervalMs);

  const timeoutMs = input.timeoutMs ?? getTimeoutMs(process.env.INGEST_TIMEOUT_MS);
  const maxRetries = input.maxRetries ?? getMaxRetries(process.env.INGEST_MAX_RETRIES);
  const fetchImpl = input.fetchImpl ?? globalThis.fetch.bind(globalThis);

  try {
    const { value, retryCount } = await withRetry(
      async () => {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), timeoutMs);
        try {
          const res = await fetchImpl(input.url, {
            method: "GET",
            headers: {
              Accept: "application/json,text/csv,text/plain,application/xml,*/*",
              "User-Agent": ACQUISITION_USER_AGENT,
              ...(input.headers ?? {}),
            },
            signal: ctrl.signal,
          });
          const kind = classifyHttpStatus(res.status);
          const text = await res.text();
          if (kind === "retryable") {
            throw new RetryableError(`HTTP_${res.status}`, res.status);
          }
          if (kind === "permanent") {
            throw Object.assign(new PermanentError(`HTTP_${res.status}`, res.status), {
              body: text,
            });
          }
          return { status: res.status, text };
        } finally {
          clearTimeout(t);
        }
      },
      { maxRetries },
    );
    return {
      ok: true,
      status: value.status,
      text: value.text,
      retries: retryCount,
      url: input.url,
      error: null,
    };
  } catch (e) {
    const status =
      e instanceof RetryableError || e instanceof PermanentError ? (e.httpStatus ?? 0) : 0;
    const body =
      e && typeof e === "object" && "body" in e && typeof (e as { body?: unknown }).body === "string"
        ? (e as { body: string }).body
        : "";
    return {
      ok: false,
      status,
      text: body,
      retries: maxRetries,
      url: input.url,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}
