import { importFootballDataDataset } from "@/domain/eval/predictive-intelligence/dataset/loader";
import {
  ensureClubEloCacheDay,
  clubEloAsOfDateForKickoff,
} from "@/domain/eval/data-intelligence/clubelo-ensure";
import { loadPiMatches } from "@/domain/eval/predictive-intelligence/dataset/loader";
import { predictIndependentForEvent } from "@/domain/eval/predictive-intelligence/predict-live";

async function main() {
  const day = clubEloAsOfDateForKickoff("2026-09-12T14:00:00Z");
  console.log("elo_day", day);
  const elo = await ensureClubEloCacheDay({ ratingDateIso: day });
  console.log("elo", JSON.stringify(elo));

  console.log("importing football-data (incl 2425)...");
  const man = await importFootballDataDataset({});
  console.log(
    JSON.stringify({
      total: man.total_rows,
      downloads_ok: man.downloads.filter((d) => d.ok).length,
      downloads_fail: man.downloads.filter((d) => !d.ok).length,
      sample_fail: man.downloads.filter((d) => !d.ok).slice(0, 5),
    }),
  );

  const matches = loadPiMatches();
  const seasons = [...new Set(matches.map((m) => m.season))].sort();
  console.log("seasons_now", seasons, "n", matches.length);

  const r = predictIndependentForEvent({
    sport: "soccer",
    home_team: "Aston Villa",
    away_team: "Nottingham Forest",
    competition: "soccer_epl",
    kickoff_utc: "2026-09-12T14:00:00Z",
  });
  console.log(
    JSON.stringify({
      ok: r.ok,
      coverage: r.feature_coverage,
      probs: r.probability_model,
      codes: r.reason_codes,
      elo_keys: r.feature_snapshot
        ? {
            home_elo: r.feature_snapshot.home_elo,
            away_elo: r.feature_snapshot.away_elo,
            elo_diff: r.feature_snapshot.elo_diff,
          }
        : null,
    }),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
