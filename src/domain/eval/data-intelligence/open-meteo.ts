import type { SourceObservation } from "@/domain/eval/data-intelligence/types";
import { classifyObservationAsOf } from "@/domain/eval/data-intelligence/observation";

/** Static venue coords for major clubs — no map scrape. */
export const STADIUM_COORDS: Record<string, { lat: number; lon: number; name: string }> = {
  arsenal: { lat: 51.5549, lon: -0.1084, name: "Emirates" },
  chelsea: { lat: 51.4817, lon: -0.1910, name: "Stamford Bridge" },
  liverpool: { lat: 53.4308, lon: -2.9608, name: "Anfield" },
  mancity: { lat: 53.4831, lon: -2.2004, name: "Etihad" },
  manchestercity: { lat: 53.4831, lon: -2.2004, name: "Etihad" },
  manchesterunited: { lat: 53.4631, lon: -2.2913, name: "Old Trafford" },
  tottenham: { lat: 51.6042, lon: -0.0665, name: "Tottenham Hotspur Stadium" },
  tottenhamhotspur: { lat: 51.6042, lon: -0.0665, name: "Tottenham Hotspur Stadium" },
  everton: { lat: 53.4388, lon: -2.9663, name: "Goodison" },
  astonvilla: { lat: 52.5092, lon: -1.8849, name: "Villa Park" },
  nottinghamforest: { lat: 52.94, lon: -1.1326, name: "City Ground" },
  bournemouth: { lat: 50.7352, lon: -1.8384, name: "Vitality Stadium" },
  brentford: { lat: 51.4908, lon: -0.2887, name: "Gtech Community Stadium" },
  brighton: { lat: 50.8616, lon: -0.0837, name: "Amex" },
  crystalpalace: { lat: 51.3983, lon: -0.0855, name: "Selhurst Park" },
  fulham: { lat: 51.4749, lon: -0.2216, name: "Craven Cottage" },
  newcastle: { lat: 54.9756, lon: -1.6217, name: "St James Park" },
  newcastleunited: { lat: 54.9756, lon: -1.6217, name: "St James Park" },
  westham: { lat: 51.5386, lon: -0.0166, name: "London Stadium" },
  wolves: { lat: 52.5903, lon: -2.1304, name: "Molineux" },
  wolverhamptonwanderers: { lat: 52.5903, lon: -2.1304, name: "Molineux" },
  leeds: { lat: 53.7778, lon: -1.5721, name: "Elland Road" },
  leedsunited: { lat: 53.7778, lon: -1.5721, name: "Elland Road" },
  sunderland: { lat: 54.9146, lon: -1.3884, name: "Stadium of Light" },
  ipswich: { lat: 52.055, lon: 1.1448, name: "Portman Road" },
  ipswichtown: { lat: 52.055, lon: 1.1448, name: "Portman Road" },
  hullcity: { lat: 53.746, lon: -0.3676, name: "MKM Stadium" },
  coventrycity: { lat: 52.4481, lon: -1.4956, name: "CBS Arena" },
  roma: { lat: 41.934, lon: 12.4547, name: "Olimpico" },
  asroma: { lat: 41.934, lon: 12.4547, name: "Olimpico" },
  fenerbahce: { lat: 40.9877, lon: 29.0369, name: "Sukru Saracoglu" },
  inter: { lat: 45.4781, lon: 9.1240, name: "San Siro" },
  milan: { lat: 45.4781, lon: 9.1240, name: "San Siro" },
  juventus: { lat: 45.1096, lon: 7.6412, name: "Allianz Stadium" },
  barcelona: { lat: 41.3809, lon: 2.1228, name: "Camp Nou" },
  realmadrid: { lat: 40.4530, lon: -3.6883, name: "Bernabeu" },
  bayernmunich: { lat: 48.2188, lon: 11.6247, name: "Allianz Arena" },
  lazio: { lat: 41.934, lon: 12.4547, name: "Olimpico" },
  fiorentina: { lat: 43.7808, lon: 11.2826, name: "Artemio Franchi" },
  genoa: { lat: 44.4164, lon: 8.9525, name: "Luigi Ferraris" },
  venezia: { lat: 45.4278, lon: 12.3636, name: "Penzo" },
  sevilla: { lat: 37.3841, lon: -5.9706, name: "Ramon Sanchez-Pizjuan" },
  valencia: { lat: 39.4747, lon: -0.3583, name: "Mestalla" },
  rennes: { lat: 48.1074, lon: -1.7129, name: "Roazhon Park" },
  marseille: { lat: 43.2698, lon: 5.3959, name: "Velodrome" },
  monaco: { lat: 43.7276, lon: 7.4156, name: "Louis II" },
  asmonaco: { lat: 43.7276, lon: 7.4156, name: "Louis II" },
  strasbourg: { lat: 48.5601, lon: 7.7550, name: "La Meinau" },
  lehavre: { lat: 49.4989, lon: 0.1708, name: "Stade Oceane" },
  napoli: { lat: 40.8279, lon: 14.1931, name: "Diego Armando Maradona" },
  atalanta: { lat: 45.7090, lon: 9.6808, name: "Gewiss Stadium" },
  bologna: { lat: 44.4922, lon: 11.3098, name: "Renato Dall Ara" },
  torino: { lat: 45.0418, lon: 7.6500, name: "Olimpico Grande Torino" },
  como: { lat: 45.8141, lon: 9.0724, name: "Giuseppe Sinigaglia" },
  psv: { lat: 51.4418, lon: 5.4677, name: "Philips Stadion" },
  psveindhoven: { lat: 51.4418, lon: 5.4677, name: "Philips Stadion" },
  leipzig: { lat: 51.3458, lon: 12.3482, name: "Red Bull Arena" },
  rbleipzig: { lat: 51.3458, lon: 12.3482, name: "Red Bull Arena" },
  dortmund: { lat: 51.4926, lon: 7.4518, name: "Signal Iduna Park" },
  borussiadortmund: { lat: 51.4926, lon: 7.4518, name: "Signal Iduna Park" },
  atleticomadrid: { lat: 40.4362, lon: -3.5995, name: "Metropolitano" },
  athleticbilbao: { lat: 43.2642, lon: -2.9494, name: "San Mames" },
  villarreal: { lat: 39.9442, lon: -0.1034, name: "Estadio de la Ceramica" },
  girona: { lat: 41.9615, lon: 2.8286, name: "Montilivi" },
  lyon: { lat: 45.7653, lon: 4.9821, name: "Groupama Stadium" },
  lille: { lat: 50.6118, lon: 3.1305, name: "Pierre Mauroy" },
  nice: { lat: 43.7051, lon: 7.1926, name: "Allianz Riviera" },
  sporting: { lat: 38.7612, lon: -9.1609, name: "Jose Alvalade" },
  sportinglisbon: { lat: 38.7612, lon: -9.1609, name: "Jose Alvalade" },
  sportingcp: { lat: 38.7612, lon: -9.1609, name: "Jose Alvalade" },
  porto: { lat: 41.1618, lon: -8.5837, name: "Dragao" },
  benfica: { lat: 38.7527, lon: -9.1847, name: "Luz" },
  ajax: { lat: 52.3143, lon: 4.9419, name: "Johan Cruijff Arena" },
  feyenoord: { lat: 51.8939, lon: 4.5232, name: "De Kuip" },
  galatasaray: { lat: 41.0733, lon: 28.9906, name: "RAMS Park" },
  besiktas: { lat: 41.0395, lon: 28.9944, name: "Tupras Stadyumu" },
  celtic: { lat: 55.8497, lon: -4.2056, name: "Celtic Park" },
  rangers: { lat: 55.8530, lon: -4.3092, name: "Ibrox" },
  unionberlin: { lat: 52.4573, lon: 13.5681, name: "Alte Foersterei" },
  leverkusen: { lat: 51.0382, lon: 7.0022, name: "BayArena" },
  bayerleverkusen: { lat: 51.0382, lon: 7.0022, name: "BayArena" },
  wolfsburg: { lat: 52.4328, lon: 10.8039, name: "Volkswagen Arena" },
  stuttgart: { lat: 48.7922, lon: 9.2320, name: "MHP Arena" },
  frankfurt: { lat: 50.0686, lon: 8.6455, name: "Deutsche Bank Park" },
  eintrachtfrankfurt: { lat: 50.0686, lon: 8.6455, name: "Deutsche Bank Park" },
  parissaintgermain: { lat: 48.8414, lon: 2.2530, name: "Parc des Princes" },
  psg: { lat: 48.8414, lon: 2.2530, name: "Parc des Princes" },
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
  const kickMs = Date.parse(input.eventTimeIso);
  const asOfMs = Date.parse(input.asOf);
  const futureKickoff = Number.isFinite(kickMs) && Number.isFinite(asOfMs) && kickMs > asOfMs;
  const url = futureKickoff
    ? `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lon}` +
      `&hourly=temperature_2m,precipitation,precipitation_probability,relativehumidity_2m,windspeed_10m&timezone=UTC&forecast_days=16`
    : `https://archive-api.open-meteo.com/v1/archive?latitude=${coords.lat}&longitude=${coords.lon}` +
      `&start_date=${day}&end_date=${day}&hourly=temperature_2m,precipitation,windspeed_10m&timezone=UTC`;

  let data: {
    hourly?: {
      time?: string[];
      temperature_2m?: (number | null)[];
      precipitation?: (number | null)[];
      precipitation_probability?: (number | null)[];
      relativehumidity_2m?: (number | null)[];
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
  const hourIso = new Date(/Z|[+-]\d{2}:\d{2}$/.test(rawTime) ? rawTime : `${rawTime}Z`).toISOString();
  // Forecast: public at analysis time. Do not use retrieved_at if it is a few ms after asOf
  // (that would systematically mark weather NOT_ELIGIBLE). Archive hours stay DATE-like.
  const available_at = futureKickoff ? input.asOf : hourIso;
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
  const precipProb = data.hourly?.precipitation_probability?.[bestIdx] ?? null;
  const humidity = data.hourly?.relativehumidity_2m?.[bestIdx] ?? null;
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

  return [
    mk("temp_c", temp),
    mk("precip_mm", precip),
    mk("precip_prob_pct", precipProb),
    mk("humidity_pct", humidity),
    mk("wind_kmh", wind),
  ];
}
