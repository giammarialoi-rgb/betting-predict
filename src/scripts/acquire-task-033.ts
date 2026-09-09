import { probePublic033, blockedSources033 } from "@/domain/eval/market-033/acquire";
import { inventoryFilesystem033 } from "@/domain/eval/market-033/inventory";
import { discoverBasicMarkets033, scanWeeklyBetfair033 } from "@/domain/eval/market-033/discover";
import { writeTask033Artifacts } from "@/domain/eval/market-033/write-artifacts";
import { runTask033 } from "@/domain/eval/market-033/lab";

async function main() {
  const skip = process.env.TASK_033_SKIP_HEAVY === "1";
  const inv = skip ? { files: [], roots_missing: [] } : await inventoryFilesystem033({ hashMaxBytes: 2_000_000 });
  const basic = discoverBasicMarkets033(skip);
  const weekly = await scanWeeklyBetfair033(skip);
  const probes = skip ? [] : await probePublic033({ timeoutMs: 8000 });
  const report = await runTask033({ skipHeavy: skip });
  writeTask033Artifacts(report);
  console.log(
    JSON.stringify(
      {
        acquisition_status: skip ? "LOCAL_FIXTURE" : "LOCAL_PLUS_PROBES",
        files_seen: inv.files.length,
        roots_missing: inv.roots_missing,
        blocked_skipped: blockedSources033(),
        basic_markets: basic.length,
        weekly_fixture_rows: weekly.rows,
        probes: probes.map((p) => ({ id: p.id, acquired: p.acquired, class: p.classification })),
        new_strict_non_1x2: false,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
