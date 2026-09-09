import type { SourceObservation } from "@/domain/eval/data-intelligence/types";
import { classifyObservationAsOf } from "@/domain/eval/data-intelligence/observation";

/** Static venue coords for major clubs — no map scrape. */
export const STADIUM_COORDS: Record<string, { lat: number; lon: number; name: string }> = {
  arsenal: { lat: 51.5549, lon: -0.1084, name: "Emirates" },
  chelsea: { lat: 51.4817, lon: -0.1910, name: "Stamford Bridge" },
  liverpool: { lat: 53.4308, lon: -2.9608, name: "Anfield" },
  mancity: { lat: 53.4831, lon: -2.2004, name: "Etihad" },
  manchesterunited: { lat: 53.4631, lon: -2.2913, name: "Old Trafford" },
  tottenham: { lat: 51.6042, lon: -0.0665, name: "Tottenham Hotspur Stadium" },
  everton: { lat: 53.4388, lon: -2.9663, name: "Goodison" },
  inter: { lat: 45.4781, lon: 9.1240, name: "San Siro" },
  milan: { lat: 45.4781, lon: 9.1240, name: "San Siro" },
  juventus: { lat: 45.1096, lon: 7.6412, name: "Allianz Stadium" },
  barcelona: { lat: 41.3809, lon: 2.1228, name: "Camp Nou" },
  realmadrid: { lat: 40.4530, lon: -3.6883, name: "Bernabeu" },
  bayernmunich: { lat: 48.2188, lon: 11.6247, name: "Allianz Arena" },
};

export function resolveStadiumCoords(homeTeam: string): { lat: number; lon: number } | null {
  const key = homeTeam.toLowerCase().replace(/\s+/g, "");
  if (STADIUM_COORDS[key]) return STADIUM_COORDS[key]!;
  for (const [k, v] of Object.entries(STADIUM_COORDS)) {
    if (key.includes(k) || k.includes(key)) return v;
  }
  return null;
}

export type OpenMeteoFetchDeps = {
  fetchImpl?: typeof fetch;
  /** Inject JSON for offline tests */
  jsonText?: string;
};

/**
 * Fetch archive hourly weather near kickoff. Uses official Open-Meteo API (no key).
 * available_at = hourly timestamp from API; blocked if > asOf.
 */
export async function fetchOpenMeteoContext(input: {
  eventId: string;
  homeTeam: string;
  eventTimeIso: string;
  asOf: string;
  deps?: OpenMeteoFetchDeps;
}): Promise<SourceObservation[]> {
  const retrieved_at = new Date().toISOString();
  const coords = resolveStadiumCoords(input.homeTeam);
  if (!coords) {
    return [
      {
        source_id: "open-meteo",
        event_id: input.eventId,
        event_time: input.eventTimeIso,
        available_at: null,
        retrieved_at,
        key: "weather",
        value: null,
        quality: "unknown",
        legal_status: "public",
        timestamp_precision: "unknown",
        status: "UNAVAILABLE",
        enters_independent_model: false,
      },
    ];
  }

  const day = input.eventTimeIso.slice(0, 10);
  const url =
    `https://archive-api.open-meteo.com/v1/archive?latitude=${coords.lat}&longitude=${coords.lon}` +
    `&start_date=${day}&end_date=${day}&hourly=temperature_2m,precipitation,windspeed_10m&timezone=UTC`;

  let data: {
    hourly?: {
      time?: string[];
      temperature_2m?: (number | null)[];
      precipitation?: (number | null)[];
      windspeed_10m?: (number | null)[];
    };
  };

  if (input.deps?.jsonText) {
    data = JSON.parse(input.deps.jsonText) as typeof data;
  } else {
    try {
      const fetchImpl = input.deps?.fetchImpl ?? globalThis.fetch.bind(globalThis);
      const res = await fetchImpl(url, {
        headers: { Accept: "application/json", "User-Agent": "betmind-research/0.1" },
      });
      if (!res.ok) {
        return [
          {
            source_id: "open-meteo",
            event_id: input.eventId,
            event_time: input.eventTimeIso,
            available_at: null,
            retrieved_at,
            key: "weather",
            value: null,
            quality: "unknown",
            legal_status: "public",
            timestamp_precision: "unknown",
            status: "BLOCKED",
            enters_independent_model: false,
          },
        ];
      }
      data = (await res.json()) as typeof data;
    } catch {
      return [
        {
          source_id: "open-meteo",
          event_id: input.eventId,
          event_time: input.eventTimeIso,
          available_at: null,
          retrieved_at,
          key: "weather",
          value: null,
          quality: "unknown",
          legal_status: "public",
          timestamp_precision: "unknown",
          status: "BLOCKED",
          enters_independent_model: false,
        },
      ];
    }
  }

  const times = data.hourly?.time ?? [];
  const kickMs = Date.parse(input.eventTimeIso);
  const parseHour = (t: string) =>
    Date.parse(/Z|[+-]\d{2}:\d{2}$/.test(t) ? t : `${t}Z`);
  let bestIdx = 0;
  let bestDist = Infinity;
  for (let i = 0; i < times.length; i += 1) {
    const d = Math.abs(parseHour(times[i]!) - kickMs);
    if (d < bestDist) {
      bestDist = d;
      bestIdx = i;
    }
  }
  if (!times[bestIdx]) {
    return [
      {
        source_id: "open-meteo",
        event_id: input.eventId,
        event_time: input.eventTimeIso,
        available_at: null,
        retrieved_at,
        key: "weather",
        value: null,
        quality: "unknown",
        legal_status: "public",
        timestamp_precision: "unknown",
        status: "UNAVAILABLE",
        enters_independent_model: false,
      },
    ];
  }

  const rawTime = times[bestIdx]!;
  const available_at = new Date(/Z|[+-]\d{2}:\d{2}$/.test(rawTime) ? rawTime : `${rawTime}Z`).toISOString();
  if (!Number.isFinite(Date.parse(available_at))) {
    return [
      {
        source_id: "open-meteo",
        event_id: input.eventId,
        event_time: input.eventTimeIso,
        available_at: null,
        retrieved_at,
        key: "weather",
        value: null,
        quality: "unknown",
        legal_status: "public",
        timestamp_precision: "unknown",
        status: "UNAVAILABLE",
        enters_independent_model: false,
      },
    ];
  }
  const status = classifyObservationAsOf({ available_at }, input.asOf);
  const temp = data.hourly?.temperature_2m?.[bestIdx] ?? null;
  const precip = data.hourly?.precipitation?.[bestIdx] ?? null;
  const wind = data.hourly?.windspeed_10m?.[bestIdx] ?? null;

  const mk = (key: string, value: number | null): SourceObservation => ({
    source_id: "open-meteo",
    event_id: input.eventId,
    event_time: input.eventTimeIso,
    available_at,
    retrieved_at,
    key,
    value,
    quality: "official",
    legal_status: "public",
    timestamp_precision: "datetime",
    status: value == null ? "UNAVAILABLE" : status,
    enters_independent_model: false,
  });

  return [mk("temp_c", temp), mk("precip_mm", precip), mk("wind_kmh", wind)];
}
