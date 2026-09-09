import { NextResponse } from "next/server";
import { storeRoot036 } from "@/domain/eval/prospective-036/config";
import { coverageAlias036, coverageFromStore, eventWindowFlags036, sourceHealth036 } from "@/domain/eval/prospective-036/health";
import { resolveLiveAdapters } from "@/domain/eval/prospective-036/sources";
import { loadStore036 } from "@/domain/eval/prospective-036/store";
import { storeRoot038 } from "@/domain/eval/datalake-038/config";
import { asOfCoverageRate038, liveHealth038 } from "@/domain/eval/datalake-038/health";
import { loadStore038 } from "@/domain/eval/datalake-038/collector";
import { storeRoot039 } from "@/domain/eval/live-039/config";
import { liveHealth039 } from "@/domain/eval/live-039/health";
import { loadStore039 } from "@/domain/eval/live-039/store";
import { getOddsApiKey } from "@/domain/eval/live-039/sources";

export const dynamic = "force-dynamic";

export async function GET() {
  const store036 = loadStore036(storeRoot036());
  const store038 = loadStore038(storeRoot038());
  const adapters = resolveLiveAdapters();
  const sources = adapters.map((a) => sourceHealth036(store036, a.id, a.configured()));
  const eventIds = [...new Set(store036.events.map((e) => e.event_id))];
  const store039 = loadStore039(storeRoot039());
  const live = liveHealth038(store038);
  const live039 = liveHealth039(store039);
  return NextResponse.json({
    source_status: live039.source_status,
    api_configured: live039.api_configured,
    last_poll: live039.last_poll,
    events_discovered: live039.events_discovered,
    quotes_received: live039.quotes_received,
    strict_events: live039.strict_events,
    t1h_coverage: live039.t1h_coverage,
    settled_events: live039.settled_events,
    errors: live039.errors,
    collector_status: live039.collector_status,
    configured: live039.api_configured,
    source: "THE_ODDS_API",
    lastSuccessfulPoll: live039.last_poll,
    eventsDiscovered: live039.events_discovered,
    quotesObserved: live039.quotes_received,
    strictEligible: live039.strict_events,
    collectionStatus: live039.collector_status,
    liveAdapter: "READY",
    apiKey: getOddsApiKey() ? "configured" : "missing",
    coverage038: {
      "T-72h": asOfCoverageRate038(store038, "T-72h"),
      "T-24h": asOfCoverageRate038(store038, "T-24h"),
      "T-1h": asOfCoverageRate038(store038, "T-1h"),
      "T-5m": asOfCoverageRate038(store038, "T-5m"),
    },
    ok: sources.some((s) => s.status === "ok") || live.collectionStatus === "READY" || live.collectionStatus === "COLLECTING",
    coverage: coverageFromStore(store036),
    sources,
    events_seen: store036.events.length,
    quotes_seen: store036.quotes.length,
    strict_events_036: new Set(store036.quotes.filter((q) => q.availability_class === "STRICT").map((q) => q.event_id)).size,
    last_observation: store038.quotes.at(-1)?.quote_observed_at_utc ?? store036.quotes.at(-1)?.quote_observed_at_utc ?? null,
    latency: sources.map((s) => ({ source: s.source, latency_ms: s.latency_ms })),
    clock_quality: sources.map((s) => ({ source: s.source, clock_quality: s.clock_quality })),
    event_coverage: eventIds.map((id) => ({
      event_id: id,
      ...coverageAlias036(eventWindowFlags036(store036.quotes, id)),
    })),
  });
}
