import { createHash } from "node:crypto";

export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }

  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  return `{${keys
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(",")}}`;
}

export function hashPayload(payload: unknown): string {
  return createHash("sha256").update(stableStringify(payload)).digest("hex");
}

export function requestExternalId(
  kind: string,
  params: Record<string, string> | undefined,
): string {
  const entries = Object.entries(params ?? {}).sort(([a], [b]) =>
    a.localeCompare(b),
  );
  const suffix = entries.map(([key, value]) => `${key}=${value}`).join("&");
  return suffix ? `${kind}:${suffix}` : kind;
}
