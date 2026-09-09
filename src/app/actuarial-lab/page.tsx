import Link from "next/link";
import { loadOrRunTask032 } from "@/domain/eval/incremental-032/lab";
import { loadOrRunTask033 } from "@/domain/eval/market-033/lab";
import { loadOrRunTask034 } from "@/domain/eval/market-034/lab";
import { loadOrRunTask035 } from "@/domain/eval/breakthrough-035/lab";
import { loadOrRunTask036 } from "@/domain/eval/prospective-036/lab";
import { loadOrRunTask037 } from "@/domain/eval/harvest-037/lab";
import { loadOrRunTask038 } from "@/domain/eval/datalake-038/lab";
import { loadOrRunTask039 } from "@/domain/eval/live-039/lab";
import { loadOrRunTask041 } from "@/domain/eval/close-041/lab";

export const dynamic = "force-dynamic";

function num(v: number | null | undefined): string {
  return v == null ? "—" : v.toFixed(6);
}

function flag(v: boolean | string | null | undefined): string {
  if (v == null) return "—";
  return String(v);
}

export default async function ActuarialLabPage() {
  const [close041, live039, live038, lake037, report, hist035, prev034, prev033, prev032] = await Promise.all([
    loadOrRunTask041(),
    loadOrRunTask039(),
    loadOrRunTask038(),
    loadOrRunTask037(),
    loadOrRunTask036(),
    loadOrRunTask035(),
    loadOrRunTask034(),
    loadOrRunTask033(),
    loadOrRunTask032(),
  ]);

  return (
    <main className="mx-auto flex min-h-full w-full max-w-6xl flex-col gap-8 px-6 py-16">
      <p className="text-sm tracking-wide text-zinc-500 uppercase">
        <Link href="/">← Status</Link>
      </p>
      <h1 className="text-3xl font-semibold tracking-tight">TASK 041 — DEFINITIVE PROSPECTIVE CLOSE</h1>
      <p className="text-zinc-600 dark:text-zinc-400">
        Store 039/040 · MARKET_DEVIG frozen · settled target 100 · winner = null · real_money = false · no TASK 042 science changes
      </p>
      <p className="text-sm">
        <Link href="/actuarial-lab/collector" className="underline">
          Live collector monitor (TASK 042) →
        </Link>
        {" · "}
        <Link href="/actuarial-lab/live" className="underline">
          Total live lab (TASK 043) →
        </Link>
      </p>

      <section className="grid gap-2 text-sm">
        <h2 className="text-lg font-medium">PROSPECTIVE CLOSE LAB</h2>
        <p className="text-lg font-medium">{close041.FINAL_VERDICT}</p>
        <dl className="grid gap-1">
          <div className="flex justify-between gap-4">
            <dt>COLLECTION_STATUS</dt>
            <dd>{close041.COLLECTION_STATUS}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>SOURCE_STATUS</dt>
            <dd>{close041.SOURCE_STATUS}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>API key</dt>
            <dd>{close041.API_KEY_CONFIGURED ? "configured" : "missing"}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>EVENTS / STRICT</dt>
            <dd>
              {close041.EVENTS_DISCOVERED} / {close041.STRICT_EVENTS}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>LOCKED / SETTLED / MISSING</dt>
            <dd>
              {close041.LOCKED_DECISIONS} / {close041.SETTLED_EVENTS} / {close041.MISSING_TO_100}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>T−72h / T−24h / T−1h / T−5m</dt>
            <dd>
              {close041.T72_COVERAGE} / {close041.T24_COVERAGE} / {close041.T1H_COVERAGE} / {close041.T5M_COVERAGE}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>TRAIN / VAL / TEST / HOLDOUT</dt>
            <dd>
              {close041.TRAIN_EVENTS} / {close041.VAL_EVENTS} / {close041.TEST_EVENTS} / {close041.HOLDOUT_EVENTS}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>MARKET BRIER / LOGLOSS</dt>
            <dd>
              {num(close041.MARKET_BRIER)} / {num(close041.MARKET_LOGLOSS)}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>BEST MODEL / ΔBRIER / SIGNIFICANT</dt>
            <dd>
              {close041.BEST_MODEL ?? "—"} / {num(close041.DELTA_BRIER)} / {flag(close041.SIGNIFICANT)}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>CAPITAL / BETS / BANKROLL</dt>
            <dd>
              CLOSED / {close041.BETS} / {close041.BANKROLL}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>WINNER / AUTO_PROMO / REAL_MONEY</dt>
            <dd>
              {flag(close041.winner)} / {flag(close041.auto_promotion)} / {flag(close041.REAL_MONEY)}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>VERDICT</dt>
            <dd>{close041.FINAL_VERDICT}</dd>
          </div>
        </dl>
        <p className="text-zinc-600 dark:text-zinc-400">{close041.interpretation}</p>
        <p className="text-zinc-600 dark:text-zinc-400">{close041.residual_blocker}</p>
      </section>

      <h2 className="text-2xl font-semibold tracking-tight">TASK 039 — PROSPECTIVE LIVE PIPELINE</h2>
      <p className="text-zinc-600 dark:text-zinc-400">
        Last-mile collector · MARKET_DEVIG frozen · historical sections below unchanged
      </p>

      <section className="grid gap-2 text-sm">
        <h2 className="text-lg font-medium">PROSPECTIVE LIVE LAB</h2>
        <p className="text-lg font-medium">{live039.FINAL_VERDICT}</p>
        <dl className="grid gap-1">
          <div className="flex justify-between gap-4">
            <dt>COLLECTION_STATUS</dt>
            <dd>{live039.COLLECTION_STATUS}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>SOURCE_STATUS</dt>
            <dd>{live039.SOURCE_STATUS}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>API key</dt>
            <dd>{live039.API_KEY_CONFIGURED ? "configured" : "missing"}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>LAST POLL</dt>
            <dd>{live039.health.last_poll ?? "—"}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>EVENTS</dt>
            <dd>{live039.EVENTS_DISCOVERED}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>QUOTES</dt>
            <dd>{live039.QUOTE_OBSERVATIONS}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>STRICT EVENTS</dt>
            <dd>{live039.STRICT_EVENTS}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>T−72h / T−24h / T−1h / T−5m</dt>
            <dd>
              {live039.T72_COVERAGE} / {live039.T24_COVERAGE} / {live039.T1H_COVERAGE} / {live039.T5M_COVERAGE}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>MATCH_EXACT</dt>
            <dd>{live039.MATCH_EXACT}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>LOCKED / SETTLED</dt>
            <dd>
              {live039.LOCKED_DECISIONS} / {live039.SETTLED_EVENTS}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>MODEL READY</dt>
            <dd>{flag(live039.MODEL_READY)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>HOLDOUT</dt>
            <dd>{live039.HOLDOUT_EVENTS}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>CAPITAL GATE</dt>
            <dd>CLOSED</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>BETS / BANKROLL</dt>
            <dd>
              {live039.BETS} / {live039.BANKROLL}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>VERDICT</dt>
            <dd>{live039.FINAL_VERDICT}</dd>
          </div>
        </dl>
        <p className="text-zinc-600 dark:text-zinc-400">{live039.residual_blocker}</p>
      </section>

      <h2 className="text-2xl font-semibold tracking-tight">TASK 038 — DATA LAKE</h2>
      <p className="text-zinc-600 dark:text-zinc-400">Permanent lake. RESEARCH_ONLY vs CAPITAL_STRICT isolation unchanged.</p>

      <section className="grid gap-2 text-sm">
        <h2 className="text-lg font-medium">DATA LAKE STATUS</h2>
        <p className="text-lg font-medium">{live038.FINAL_VERDICT}</p>
        <dl className="grid gap-1">
          <div className="flex justify-between gap-4">
            <dt>LIVE STATUS</dt>
            <dd>{live038.COLLECTION_STATUS}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>SOURCE</dt>
            <dd>{live038.LIVE_SOURCE}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>API key</dt>
            <dd>{live038.API_KEY}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>LAST POLL</dt>
            <dd>{live038.health.lastSuccessfulPoll ?? "—"}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>EVENTS</dt>
            <dd>{live038.health.eventsDiscovered}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>QUOTES</dt>
            <dd>{live038.health.quotesObserved}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>STRICT EVENTS</dt>
            <dd>{live038.STRICT_EVENTS}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>T−72h</dt>
            <dd>{live038.T72_COVERAGE}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>T−24h</dt>
            <dd>{live038.T24_COVERAGE}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>T−1h</dt>
            <dd>{live038.T1H_COVERAGE}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>T−5m</dt>
            <dd>{live038.T5M_COVERAGE}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>MATCH_EXACT</dt>
            <dd>{live038.MATCH_EXACT}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>MODEL READY</dt>
            <dd>{flag(live038.MODEL_READY)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>HOLDOUT</dt>
            <dd>{live038.HOLDOUT_EVENTS}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>CAPITAL GATE</dt>
            <dd>{live038.CAPITAL}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>BETS / BANKROLL</dt>
            <dd>
              {live038.BETS} / {live038.BANKROLL}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>VERDICT</dt>
            <dd>{live038.FINAL_VERDICT}</dd>
          </div>
        </dl>
        <p className="text-zinc-600 dark:text-zinc-400">{live038.residual_blocker}</p>
      </section>

      <h2 className="text-2xl font-semibold tracking-tight">HISTORICAL LAB</h2>
      <p className="text-zinc-600 dark:text-zinc-400">
        Frozen 031–037 corpus. RESEARCH_ONLY except TASK_031_BASE reference. Not a live clock.
      </p>

      <section className="grid gap-2 text-sm">
        <h2 className="text-lg font-medium">DATA LAKE (RESEARCH_ONLY)</h2>
        <p className="text-lg font-medium">{lake037.FINAL_VERDICT}</p>
        <dl className="grid gap-1">
          <div className="flex justify-between gap-4">
            <dt>Source clusters</dt>
            <dd>{lake037.SOURCE_CLUSTERS}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>Repositories</dt>
            <dd>{lake037.GITHUB_REPOSITORIES_SCANNED}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>Datasets</dt>
            <dd>{lake037.DATASETS_ACQUIRED}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>STRICT</dt>
            <dd>{lake037.STRICT_EVENTS}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>RESEARCH</dt>
            <dd>{lake037.lake.research_events}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>DATE_ONLY</dt>
            <dd>{lake037.lake.date_only_events}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>POSTMATCH / parsers</dt>
            <dd>{lake037.lake.parser_only}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>STRICT events</dt>
            <dd>{lake037.STRICT_EVENTS}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>STRICT quotes</dt>
            <dd>{lake037.STRICT_QUOTES}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>Exact kickoffs</dt>
            <dd>{lake037.EXACT_KICKOFFS}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>T−24 coverage</dt>
            <dd>{lake037.T24_COVERAGE}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>T−1h coverage</dt>
            <dd>{lake037.T1H_COVERAGE}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>MODEL READY</dt>
            <dd>{flag(lake037.MODEL_READY)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>TRAIN / VAL / TEST / HOLDOUT</dt>
            <dd>
              {lake037.TRAIN_EVENTS} / {lake037.VAL_EVENTS} / {lake037.TEST_EVENTS} / {lake037.HOLDOUT_EVENTS}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>Market Brier</dt>
            <dd>{num(lake037.MARKET_BRIER)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>Best model</dt>
            <dd>{lake037.BEST_MODEL ?? "—"}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>Delta Brier</dt>
            <dd>{num(lake037.DELTA_BRIER)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>Holm</dt>
            <dd>{lake037.HOLM ?? "—"}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>Capital qualified</dt>
            <dd>{flag(lake037.CAPITAL_QUALIFIED)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>Bets</dt>
            <dd>{lake037.BETS}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>BANKROLL</dt>
            <dd>{lake037.BANKROLL}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>Winner</dt>
            <dd>{lake037.winner ?? "null"}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>Final verdict</dt>
            <dd>{lake037.FINAL_VERDICT}</dd>
          </div>
        </dl>
        <p className="text-zinc-600 dark:text-zinc-400">{lake037.missing_resource}</p>
      </section>

      <h2 className="text-2xl font-semibold tracking-tight">TASK 036 — PROSPECTIVE STRICT LAB</h2>
      <p className="text-zinc-600 dark:text-zinc-400">
        Live observation clock · MARKET_DEVIG benchmark · cold start OBSERVATION_ONLY · winner = null ·
        real_money = false · capital closed
      </p>

      <section className="grid gap-2 text-sm">
        <h2 className="text-lg font-medium">PROSPECTIVE DATA</h2>
        <p className="text-lg font-medium">{report.FINAL_VERDICT}</p>
        <dl className="grid gap-1">
          <div className="flex justify-between gap-4">
            <dt>Collection status</dt>
            <dd>{report.COLLECTION_STATUS}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>Source</dt>
            <dd>{report.SOURCE}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>Source status</dt>
            <dd>{report.SOURCE_STATUS}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>Events observed</dt>
            <dd>{report.EVENTS_DISCOVERED}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>Strict events</dt>
            <dd>{report.STRICT_EVENTS}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>Markets</dt>
            <dd>{report.markets.length ? report.markets.join(", ") : "—"}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>Bookmakers</dt>
            <dd>{report.bookmakers.length ? report.bookmakers.join(", ") : "—"}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>Quote observations</dt>
            <dd>{report.QUOTE_OBSERVATIONS}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>T−72h coverage</dt>
            <dd>{report.T72_COVERAGE}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>T−24h coverage</dt>
            <dd>{report.T24_COVERAGE}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>T−1h coverage</dt>
            <dd>{report.T1H_COVERAGE}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>T−5m coverage</dt>
            <dd>{report.T5M_COVERAGE}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>Locked decisions</dt>
            <dd>{report.LOCKED_DECISIONS}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>Settled events</dt>
            <dd>{report.SETTLED_EVENTS}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>Test events</dt>
            <dd>{report.TEST_EVENTS}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>Holdout events</dt>
            <dd>{report.HOLDOUT_EVENTS}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>Brier market</dt>
            <dd>{num(report.MARKET_BRIER)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>Brier best model</dt>
            <dd>{num(report.BEST_MODEL_BRIER)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>Delta</dt>
            <dd>{num(report.DELTA_BRIER)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>Significance</dt>
            <dd>{report.SIGNIFICANCE ?? "—"}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>Bets</dt>
            <dd>{report.BETS}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>Capital gate</dt>
            <dd>{report.CAPITAL_GATE}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>MODEL_READY</dt>
            <dd>{flag(report.MODEL_READY)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>EDGE</dt>
            <dd>{flag(report.EDGE)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>Winner</dt>
            <dd>{report.winner ?? "null"}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>BANKROLL</dt>
            <dd>{report.BANKROLL}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>Real money</dt>
            <dd>{flag(report.real_money)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>Observation only</dt>
            <dd>{flag(report.OBSERVATION_ONLY)}</dd>
          </div>
        </dl>
        {report.blocker ? (
          <p className="text-zinc-600 dark:text-zinc-400">
            Blocker: {report.blocker.source} — {report.blocker.error}. Needs {report.blocker.needs}.{" "}
            {report.blocker.why_not_bypassable}
          </p>
        ) : null}
      </section>

      <section className="grid gap-2 text-sm">
        <h2 className="text-lg font-medium">HISTORICAL DATA</h2>
        <p className="text-zinc-600 dark:text-zinc-400">
          Frozen TASK 031/035 corpus. Not rewritten. Not a prospective clock.
        </p>
        <dl className="grid gap-1">
          <div className="flex justify-between gap-4">
            <dt>Dataset</dt>
            <dd>{report.historical.dataset}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>STRICT events (LEVEL_B)</dt>
            <dd>{report.historical.strict_events}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>HOLDOUT 2020+</dt>
            <dd>{report.historical.holdout_2020}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>TASK 035 verdict</dt>
            <dd>{hist035.FINAL_VERDICT}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>TASK 035 STRICT 2020+</dt>
            <dd>{hist035.strict_2020_plus}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>TASK 035 BETS / BANKROLL</dt>
            <dd>
              {hist035.BETS} / {hist035.BANKROLL}
            </dd>
          </div>
        </dl>
      </section>

      <section className="grid gap-2 text-sm text-zinc-500">
        <h2 className="text-lg font-medium text-zinc-800 dark:text-zinc-200">TASK 034 (frozen)</h2>
        <p>
          {prev034.verdict} · BEST {prev034.best_signal ?? "—"} · QUALIFIED {String(prev034.qualified)}
        </p>
        <h2 className="text-lg font-medium text-zinc-800 dark:text-zinc-200">TASK 033 (frozen)</h2>
        <p>
          {prev033.verdict} · BEST {prev033.best_market ?? "—"} · QUALIFIED {String(prev033.qualified)}
        </p>
        <h2 className="text-lg font-medium text-zinc-800 dark:text-zinc-200">TASK 032 (frozen)</h2>
        <p>
          {prev032.verdict} · VAL {prev032.selected_on_val ?? "none"} · QUALIFIED {String(prev032.qualified)}
        </p>
      </section>
    </main>
  );
}
