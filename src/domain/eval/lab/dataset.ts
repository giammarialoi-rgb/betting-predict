/**
 * Controlled synthetic lab dataset for TASK 009.
 * Intentionally includes complete, missing, unknown, late, and post-event cases.
 */

export type LabTeam = { id: string; name: string };

export type LabMatch = {
  eventId: string;
  sportId: "football";
  competitionId: string;
  season: string;
  homeTeamId: string;
  awayTeamId: string;
  scheduledStartAt: Date;
  /** When FT result became knowable (may be AFTER kickoff). */
  resultAvailableAt: Date;
  homeScore: number;
  awayScore: number;
  resultCode: "HOME" | "DRAW" | "AWAY";
};

export type LabElo = {
  teamId: string;
  rating: number;
  snapshotAt: Date;
  availableAt: Date;
  provenance: "official_clubelo" | "provisional_blocked";
};

export type LabQuote = {
  eventId: string;
  marketType: string;
  selectionSide: string;
  line: string | null;
  bookmakerSlug: string;
  oddsDecimal: number;
  availableAt: Date;
  temporalPrecision: "exact" | "unknown" | "dataset_window";
  observationKind: string;
};

export type LabDataset = {
  version: string;
  teams: LabTeam[];
  matches: LabMatch[];
  elo: LabElo[];
  quotes: LabQuote[];
};

function d(iso: string): Date {
  return new Date(iso);
}

/**
 * ~120 chronological football matches across seasons 2019–2024
 * with engineered edge cases for leakage / missingness tests.
 */
