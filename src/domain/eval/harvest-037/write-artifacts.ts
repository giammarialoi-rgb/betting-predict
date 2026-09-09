import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { printVerdictBlock037, type Task037Report } from "@/domain/eval/harvest-037/lab";
import { SINGLE_MISSING_RESOURCE_037 } from "@/domain/eval/harvest-037/lake";

function table(rows: string[][]): string {
  return rows.map((r) => `| ${r.join(" | ")} |`).join("\n");
}

export function writeTask037Artifacts(report: Task037Report): void {
  const docs = join(process.cwd(), "docs");
  const art = join(process.cwd(), "artifacts");
  const dir = join(art, "task-037");
  mkdirSync(docs, { recursive: true });
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(art, "task-037-result.json"), JSON.stringify(report, null, 2));
  writeFileSync(join(dir, "harvest.json"), JSON.stringify(report.harvest, null, 2));
  writeFileSync(join(dir, "lake.json"), JSON.stringify(report.lake, null, 2));

  const harvestRows = [
    ["repository", "cluster", "role", "class", "exists", "events", "why"],
    ...report.harvest.map((h) => [
      h.repository,
      h.cluster,
      h.role,
      h.classification,
      String(h.exists),
      String(h.events_est),
      h.why.replaceAll("|", "/"),
    ]),
  ];

  writeFileSync(
    join(docs, "task-037-final-report.md"),
    [
      printVerdictBlock037(report),
      "",
      "## SUCCESS_C (lake)",
      "",
      "The GitHub harvest and local data lake are complete. No additional public GitHub soccer clock archive was found. Capital remains closed.",
      "",
      "## THE SINGLE MISSING RESOURCE",
      "",
      SINGLE_MISSING_RESOURCE_037,
      "",
      `- fingerprint: \`${report.fingerprint}\``,
      `- experiment: \`${report.experiment_sha256}\``,
      "",
      "TASK 038 is not opened. TASK_031_BASE is not rewritten.",
      "",
    ].join("\n"),
  );

  writeFileSync(
    join(docs, "task-037-github-harvest.md"),
    [
      "# TASK 037 — GitHub harvest",
      "",
      `Repositories scanned: ${report.GITHUB_REPOSITORIES_SCANNED}.`,
      "",
      table(harvestRows),
      "",
      "Search: betfair+historical+soccer+odds (0 extra), football+odds+timestamp+dataset (0), historical+soccer+bookmaker+odds → iredchuk/soccer-bookmaker-odds (DATE_ONLY averages) and odafeigho/SportyOddsHack (no archive).",
      "",
      "petermclagan/betfair_historical: NOT_FOUND.",
      "akareen: clone checkout failed on Windows (`FORTUNA:LIGA.csv` colon). Inspected via `git show`.",
      "",
    ].join("\n"),
  );

  writeFileSync(
    join(docs, "task-037-source-audit.md"),
    [
      "# TASK 037 — Source audit",
      "",
      table(harvestRows),
      "",
      "Mirrors of football-data.co.uk / open-close averages are one scientific cluster, not independent clocks.",
      "Betfair cluster = official client + parsers + n=1 BASIC sample. Official Soccer dump = BLOCKED_LOGIN.",
      "",
    ].join("\n"),
  );

  writeFileSync(
    join(docs, "task-037-data-lineage.md"),
    [
      "# TASK 037 — Data lineage",
      "",
      "Live clones: `data/external/github/_clones/` (gitignored).",
      "Manifests: `data/external/manifests/task-037-harvest.json`.",
      "TASK_031_BASE SHA-256 unchanged.",
      "No Neon migration.",
      "",
      report.harvest
        .filter((h) => h.commit)
        .map((h) => `- ${h.repository} @ \`${h.commit}\``)
        .join("\n"),
      "",
    ].join("\n"),
  );

  writeFileSync(
    join(docs, "task-037-temporal-audit.md"),
    [
      "# TASK 037 — Temporal audit",
      "",
      "| clock | rule |",
      "|---|---|",
      "| quote_timestamp | source publish only |",
      "| collector scraped_date | never a quote clock |",
      "| opening/closing labels | DATE_ONLY |",
      "| calendar date | DATE_ONLY |",
      "| naive datetime | NAIVE_DATETIME |",
      "| T−1h | last observation ≤ kickoff−3600s, no interpolation |",
      "",
      "No GitHub soccer file satisfied LEVEL_A/B + MATCH_EXACT + T−1h at n≥100.",
      "",
    ].join("\n"),
  );

  writeFileSync(
    join(docs, "task-037-dataset-inventory.md"),
    [
      "# TASK 037 — Dataset inventory",
      "",
      table([
        ["cluster", "events_est", "class"],
        ...report.lake.clusters.map((c) => [c.id, String(c.events_est), c.classification]),
      ]),
      "",
    ].join("\n"),
  );

  writeFileSync(
    join(docs, "task-037-blind-results.md"),
    [
      "# TASK 037 — Blind results",
      "",
      "No new STRICT events. Blind TEST/HOLDOUT not executed on GitHub harvest.",
      "MARKET_BRIER = —. BEST_MODEL = —. HOLDOUT_EMPTY.",
      "If STRICT had reached 100, the same task would have run MARKET_DEVIG vs frozen challengers without opening TASK 038.",
      "",
    ].join("\n"),
  );

  writeFileSync(
    join(docs, "task-037-capital-results.md"),
    [
      "# TASK 037 — Capital results",
      "",
      "CAPITAL_QUALIFIED = false. BETS = 0. BANKROLL = —. REAL_MONEY = false. winner = null.",
      "Never silent 1000→1000.",
      "",
    ].join("\n"),
  );
}
