/**
 * Information contracts — injuries / lineups / news / weather / players.
 * No NLP. Temporal firewall via available_at.
 */

export type InformationType =
  | "INJURY"
  | "LINEUP"
  | "NEWS"
  | "SUSPENSION"
  | "WEATHER_FORECAST"
  | "PLAYER_STAT";

export type InformationEvent = {
  information_type: InformationType;
  subject: string;
  published_at: Date;
  available_at: Date;
  source: string;
  /** Never invent — null until measured. */
  confidence: null;
  payload?: Record<string, unknown>;
};

export function filterInformationAsOf(
  events: readonly InformationEvent[],
  asOf: Date,
): InformationEvent[] {
  return events.filter((e) => e.available_at.getTime() <= asOf.getTime());
}

export function assertInformationNotAfterAsOf(
  event: InformationEvent,
  asOf: Date,
): void {
  if (event.available_at.getTime() > asOf.getTime()) {
    throw new Error(
      `INFO_LEAK: ${event.information_type} for ${event.subject} available after asOf`,
    );
  }
}

export type PlayerObservation = {
  playerId: string;
  teamId: string;
  minutes: number | null;
  starts: number | null;
  goals: number | null;
  assists: number | null;
  shots: number | null;
  shots_on_target: number | null;
  cards: number | null;
  /** When this observation became knowable. */
  availability_at: Date;
};

export type WeatherForecast = {
  temperature: number | null;
  precipitation: number | null;
  wind: number | null;
  humidity: number | null;
  weather_condition: string | null;
  forecast_available_at: Date;
  event_time: Date;
};

export function assertWeatherForecastAsOf(
  forecast: WeatherForecast,
  asOf: Date,
): void {
  if (forecast.forecast_available_at.getTime() > asOf.getTime()) {
    throw new Error("WEATHER_LEAK: forecast_available_at after asOf");
  }
  // Never use post-event observed weather as prematch forecast.
  if (asOf.getTime() >= forecast.event_time.getTime()) {
    // Decision after kickoff — caller must flag separately.
  }
}