export function buildLabDataset(): LabDataset {
  const teams: LabTeam[] = [
    { id: "t_alpha", name: "Alpha FC" },
    { id: "t_beta", name: "Beta United" },
    { id: "t_gamma", name: "Gamma City" },
    { id: "t_delta", name: "Delta Rovers" },
    { id: "t_epsilon", name: "Epsilon Athletic" },
    { id: "t_zeta", name: "Zeta Wanderers" },
  ];

  const matches: LabMatch[] = [];
  const quotes: LabQuote[] = [];
  const elo: LabElo[] = [];

  // Elo history per team (bi-monthly-ish)
  const teamIds = teams.map((t) => t.id);
  let eloBase = 1480;
  for (const teamId of teamIds) {
    eloBase += 15;
    elo.push(
      {
        teamId,
        rating: eloBase,
        snapshotAt: d("2019-01-01T00:00:00.000Z"),
        availableAt: d("2019-01-01T00:00:00.000Z"),
        provenance: "official_clubelo",
      },
      {
        teamId,
        rating: eloBase + 20,
        snapshotAt: d("2021-01-01T00:00:00.000Z"),
        availableAt: d("2021-01-01T00:00:00.000Z"),
        provenance: "official_clubelo",
      },
      {
        teamId,
        rating: eloBase + 35,
        snapshotAt: d("2023-01-01T00:00:00.000Z"),
        availableAt: d("2023-01-01T00:00:00.000Z"),
        provenance: "official_clubelo",
      },
      {
        teamId,
        rating: eloBase + 80,
        snapshotAt: d("2025-07-01T00:00:00.000Z"),
        availableAt: d("2025-07-01T00:00:00.000Z"),
        provenance: "provisional_blocked",
      },
    );
  }

  const results: Array<"HOME" | "DRAW" | "AWAY"> = [
    "HOME",
    "HOME",
    "DRAW",
    "AWAY",
    "HOME",
    "AWAY",
    "DRAW",
    "HOME",
    "AWAY",
    "HOME",
  ];

  let idx = 0;
  for (let year = 2019; year <= 2024; year++) {
    for (let round = 0; round < 20; round++) {
      const home = teams[round % teams.length]!;
      const away = teams[(round + 1 + (year % 3)) % teams.length]!;
      if (home.id === away.id) continue;

      const day = 1 + (round % 27);
      const month = 1 + (round % 10);
      const kickoff = d(
        `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T15:00:00.000Z`,
      );
      const resultCode = results[idx % results.length]!;
      idx++;

      let homeScore = 1;
      let awayScore = 1;
      if (resultCode === "HOME") {
        homeScore = 2;
        awayScore = 0;
      } else if (resultCode === "AWAY") {
        homeScore = 0;
        awayScore = 2;
      }

      // Case: late-published result (available after kickoff+days)
      const latePublish = round === 7 && year === 2022;
      const resultAvailableAt = latePublish
        ? new Date(kickoff.getTime() + 5 * 86_400_000)
        : new Date(kickoff.getTime() + 2 * 3_600_000);

      const eventId = `lab_${year}_${round}_${home.id}_${away.id}`;
      matches.push({
        eventId,
        sportId: "football",
        competitionId: "LAB1",
        season: String(year),
        homeTeamId: home.id,
        awayTeamId: away.id,
        scheduledStartAt: kickoff,
        resultAvailableAt,
        homeScore,
        awayScore,
        resultCode,
      });

      const openAt = new Date(kickoff.getTime() - 2 * 86_400_000);
      const midAt = new Date(kickoff.getTime() - 6 * 3_600_000);
      const closeAt = new Date(kickoff.getTime() - 5 * 60_000);
      const postAt = new Date(kickoff.getTime() + 3_600_000);

      const homeOdds = resultCode === "HOME" ? 1.8 : resultCode === "AWAY" ? 3.5 : 2.6;
      const drawOdds = 3.3;
      const awayOdds = resultCode === "AWAY" ? 1.9 : resultCode === "HOME" ? 4.0 : 2.7;

      for (const book of ["bet365", "pinnacle"] as const) {
        const skew = book === "pinnacle" ? 0.05 : 0;
        quotes.push(
          {
            eventId,
            marketType: "result",
            selectionSide: "HOME",
            line: null,
            bookmakerSlug: book,
            oddsDecimal: homeOdds + skew,
            availableAt: openAt,
            temporalPrecision: "exact",
            observationKind: "exact_tick",
          },
          {
            eventId,
            marketType: "result",
            selectionSide: "DRAW",
            line: null,
            bookmakerSlug: book,
            oddsDecimal: drawOdds,
            availableAt: openAt,
            temporalPrecision: "exact",
            observationKind: "exact_tick",
          },
          {
            eventId,
            marketType: "result",
            selectionSide: "AWAY",
            line: null,
            bookmakerSlug: book,
            oddsDecimal: awayOdds - skew,
            availableAt: openAt,
            temporalPrecision: "exact",
            observationKind: "exact_tick",
          },
          {
            eventId,
            marketType: "result",
            selectionSide: "HOME",
            line: null,
            bookmakerSlug: book,
            oddsDecimal: homeOdds + skew - 0.05,
            availableAt: midAt,
            temporalPrecision: "exact",
            observationKind: "exact_tick",
          },
          {
            eventId,
            marketType: "result",
            selectionSide: "HOME",
            line: null,
            bookmakerSlug: book,
            oddsDecimal: homeOdds + skew - 0.1,
            availableAt: closeAt,
            temporalPrecision: "exact",
            observationKind: "exact_tick",
          },
          // post-kickoff quote (leakage if used prematch)
          {
            eventId,
            marketType: "result",
            selectionSide: "HOME",
            line: null,
            bookmakerSlug: book,
            oddsDecimal: 1.01,
            availableAt: postAt,
            temporalPrecision: "exact",
            observationKind: "exact_tick",
          },
        );
      }

      // Unknown-precision dataset open/close style quotes
      quotes.push(
        {
          eventId,
          marketType: "total_goals",
          selectionSide: "OVER",
          line: "2.5",
          bookmakerSlug: "bet365",
          oddsDecimal: 1.9,
          availableAt: openAt,
          temporalPrecision: "unknown",
          observationKind: "dataset_open",
        },
        {
          eventId,
          marketType: "total_goals",
          selectionSide: "UNDER",
          line: "2.5",
          bookmakerSlug: "bet365",
          oddsDecimal: 1.9,
          availableAt: openAt,
          temporalPrecision: "unknown",
          observationKind: "dataset_open",
        },
      );

      // Missing-market case: skip BTTS for early rounds of 2019
      if (!(year === 2019 && round < 3)) {
        quotes.push(
          {
            eventId,
            marketType: "both_teams_to_score",
            selectionSide: "YES",
            line: null,
            bookmakerSlug: "bet365",
            oddsDecimal: 1.85,
            availableAt: midAt,
            temporalPrecision: "exact",
            observationKind: "exact_tick",
          },
          {
            eventId,
            marketType: "both_teams_to_score",
            selectionSide: "NO",
            line: null,
            bookmakerSlug: "bet365",
            oddsDecimal: 1.95,
            availableAt: midAt,
            temporalPrecision: "exact",
            observationKind: "exact_tick",
          },
        );
      }
    }
  }

  // Dedicated leakage probe event
  matches.push({
    eventId: "lab_leak_probe",
    sportId: "football",
    competitionId: "LAB1",
    season: "2024",
    homeTeamId: "t_alpha",
    awayTeamId: "t_beta",
    scheduledStartAt: d("2024-09-15T17:30:00.000Z"),
    resultAvailableAt: d("2024-09-15T19:30:00.000Z"),
    homeScore: 1,
    awayScore: 0,
    resultCode: "HOME",
  });
  elo.push({
    teamId: "t_alpha",
    rating: 1600,
    snapshotAt: d("2024-09-10T00:00:00.000Z"),
    availableAt: d("2024-09-10T00:00:00.000Z"),
    provenance: "official_clubelo",
  });
  elo.push({
    teamId: "t_alpha",
    rating: 1620,
    snapshotAt: d("2024-09-20T00:00:00.000Z"),
    availableAt: d("2024-09-20T00:00:00.000Z"),
    provenance: "official_clubelo",
  });
  elo.push({
    teamId: "t_beta",
    rating: 1550,
    snapshotAt: d("2024-09-10T00:00:00.000Z"),
    availableAt: d("2024-09-10T00:00:00.000Z"),
    provenance: "official_clubelo",
  });

  return {
    version: "lab_v1_2019_2024",
    teams,
    matches,
    elo,
    quotes,
  };
}
