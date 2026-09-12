/**
 * Analyze every eligible board event through the real ANALYZE_EVENT slice.
 * Compose runRealAnalysisPipeline — do not invent a second path.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { NEON_IN_USE } from "@/domain/storage";
import { permanentRoot044 } from "@/domain/eval/permanent-044/config";
import { appendEvent044, loadStore044 } from "@/domain/eval/permanent-044/store";
import { discoverGoldenCandidates } from "@/domain/eval/betmind-runtime/golden-e2e/discover";
import { readRemoteMirror } from "@/domain/eval/betmind-runtime/remote-mirror";
import { runRealAnalysisPipeline, type RealPipelineReport } from "@/domain/eval/real-pipeline/run";
import {
  candidateToPermanentEvent,
  loadBoardCandidates,
  selectEligibleBoardEvents,
  type BoardCandidate,
} from "@/domain/eval/real-pipeline/board-select";

export type BoardEventRunRow = {
  event_id: string;
  label: string;
  decision: string | null;
  coverage: number | null;
  publish: string | null;
  errors: string[];
  status: "ok" | "failed" | "skipped" | "dry_run";
};

export type BoardRunReport = {
  at: string;
  neon_in_use: false;
  selected: number;
  analyzed: number;
  failed: number;
  skipped_finished: number;
  concurrency: number;
  dry_run: boolean;
  include_finished: boolean;
  include_discovery: boolean;
  rows: BoardEventRunRow[];
};

export type RunBoardAnalysisOptions = {
  labBRoot?: string;
  nowMs?: number;
  includeFinished?: boolean;
  includeDiscovery?: boolean;
  concurrency?: number;
  limit?: number;
  dryRun?: boolean;
  eventIds?: string[];
};

function clampConcurrency(n: number | undefined): number {
  if (!Number.isFinite(n) || n == null) return 1;
  return Math.min(2, Math.max(1, Math.floor(n)));
}

async function mapPool<T, R>(items: T[], concurrency: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next;
      next += 1;
      out[i] = await fn(items[i]!, i);
    }
  }
  const n = Math.min(concurrency, Math.max(1, items.length));
  await Promise.all(Array.from({ length: n }, () => worker()));
  return out;
}

function rowFromCandidate(c: BoardCandidate, extra?: Partial<BoardEventRunRow>): BoardEventRunRow {
  return {
    event_id: c.event_id,
    label: `${c.home} vs ${c.away}`,
    decision: extra?.decision ?? null,
    coverage: extra?.coverage ?? null,
    publish: extra?.publish ?? null,
    errors: extra?.errors ?? [],
    status: extra?.status ?? "ok",
  };
}

function rowFromPipeline(c: BoardCandidate, report: RealPipelineReport): BoardEventRunRow {
  const failed = report.errors.includes("EVENT_NOT_FOUND") || report.publish.status === "PUBLISH_ERROR";
  return rowFromCandidate(c, {
    decision: report.decision,
    coverage: report.feature_coverage,
    publish: report.publish.status,
    errors: report.errors,
    status: failed ? "failed" : "ok",
  });
}

export async function selectBoardEventsForAnalyze(
  opts: RunBoardAnalysisOptions = {},
): Promise<{
  selected: BoardCandidate[];
  skipped_finished: number;
  all: BoardCandidate[];
}> {
  const nowMs = opts.nowMs ?? Date.now();
  const root = opts.labBRoot ?? permanentRoot044();
  const remote = await readRemoteMirror();
  let discovery = undefined;
  if (opts.includeDiscovery !== false) {
    try {
      const got = await discoverGoldenCandidates(nowMs);
      discovery = got.candidates;
    } catch {
      discovery = [];
    }
  }
  const all = await loadBoardCandidates({ labBRoot: root, remote, discovery });
  let { selected, skipped_finished } = selectEligibleBoardEvents(all, {
    nowMs,
    includeFinished: opts.includeFinished === true,
  });
  if (opts.eventIds?.length) {
    const want = new Set(opts.eventIds);
    selected = selected.filter((c) => want.has(c.event_id));
  }
  if (opts.limit && opts.limit > 0) selected = selected.slice(0, opts.limit);
  return { selected, skipped_finished, all };
}

export async function runBoardAnalysis(opts: RunBoardAnalysisOptions = {}): Promise<BoardRunReport> {
  if (NEON_IN_USE) throw new Error("NEON_BANNED");
  const nowMs = opts.nowMs ?? Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const root = opts.labBRoot ?? permanentRoot044();
  const concurrency = clampConcurrency(opts.concurrency);
  const dryRun = opts.dryRun === true;
  const { selected, skipped_finished } = await selectBoardEventsForAnalyze({ ...opts, labBRoot: root, nowMs });

  const report: BoardRunReport = {
    at: nowIso,
    neon_in_use: false,
    selected: selected.length,
    analyzed: 0,
    failed: 0,
    skipped_finished,
    concurrency,
    dry_run: dryRun,
    include_finished: opts.includeFinished === true,
    include_discovery: opts.includeDiscovery !== false,
    rows: [],
  };

  if (dryRun) {
    report.rows = selected.map((c) => rowFromCandidate(c, { status: "dry_run" }));
    return report;
  }

  const store = loadStore044(root);
  for (const c of selected) {
    appendEvent044(store, candidateToPermanentEvent(c, nowIso));
  }

  const rows = await mapPool(selected, concurrency, async (c, index) => {
    try {
      const slice = await runRealAnalysisPipeline({
        eventId: c.event_id,
        labBRoot: root,
        nowMs,
        ensureHistoricalPriors: index === 0,
        skipSourceCatalogAudit: index > 0,
      });
      return rowFromPipeline(c, slice);
    } catch (e) {
      return rowFromCandidate(c, {
        status: "failed",
        errors: [e instanceof Error ? e.message : String(e)],
        publish: "PUBLISH_ERROR",
      });
    }
  });

  report.rows = rows;
  report.analyzed = rows.filter((r) => r.status === "ok").length;
  report.failed = rows.filter((r) => r.status === "failed").length;
  return report;
}

export function formatBoardRunTable(report: BoardRunReport): string {
  const header = [
    "event_id".padEnd(28),
    "label".padEnd(36),
    "decision".padEnd(20),
    "coverage".padEnd(10),
    "publish".padEnd(22),
    "errors",
  ].join(" ");
  const lines = [header, "-".repeat(header.length)];
  for (const row of report.rows) {
    lines.push(
      [
        row.event_id.slice(0, 28).padEnd(28),
        row.label.slice(0, 36).padEnd(36),
        String(row.decision ?? "—").slice(0, 20).padEnd(20),
        row.coverage == null ? "n/a".padEnd(10) : row.coverage.toFixed(2).padEnd(10),
        String(row.publish ?? row.status).slice(0, 22).padEnd(22),
        row.errors.join(",") || "—",
      ].join(" "),
    );
  }
  lines.push(
    "",
    `selected=${report.selected} analyzed=${report.analyzed} failed=${report.failed} skipped_finished=${report.skipped_finished} concurrency=${report.concurrency} dry_run=${report.dry_run}`,
  );
  return lines.join("\n");
}

export function writeBoardRunReport(report: BoardRunReport, cwd = process.cwd()): string {
  const dir = join(cwd, "artifacts", "real-pipeline");
  mkdirSync(dir, { recursive: true });
  const path = join(dir, "board-run-report.json");
  writeFileSync(path, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  return path;
}
