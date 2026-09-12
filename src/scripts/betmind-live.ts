/**
 * pnpm betmind:live — ESPN + OpenLiga live refresh for in-play board events.
 * No --event = all in-play / recently kicked-off board targets.
 * Settles only when the source publishes completed/FT. Does not invent scores.
 * Default publish is LIGHT (patch remote live_snapshots / next_events / board).
 * Full Lab B rebuild (can hang on Windows): --full-publish
 * Loop: pnpm betmind:live -- --loop --interval 60
 */
import { config } from "dotenv";
import { GOLDEN_EVENT_ID } from "@/domain/eval/betmind-runtime/live-state";
import { refreshInPlayFromEspn } from "@/domain/eval/betmind-runtime/live-refresh";

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function once() {
  const eventId = arg("--event");
  const report = await refreshInPlayFromEspn({
    eventId,
    fullPublish: process.argv.includes("--full-publish"),
  });
  const live = report.ingest.states[0];
  console.log(
    JSON.stringify(
      {
        at: report.at,
        neon_in_use: report.neon_in_use,
        targets: report.targets,
        ingest: {
          ok: report.ingest.ok,
          http_status: report.ingest.http_status,
          parsed: report.ingest.parsed,
          matched: report.ingest.matched,
          reason: report.ingest.reason,
        },
        live: live
          ? {
              event_id: live.event_id,
              status: live.status,
              score: `${live.home_goals}-${live.away_goals}`,
              minute: live.minute,
              finished: live.finished,
              source: live.source,
            }
          : null,
        settlements: report.settlements.map((s) => ({
          settled: s.settled,
          result: s.result,
          reason: s.reason,
        })),
        settle_deferred: report.settle_deferred,
        publish_mode: report.publish_mode,
        published: report.published,
        settle_command: `pnpm betmind:live -- --event ${eventId ?? GOLDEN_EVENT_ID}`,
      },
      null,
      2,
    ),
  );
  if (report.settle_deferred) {
    console.log("SETTLE DEFERRED until ESPN type.completed=true. Re-run the same command.");
  }
}

async function main() {
  config({ path: ".env.local" });
  config({ path: ".env" });
  const loop = process.argv.includes("--loop");
  const intervalSec = Math.max(30, Number(arg("--interval") ?? 60) || 60);
  await once();
  if (!loop) return;
  console.log(`loop interval=${intervalSec}s`);
  setInterval(() => {
    void once().catch((e) => console.error(e));
  }, intervalSec * 1000);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
