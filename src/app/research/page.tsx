import Link from "next/link";
import { pingDatabase } from "@/db/ping";
import { IMPLEMENTED_PROVIDER_IDS } from "@/domain/alignment-ids";
import { collectDatabaseAlignmentIssues } from "@/domain/alignment";
import {
  FEATURE_REGISTRY,
  listForbiddenFeatures,
} from "@/domain/features/registry";
import { listMarkets, listMarketsByReadiness } from "@/domain/markets/catalog";
import { listSports } from "@/domain/sports/catalog";
import { bootstrapImplementedProviders } from "@/ingest/bootstrap";
import {
  countFootballDataCoUkSnapshots,
  countMarketSnapshots,
} from "@/ingest/odds-query";
import { countHistoricalTruthTables } from "@/ingest/historical-truth";
import { getLastIngestionRun, listRegisteredDataSources } from "@/ingest/status";
import { resetRegistry } from "@/ingest/registry";
import { getHistoricalEvaluationLabStatus } from "@/domain/eval/lab-status";
import { getRealTruthLabStatus } from "@/domain/eval/real-lab/status";
import { getMultiMarketPlatformStatus } from "@/domain/eval/platform-status";
import { getAcquisition012Status } from "@/domain/eval/acquisition-status";
import { getBlindMarketLabStatus } from "@/domain/eval/blind-market-lab-status";
import { getActuarialBankrollLabStatus } from "@/domain/eval/bankroll/status";
import { runSourceIntelligenceReport } from "@/domain/sources/intelligence";

export const dynamic = "force-dynamic";

