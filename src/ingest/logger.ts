const SENSITIVE_KEY =
  /^(.*)?(key|authorization|token|secret|password|x-apisports-key)(.*)?$/i;

export function redactValue(value: unknown): unknown {
  if (typeof value === "string") {
    return redactString(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item));
  }

  if (value && typeof value === "object") {
    const output: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value)) {
      output[key] = SENSITIVE_KEY.test(key) ? "[redacted]" : redactValue(nested);
    }
    return output;
  }

  return value;
}

function redactString(value: string): string {
  const secrets = [
    process.env.API_FOOTBALL_KEY,
    process.env.FOOTBALL_DATA_ORG_TOKEN,
  ].filter((item): item is string => Boolean(item && item.length > 0));

  return secrets.reduce(
    (current, secret) => current.split(secret).join("[redacted]"),
    value,
  );
}

export interface IngestLogEvent {
  provider: string;
  endpoint: string;
  runId: string;
  durationMs: number;
  status: string;
  records?: {
    received: number;
    stored: number;
    rejected: number;
  };
  httpStatus?: number;
  retryCount?: number;
}

export function logIngest(event: IngestLogEvent): void {
  console.log(JSON.stringify(redactValue(event)));
}

export function sanitizeErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : "unknown error";
  return String(redactValue(message));
}
