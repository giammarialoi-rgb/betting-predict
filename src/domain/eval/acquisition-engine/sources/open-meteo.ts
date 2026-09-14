/**
 * Open-Meteo official forecast/archive API — no key.
 * Weather is CONTEXT only. Never invents stadium coords or temperatures.
 */
import { acquisitionGet } from "@/domain/eval/acquisition-engine/http";
import { emptyLane } from "@/domain/eval/acquisition-engine/blocked-audit";
import { registerAcquisitionSource } from "@/domain/eval/acquisition-engine/persist";
import { fetchOpenMeteoContext, resolveStadiumCoords } from "@/domain/eval/data-intelligence/open-meteo";
import { OPEN_METEO_PING_URL } from "@/domain/eval/acquisition-engine/catalog";
import type {
  AcquisitionCycleInput,
  AcquisitionRecord,
  SourceLaneResult,
} from "@/domain/eval/acquisition-engine/types";

function parsePingTemp(jsonText: string): number | null {
  try {
    const parsed = JSON.parse(jsonText) as { current_weather?: { temperature?: unknown } };
    const n = Number(parsed.current_weather?.temperature);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

export async function runOpenMeteoLane(input: {
  url: string;
  nowIso: string;
  persistNeon: boolean;
  jsonText?: string;
  fetchImpl?: typeof fetch;
  labEvents?: AcquisitionCycleInput["labEvents"];
  maxRetries?: number;
}): Promise<SourceLaneResult> {
  let text = input.jsonText;
  let http = 200;
  let retries = 0;
  let url = input.url || OPEN_METEO_PING_URL;

  if (text == null) {
    const got = await acquisitionGet({
      url: OPEN_METEO_PING_URL,
      sourceId: "open-meteo",
      minIntervalMs: input.fetchImpl ? 0 : 1_000,
      fetchImpl: input.fetchImpl,
      maxRetries: input.maxRetries,
    });
    text = got.text;
    http = got.status;
    retries = got.retries;
    url = got.url;
    if (!got.ok) {
      return emptyLane({
        source_id: "open-meteo",
        url,
        status: http === 429 ? "RATE_LIMITED" : http === 403 ? "BLOCKED" : "NETWORK_ERROR",
        http_status: http || null,
        retries,
        reason: got.error ?? `HTTP_${http}`,
        reason_it: `Open-Meteo non disponibile (HTTP ${http || "?"}). Nessuna temperatura inventata.`,
      });
    }
  }

  const pingTemp = parsePingTemp(text);
  if (pingTemp == null && input.jsonText == null) {
    // Forecast ping should include current_weather; archive-shaped fixtures still count as reachable.
    try {
      const parsed = JSON.parse(text) as { hourly?: unknown; current_weather?: unknown };
      if (!parsed.hourly && !parsed.current_weather) {
        return emptyLane({
          source_id: "open-meteo",
          url,
          status: "PARSE_ERROR",
          http_status: http,
          retries,
          reason: "NO_WEATHER_PAYLOAD",
          reason_it: "La risposta Open-Meteo non contiene meteo. Nessun dato inventato.",
        });
      }
    } catch {
      return emptyLane({
        source_id: "open-meteo",
        url,
        status: "PARSE_ERROR",
        http_status: http,
        retries,
        reason: "INVALID_JSON",
        reason_it: "La risposta Open-Meteo non e interpretabile. Nessuna temperatura inventata.",
      });
    }
  }

  const records: AcquisitionRecord[] = [
    {
      source_id: "open-meteo",
      kind: "meta",
      feature_key: "open_meteo_api_reachable",
      value: 1,
      event_id: null,
      home: null,
      away: null,
      kickoff_iso: null,
      team_name: null,
      observed_at: input.nowIso,
      available_at: input.nowIso,
      temporal_precision: "exact",
      feature_status: "CONTEXT",
      enters_independent_model: false,
      extraction_method: "open_meteo_forecast_ping",
      source_url: url,
      identity_status: "UNBOUND",
      reason_it: "API ufficiale Open-Meteo raggiungibile. Meteo di evento solo con coordinate stadio note.",
    },
  ];

  for (const ev of input.labEvents ?? []) {
    const coords = resolveStadiumCoords(ev.home);
    if (!coords) continue;
    const obs = await fetchOpenMeteoContext({
      eventId: ev.event_id,
      homeTeam: ev.home,
      eventTimeIso: ev.kickoff_utc ?? input.nowIso,
      asOf: input.nowIso,
      deps: {
        fetchImpl: input.fetchImpl,
        jsonText: input.jsonText,
      },
    });
    const temp = obs.find((o) => o.key === "temp_c" && typeof o.value === "number");
    if (!temp || typeof temp.value !== "number") continue;
    records.push({
      source_id: "open-meteo",
      kind: "meta",
      feature_key: "temp_c",
      value: temp.value,
      event_id: ev.event_id,
      home: ev.home,
      away: ev.away,
      kickoff_iso: ev.kickoff_utc ?? null,
      team_name: ev.home,
      observed_at: input.nowIso,
      available_at: temp.available_at,
      temporal_precision: "exact",
      feature_status: "CONTEXT",
      enters_independent_model: false,
      extraction_method: "open_meteo_official_api",
      source_url: url,
      identity_status: "UNBOUND",
      reason_it: "Temperatura Open-Meteo (coordinate stadio statiche). Solo contesto; non entra nel modello indipendente.",
    });
  }

  let neon = { source_registered: false, elo_stored: 0, features_stored: 0, reason: null as string | null };
  if (input.persistNeon) {
    neon = await registerAcquisitionSource({
      slug: "open-meteo",
      name: "Open-Meteo",
      licenseClass: "official_api",
    });
  }

  return {
    source_id: "open-meteo",
    ok: true,
    fetched: true,
    status: records.some((r) => r.feature_key === "temp_c") ? "OK" : "PARTIAL",
    http_status: http,
    url,
    records,
    fields_extracted: [...new Set(records.map((r) => r.feature_key))],
    reason: `api_reachable=1; event_temps=${records.filter((r) => r.feature_key === "temp_c").length}`,
    reason_it: `Open-Meteo API ufficiale ok. ${records.filter((r) => r.feature_key === "temp_c").length} temperature evento (solo stadi con coordinate note).`,
    retries,
    cache_path: null,
    neon,
    coverage: { leagues: [], sports: ["football"] },
  };
}
