import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { artifactsRoot039, storeRoot039 } from "@/domain/eval/live-039/config";
import { printVerdictBlock039, type Task039Report } from "@/domain/eval/live-039/lab";

function copyJsonl(fromDir: string, toDir: string, name: string): void {
  const src = join(fromDir, name);
  const dest = join(toDir, name);
  if (existsSync(src)) writeFileSync(dest, readFileSync(src));
  else writeFileSync(dest, "");
}

export function writeTask039Artifacts(report: Task039Report, storeRoot = storeRoot039()): void {
  const docs = join(process.cwd(), "docs");
  const art = join(process.cwd(), "artifacts");
  const dir = artifactsRoot039();
  mkdirSync(docs, { recursive: true });
  mkdirSync(dir, { recursive: true });
  mkdirSync(join(dir, "raw"), { recursive: true });
  copyJsonl(storeRoot, dir, "events.jsonl");
  copyJsonl(storeRoot, dir, "quotes.jsonl");
  copyJsonl(storeRoot, dir, "settlements.jsonl");
  if (existsSync(join(dir, "events.jsonl"))) {
    /* already named events.jsonl */
  }
  writeFileSync(join(dir, "prospective-events.jsonl"), existsSync(join(dir, "events.jsonl")) ? readFileSync(join(dir, "events.jsonl")) : "");
  writeFileSync(join(dir, "prospective-quotes.jsonl"), existsSync(join(dir, "quotes.jsonl")) ? readFileSync(join(dir, "quotes.jsonl")) : "");
  writeFileSync(join(dir, "prospective-settlements.jsonl"), existsSync(join(dir, "settlements.jsonl")) ? readFileSync(join(dir, "settlements.jsonl")) : "");
  writeFileSync(join(dir, "manifest.json"), JSON.stringify(report.manifest, null, 2));
  writeFileSync(join(art, "task-039-result.json"), JSON.stringify(report, null, 2));

  writeFileSync(
    join(docs, "task-039-final-report.md"),
    [
      printVerdictBlock039(report),
      "",
      "## Contract answers",
      "",
      `1. Key configured: ${report.API_KEY_CONFIGURED}`,
      `2. Source responds: ${report.SOURCE_STATUS}`,
      `3. Events discovered: ${report.EVENTS_DISCOVERED}`,
      `4. Quotes with SOURCE timestamp (STRICT): ${report.STRICT_QUOTES}`,
      `5. STRICT events: ${report.STRICT_EVENTS}`,
      `6. T−1h coverage (actual bin, no interpolation): ${report.T1H_COVERAGE}`,
      `7. Settled: ${report.SETTLED_EVENTS}`,
      `8. MATCH_EXACT: ${report.MATCH_EXACT}`,
      `9. TEST: ${report.TEST_EVENTS}`,
      `10. HOLDOUT: ${report.HOLDOUT_EVENTS}`,
      `11. Edge: no`,
      `12. Significance: false`,
      `13. Capital open: no`,
      `14. Winner: null`,
      `15. Blocker: ${report.residual_blocker}`,
      "",
      "TASK 040 is not opened. TASK_031_BASE is not rewritten. MARKET_DEVIG is frozen.",
      "",
      `- fingerprint: \`${report.fingerprint}\``,
      "",
    ].join("\n"),
  );

  writeFileSync(
    join(docs, "task-039-live-data-contract.md"),
    [
      "# TASK 039 — Live data contract",
      "",
      "| field | meaning |",
      "|---|---|",
      "| commence_time | kickoff UTC from source |",
      "| last_update / source_quote_timestamp | SOURCE_QUOTE_TIMESTAMP |",
      "| collected_at | collector clock, never available_at |",
      "| available_at | === source_quote_timestamp or null |",
      "",
      "Missing last_update → INVALID. Missing commence_time → INVALID_KICKOFF.",
      "football-data.org remains fixture/result only.",
      "",
    ].join("\n"),
  );

  writeFileSync(
    join(docs, "task-039-temporal-audit.md"),
    [
      "# TASK 039 — Temporal audit",
      "",
      "Coverage windows require an observation whose offset falls in the bin. No interpolation. No CLOSE→T−1h.",
      "AS_OF T−1h: cutoff = commence_time − 3600s; max(source_quote_timestamp ≤ cutoff). Else NO_OBSERVATION.",
      "LOCK DecisionContext uses only AS_OF quotes. FT/HT stay in the settlement ledger.",
      "",
    ].join("\n"),
  );

  writeFileSync(
    join(docs, "task-039-data-lineage.md"),
    [
      "# TASK 039 — Data lineage",
      "",
      "Ledger: `audit/external/task-039/` (gitignored).",
      "Artifacts: `artifacts/task-039/prospective-*.jsonl`, `manifest.json`, `raw/`.",
      "Raw pull hashes are SHA-256 of the persisted JSON. Same hash is not rewritten.",
      "TASK_031_BASE is REFERENCE only.",
      "",
    ].join("\n"),
  );

  writeFileSync(
    join(docs, "task-039-runbook.md"),
    [
      "# TASK 039 — Runbook",
      "",
      "1. Put `THE_ODDS_API_KEY=` in `.env.local`. Never commit it.",
      "2. `pnpm collect:task-039` — one cycle.",
      "3. `pnpm collect:task-039:loop` — keep collecting.",
      "4. `pnpm lab:task-039` — verdict + artifacts.",
      "",
      "If the key is missing the collector exits 0 with LIVE_NOT_CONFIGURED. No synthetic quotes.",
      "Next step after a key exists: COLLECT → LOCK → REVEAL → SETTLE → TEST → HOLDOUT → VERDICT.",
      "Do not open TASK 040. Do not hunt historical archives.",
      "",
    ].join("\n"),
  );
}
