import type { PermanentEvent044 } from "@/domain/eval/permanent-044/types";

export type DiscoveryClass047 = "SEED" | "DISCOVERED_LIVE" | "RE_DISCOVERED" | "ALREADY_KNOWN";

/** Stable dedupe key — never invent ids across providers. */
export function discoveryKey047(source: string, providerEventId: string): string {
  return `${source}|${providerEventId}`;
}

export function classifyDiscovery047(input: {
  event: PermanentEvent044 | undefined;
  providerEventId: string;
  source: string;
  seenKeys: Set<string>;
}): DiscoveryClass047 {
  const key = discoveryKey047(input.source, input.providerEventId);
  if (input.event?.origin === "LAB_A_SEED" || (input.event && input.event.origin == null)) {
    if (input.seenKeys.has(key)) return "ALREADY_KNOWN";
    return "SEED";
  }
  if (input.event?.origin === "DISCOVERED_LIVE") {
    return input.seenKeys.has(key) ? "RE_DISCOVERED" : "ALREADY_KNOWN";
  }
  if (input.seenKeys.has(key)) return "ALREADY_KNOWN";
  return "DISCOVERED_LIVE";
}