export default async function StatusPage() {
  let db: "ok" | "error" = "error";
  let detail: string | null = null;
  let lastRun: Awaited<ReturnType<typeof getLastIngestionRun>> | null = null;
  let sources: Awaited<ReturnType<typeof listRegisteredDataSources>> = [];
  let alignment: string[] = [];
  let historicalOdds: "READY" | "NOT CONFIGURED" = "NOT CONFIGURED";
  let snapshotCount = 0;
  let footballHistorical: "READY" | "NOT CONFIGURED" | "BLOCKED" =
    "NOT CONFIGURED";
  let footballSnapshots = 0;
  let historicalOutcomes: "READY" | "NOT READY" = "NOT READY";
  let eloSnapshotsStatus: "READY" | "NOT READY" = "NOT READY";
  let featureStore: "READY" | "NOT READY" = "NOT READY";
  let truthCounts = {
    eventOutcomes: 0,
    eloSnapshots: 0,
    featureObservations: 0,
  };

  const labStatus = getHistoricalEvaluationLabStatus();
  const realLab = getRealTruthLabStatus();
  const platform = getMultiMarketPlatformStatus();
  const acq = getAcquisition012Status();
  const lab013 = getBlindMarketLabStatus();
  const lab016 = getActuarialBankrollLabStatus();
  const intel = runSourceIntelligenceReport();

  try {
    await pingDatabase();
    db = "ok";
    resetRegistry();
    bootstrapImplementedProviders();
    lastRun = await getLastIngestionRun();
    sources = await listRegisteredDataSources();
    alignment = (await collectDatabaseAlignmentIssues()).map(
      (issue) => issue.message,
    );
    snapshotCount = await countMarketSnapshots();
    historicalOdds = snapshotCount > 0 ? "READY" : "NOT CONFIGURED";
    footballSnapshots = await countFootballDataCoUkSnapshots();
    const hasFdSource = sources.some((s) => s.slug === "football-data-co-uk");
    if (footballSnapshots > 0) {
      footballHistorical = "READY";
    } else if (hasFdSource) {
      footballHistorical = "BLOCKED";
    } else {
      footballHistorical = "NOT CONFIGURED";
    }
    truthCounts = await countHistoricalTruthTables();
    historicalOutcomes =
      truthCounts.eventOutcomes > 0 ? "READY" : "NOT READY";
    eloSnapshotsStatus =
      truthCounts.eloSnapshots > 0 ? "READY" : "NOT READY";
    featureStore =
      truthCounts.featureObservations > 0 ? "READY" : "NOT READY";
  } catch (error) {
    detail = error instanceof Error ? error.message : "unknown database error";
  }

  const ok = db === "ok";
  const lastProvider =
    lastRun?.requestMeta && typeof lastRun.requestMeta.provider === "string"
      ? lastRun.requestMeta.provider
      : "unknown";

  const featureReady = FEATURE_REGISTRY.filter((f) => f.status === "READY").length;
  const featureBlocked = FEATURE_REGISTRY.filter(
    (f) => f.status === "BLOCKED" || f.status === "FORBIDDEN",
  ).length;
  const marketCount = listMarkets().length;
  const modelReadyMarkets = listMarketsByReadiness("MODEL_READY").length;
  const sportCount = listSports().length;
  const forbiddenFeatures = listForbiddenFeatures().length;

  return (
    <main className="mx-auto flex min-h-full w-full max-w-xl flex-col justify-center gap-6 px-6 py-16">
      <p className="text-sm tracking-wide text-zinc-500 uppercase">
        Sports Prediction Engine
      </p>
      <h1 className="text-3xl font-semibold tracking-tight">System status</h1>
      <p className="text-zinc-600 dark:text-zinc-400">
        Research and simulation only. Multi-market intelligence foundation —
        acquisition + MODEL_READY gates (TASK 012). No betting recommendations.
      </p>
      <dl className="grid gap-3 rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
        <div className="flex justify-between gap-4">
          <dt>App</dt>
          <dd className="font-medium">ok</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt>Database</dt>
          <dd className="font-medium">{db}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt>Health</dt>
          <dd className="font-medium">{ok ? "ok" : "degraded"}</dd>
        </div>
      </dl>
      {detail ? (
        <p className="text-sm text-red-700 dark:text-red-400">{detail}</p>
      ) : null}

      <section className="grid gap-2">
        <h2 className="text-lg font-medium">Sports</h2>
        <dl className="grid gap-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt>Catalog</dt>
            <dd>{sportCount}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>Operational focus</dt>
            <dd>football</dd>
          </div>
        </dl>
      </section>

      <section className="grid gap-2">
        <h2 className="text-lg font-medium">Providers</h2>
        <ul className="text-sm text-zinc-600 dark:text-zinc-400">
          {IMPLEMENTED_PROVIDER_IDS.map((id) => (
            <li key={id}>{id}</li>
          ))}
        </ul>
      </section>

      <section className="grid gap-2">
        <h2 className="text-lg font-medium">Historical Odds</h2>
        <dl className="grid gap-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt>Status</dt>
            <dd>{historicalOdds}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>Snapshots</dt>
            <dd>{snapshotCount}</dd>
          </div>
        </dl>
      </section>

      <section className="grid gap-2">
        <h2 className="text-lg font-medium">Market Intelligence</h2>
        <dl className="grid gap-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt>Status</dt>
            <dd>PARTIAL</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>Catalogue markets</dt>
            <dd>{marketCount}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>MODEL_READY</dt>
            <dd>{modelReadyMarkets}</dd>
          </div>
        </dl>
        <p className="text-xs text-zinc-500">
          CATALOG_CAPABILITY ≠ OBSERVED ≠ MODEL_READY. No auto-approval.
        </p>
      </section>

      <section className="grid gap-2">
        <h2 className="text-lg font-medium">Feature Engine</h2>
        <dl className="grid gap-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt>Status</dt>
            <dd>PARTIAL</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>Registry size</dt>
            <dd>{FEATURE_REGISTRY.length}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>READY / BLOCKED+FORBIDDEN</dt>
            <dd>
              {featureReady} / {featureBlocked}
            </dd>
          </div>
        </dl>
      </section>

      <section className="grid gap-2">
        <h2 className="text-lg font-medium">Temporal Integrity</h2>
        <dl className="grid gap-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt>Status</dt>
            <dd>READY</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>Policy</dt>
            <dd>available_at ≤ asOf</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>STRICT_AS_OF</dt>
            <dd>PASS</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>Forbidden features</dt>
            <dd>{forbiddenFeatures}</dd>
          </div>
        </dl>
      </section>

      <section className="grid gap-2">
        <h2 className="text-lg font-medium">Multi-market platform</h2>
        <dl className="grid gap-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt>SPORTS</dt>
            <dd>{platform.sports}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>PROVIDERS</dt>
            <dd>
              {platform.providersImplemented} / {platform.providersCatalogued}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>MARKETS</dt>
            <dd>
              {platform.marketsCatalogued} / {platform.marketsObserved} /{" "}
              {platform.marketsModelReady}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>EVENTS</dt>
            <dd>{platform.events}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>ODDS SNAPSHOTS</dt>
            <dd>{platform.oddsSnapshots}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>BOOKMAKERS</dt>
            <dd>
              {platform.bookmakersVerified} verified / {platform.bookmakers}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>STRICT DATA</dt>
            <dd>{platform.strictData}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>MODEL READY</dt>
            <dd>{platform.modelReady}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>BLIND LAB</dt>
            <dd>{platform.blindLab}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>TOP OPPORTUNITIES</dt>
            <dd>{platform.topOpportunities}</dd>
          </div>
        </dl>
        <p className="text-xs text-zinc-500">
          Catalogued / observed / model-ready.{" "}
          <Link href="/market-intelligence">Market intelligence →</Link>
        </p>
      </section>

      <section className="grid gap-2">
        <h2 className="text-lg font-medium">Acquisition (TASK 012)</h2>
        <dl className="grid gap-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt>football-data.co.uk live</dt>
            <dd>
              {acq.footballDataCoUk}
              {acq.footballDataCoUkReason
                ? ` (${acq.footballDataCoUkReason})`
                : ""}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>Coverage matrix</dt>
            <dd>{acq.coverageMatrix}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>ClubElo asOf</dt>
            <dd>{acq.clubEloAsOf}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>Goal / Poisson baseline</dt>
            <dd>{acq.goalPoissonBaseline}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>MODEL_READY markets</dt>
            <dd>{acq.modelReadyMarkets}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>Experiment 012</dt>
            <dd>{acq.experiment012}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>Risk engine</dt>
            <dd>{acq.riskEngine}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>Bankroll replay</dt>
            <dd>{acq.bankrollReplay}</dd>
          </div>
        </dl>
        <p className="text-xs text-zinc-500">
          MODEL_READY = 0 is a valid scientific result when gates fail. No
          validated edge / real-money staking.{" "}
          <Link href="/market-intelligence">Blind Market Lab →</Link>
        </p>
      </section>

      <section className="grid gap-2">
        <h2 className="text-lg font-medium">Blind Market Lab (TASK 013)</h2>
        <dl className="grid gap-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt>Experiment</dt>
            <dd>{lab013.experiment}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>Live provider</dt>
            <dd>
              {lab013.liveProvider}
              {lab013.liveReason ? ` (${lab013.liveReason})` : ""}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>Acquisition targets (catalogued)</dt>
            <dd>{lab013.acquisitionTargetsCatalogued}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>Champion</dt>
            <dd>{lab013.champion}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>MODEL_READY</dt>
            <dd>{lab013.modelReady}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>real_money</dt>
            <dd>{String(lab013.realMoney)}</dd>
          </div>
        </dl>
      </section>

      <section className="grid gap-2">
        <h2 className="text-lg font-medium">Actuarial Bankroll Lab (TASK 016)</h2>
        <p className="text-xs text-zinc-500">
          Research simulation only. No guaranteed profit language. winner=null.{" "}
          <Link href="/actuarial-lab">TASK 041 Prospective Close →</Link>
        </p>
        <dl className="grid gap-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt>Experiment</dt>
            <dd>{lab016.experiment}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>Dataset</dt>
            <dd>{lab016.dataset}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>Years tested (OK)</dt>
            <dd>{lab016.years_tested.join(", ") || "none"}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>Initial bankroll / year</dt>
            <dd>{lab016.initial_bankroll}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>Policy</dt>
            <dd>{lab016.policy}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>Mean final (risk-capped)</dt>
            <dd>
              {lab016.mean_final_capped != null
                ? lab016.mean_final_capped.toFixed(1)
                : "n/a"}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>Max drawdown (risk-capped)</dt>
            <dd>
              {lab016.max_drawdown_capped != null
                ? `${(lab016.max_drawdown_capped * 100).toFixed(1)}%`
                : "n/a"}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>Risk of ruin (risk-capped)</dt>
            <dd>
              {lab016.risk_of_ruin_capped != null
                ? lab016.risk_of_ruin_capped.toFixed(3)
                : "n/a"}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>winner / real_money</dt>
            <dd>
              {String(lab016.winner)} / {String(lab016.real_money)}
            </dd>
          </div>
        </dl>
        <ul className="text-sm text-zinc-600 dark:text-zinc-400">
          {Object.entries(lab016.comparison).map(([k, v]) => (
            <li key={k}>
              {k}: mean_final=
              {v.mean_final != null ? v.mean_final.toFixed(1) : "n/a"} · maxDD=
              {v.max_drawdown != null
                ? `${(v.max_drawdown * 100).toFixed(1)}%`
                : "n/a"}{" "}
              · p_ruin={v.p_ruin != null ? v.p_ruin.toFixed(3) : "n/a"}
            </li>
          ))}
        </ul>
      </section>

      <section className="grid gap-2">
        <h2 className="text-lg font-medium">Source Intelligence (TASK 014-A)</h2>
        <dl className="grid gap-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt>Registered sources</dt>
            <dd>{intel.registered_sources}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>Upstream clusters</dt>
            <dd>{intel.independence.upstream_clusters}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>Genuinely independent clusters</dt>
            <dd>{intel.independence.genuinely_independent_clusters}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>Next best acquisition</dt>
            <dd className="text-right max-w-[60%]">
              {intel.next_best_acquisition.next_best_acquisition}
            </dd>
          </div>
        </dl>
        <p className="text-xs text-zinc-500">
          Catalog ≠ provider ≠ bookmaker. No invented reliability %. Scraping
          DENY.
        </p>
      </section>

      <section className="grid gap-2">
        <h2 className="text-lg font-medium">Real Truth Lab</h2>
        <dl className="grid gap-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt>Historical Data</dt>
            <dd>{realLab.historicalData}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>Events</dt>
            <dd>{realLab.events}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>Outcomes</dt>
            <dd>{realLab.outcomes}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>Elo</dt>
            <dd>{realLab.elo}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>Markets</dt>
            <dd>{realLab.markets}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>Market Coverage</dt>
            <dd>{realLab.marketCoverage}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>Features</dt>
            <dd>{realLab.features}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>Walk-forward</dt>
            <dd>{realLab.walkForward}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>Holdout</dt>
            <dd>{realLab.holdout}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>Data Quality</dt>
            <dd>{realLab.dataQuality}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>Blind Replay</dt>
            <dd>{realLab.blindReplay}</dd>
          </div>
        </dl>
        <p className="text-xs text-zinc-500">
          Offline football pack 2019–2024. Quotes={realLab.quotes}, books=
          {realLab.bookmakers}. MODEL_READY={realLab.modelReadyMarkets}. No
          bets.
        </p>
      </section>

      <section className="grid gap-2">
        <h2 className="text-lg font-medium">Historical Evaluation</h2>
        <dl className="grid gap-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt>Historical Evaluation</dt>
            <dd>{labStatus.historicalEvaluation}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>Blind Replay</dt>
            <dd>{labStatus.blindReplay}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>Walk Forward</dt>
            <dd>{labStatus.walkForward}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>Calibration</dt>
            <dd>{labStatus.calibration}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>Holdout</dt>
            <dd>{labStatus.holdout}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>Market Baseline</dt>
            <dd>{labStatus.marketBaseline}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>MODEL_READY markets</dt>
            <dd>{labStatus.modelReadyMarkets}</dd>
          </div>
        </dl>
        <p className="text-xs text-zinc-500">
          Lab measures calibration vs market — no profit, ROI, or bets.
        </p>
      </section>

      <section className="grid gap-2">
        <h2 className="text-lg font-medium">Historical Truth Layer</h2>
        <dl className="grid gap-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt>Historical Outcomes</dt>
            <dd>
              {historicalOutcomes} ({truthCounts.eventOutcomes})
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>Elo Snapshots</dt>
            <dd>
              {eloSnapshotsStatus} ({truthCounts.eloSnapshots})
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>Feature Store</dt>
            <dd>
              {featureStore} ({truthCounts.featureObservations})
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>Blind Replay</dt>
            <dd>READY</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>MODEL_READY markets</dt>
            <dd>{modelReadyMarkets}</dd>
          </div>
        </dl>
        <p className="text-xs text-zinc-500">
          Blind replay reconstructs DecisionContext without future outcomes.
          MODEL_READY stays at zero until markets pass temporal validation.
        </p>
      </section>

      <section className="grid gap-2">
        <h2 className="text-lg font-medium">Data Quality</h2>
        <dl className="grid gap-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt>Status</dt>
            <dd>PARTIAL</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>Gates</dt>
            <dd>VALID / WARNING / REJECTED</dd>
          </div>
        </dl>
      </section>

      <section className="grid gap-2">
        <h2 className="text-lg font-medium">Football Historical Market</h2>
        <dl className="grid gap-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt>Status</dt>
            <dd>{footballHistorical}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>Dataset</dt>
            <dd>football-data.co.uk</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>Snapshots</dt>
            <dd>{footballSnapshots}</dd>
          </div>
        </dl>
        <p className="text-xs text-zinc-500">
          Live CSV import stays BLOCKED while the source returns HTTP 503.
          Dataset open/close rows use calendar-date anchors only
          (temporal_precision=unknown).
        </p>
      </section>

      <section className="grid gap-2">
        <h2 className="text-lg font-medium">Registered data sources</h2>
        <ul className="text-sm text-zinc-600 dark:text-zinc-400">
          {sources.length === 0 ? (
            <li>None seeded yet. Run `pnpm ingest:mock`.</li>
          ) : (
            sources.map((source) => (
              <li key={source.id}>
                {source.slug} — {source.name}
              </li>
            ))
          )}
        </ul>
      </section>

      <section className="grid gap-2">
        <h2 className="text-lg font-medium">Last ingestion</h2>
        {lastRun ? (
          <dl className="grid gap-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt>Provider</dt>
              <dd>{lastProvider}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>Status</dt>
              <dd>{lastRun.status}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>Received / stored / rejected</dt>
              <dd>
                {lastRun.recordsReceived} / {lastRun.recordsStored} /{" "}
                {lastRun.recordsRejected}
              </dd>
            </div>
            {lastRun.errorMessage ? (
              <div className="flex justify-between gap-4">
                <dt>Error</dt>
                <dd className="text-red-700 dark:text-red-400">
                  {lastRun.errorMessage}
                </dd>
              </div>
            ) : null}
          </dl>
        ) : (
          <p className="text-sm text-zinc-500">No runs yet.</p>
        )}
      </section>

      {alignment.length > 0 ? (
        <section className="grid gap-2">
          <h2 className="text-lg font-medium">Alignment</h2>
          <ul className="text-sm text-red-700 dark:text-red-400">
            {alignment.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <p className="text-sm text-zinc-500">
        JSON: <a href="/api/health">/api/health</a>
      </p>
    </main>
  );
}
