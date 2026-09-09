import Link from "next/link";
import {
  getBlindMarketLabReport,
  getBlindMarketLabStatus,
} from "@/domain/eval/blind-market-lab-status";
import { FOOTBALL_ACQUISITION_MARKET_CATALOG } from "@/domain/markets/acquisition-catalog";
import { listVerifiedBookmakers } from "@/domain/markets/bookmaker-registry";

export const dynamic = "force-dynamic";

export default function MarketIntelligencePage() {
  const light = getBlindMarketLabStatus();
  const lab = getBlindMarketLabReport();
  const books = listVerifiedBookmakers();

  return (
    <main className="mx-auto flex min-h-full w-full max-w-2xl flex-col gap-8 px-6 py-16">
      <p className="text-sm tracking-wide text-zinc-500 uppercase">
        Market Intelligence Lab
      </p>
      <h1 className="text-3xl font-semibold tracking-tight">
        Blind Market Lab V1
      </h1>
      <p className="text-zinc-600 dark:text-zinc-400">
        Research only. Catalog ≠ observed ≠ MODEL_READY. Live football-data.co.uk:{" "}
        {light.liveProvider}
        {light.liveReason ? ` (${light.liveReason})` : ""}. No bet recommendations.
      </p>

      {lab.insufficient_data ? (
        <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100">
          INSUFFICIENT DATA — temporal precision / sample gates block MODEL_READY.
        </p>
      ) : null}

      <section className="grid gap-2">
        <h2 className="text-lg font-medium">Dataset</h2>
        <dl className="grid gap-1 text-sm">
          <div className="flex justify-between gap-4">
            <dt>Events</dt>
            <dd>{lab.data.events}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>Quotes</dt>
            <dd>{lab.data.quotes}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>Sources</dt>
            <dd>{lab.data.sources}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>RAW / NORMALIZED / TEMPORALLY_VALID / MODEL_READY</dt>
            <dd>
              {lab.data.raw} / {lab.data.normalized} / {lab.data.temporally_valid}{" "}
              / {lab.data.model_ready}
            </dd>
          </div>
        </dl>
      </section>

      <section className="grid gap-2">
        <h2 className="text-lg font-medium">Temporal coverage</h2>
        <dl className="grid gap-1 text-sm">
          <div className="flex justify-between gap-4">
            <dt>exact / dataset_window / unknown / blocked</dt>
            <dd>
              {lab.temporal.exact} / {lab.temporal.dataset_window} /{" "}
              {lab.temporal.unknown} / {lab.temporal.blocked}
            </dd>
          </div>
        </dl>
      </section>

      <section className="grid gap-2">
        <h2 className="text-lg font-medium">Markets</h2>
        <p className="text-sm text-zinc-500">
          Catalogued {lab.markets.catalogued} · Observed {lab.markets.observed} ·
          Validated {lab.markets.validated} · MODEL_READY {lab.markets.model_ready}
        </p>
        <ul className="max-h-48 overflow-auto text-sm text-zinc-600 dark:text-zinc-400">
          {FOOTBALL_ACQUISITION_MARKET_CATALOG.map((m) => {
            const observed = lab.data.markets_observed > 0 &&
              (m.market_type === "result" || m.market_type === "total_goals");
            return (
              <li key={m.market_type}>
                {m.market_type} — {observed ? "OBSERVED" : m.status}
                {m.family === "corners" || m.family === "cards" || m.family === "player"
                  ? " (capability placeholder)"
                  : ""}
              </li>
            );
          })}
        </ul>
      </section>

      <section className="grid gap-2">
        <h2 className="text-lg font-medium">Bookmakers / Sources</h2>
        <p className="text-sm">
          Verified in registry: {books.map((b) => b.slug).join(", ") || "none"}
        </p>
        <p className="text-sm text-zinc-500">
          Pack verified: {lab.data.bookmakers_verified} / catalogued{" "}
          {lab.data.bookmakers_catalogued}
        </p>
      </section>

      <section className="grid gap-2">
        <h2 className="text-lg font-medium">Model Lab</h2>
        <dl className="grid gap-1 text-sm">
          <div className="flex justify-between gap-4">
            <dt>Champion</dt>
            <dd>{lab.models.champion}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>Challengers</dt>
            <dd>{lab.models.challengers.length} (no auto-promote)</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>TEST Brier / LogLoss / Calib</dt>
            <dd>
              {lab.test.brier?.toFixed(4) ?? "n/a"} /{" "}
              {lab.test.logloss?.toFixed(4) ?? "n/a"} /{" "}
              {lab.test.calibration?.toFixed(4) ?? "n/a"}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>HOLDOUT Brier / LogLoss / Calib</dt>
            <dd>
              {lab.holdout.brier?.toFixed(4) ?? "n/a"} /{" "}
              {lab.holdout.logloss?.toFixed(4) ?? "n/a"} /{" "}
              {lab.holdout.calibration?.toFixed(4) ?? "n/a"}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>Multiple testing</dt>
            <dd>
              hyp={lab.multipleTesting.hypotheses} raw_sig=
              {lab.multipleTesting.significant_raw} adj_sig=
              {lab.multipleTesting.significant_adjusted}
            </dd>
          </div>
        </dl>
      </section>

      <section className="grid gap-2">
        <h2 className="text-lg font-medium">Data quality</h2>
        <p className="text-sm">
          Level: {lab.dataQuality.quality_level} · score:{" "}
          {lab.dataQuality.quality_score?.toFixed(3) ?? "null"}
        </p>
        {lab.dataQuality.blocking_reasons.length > 0 ? (
          <ul className="text-sm text-zinc-600 dark:text-zinc-400">
            {lab.dataQuality.blocking_reasons.map((r) => (
              <li key={r}>blocked: {r}</li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className="grid gap-2">
        <h2 className="text-lg font-medium">Top 10</h2>
        <p className="text-sm">
          qualified={lab.top10.qualified} · insufficient=
          {lab.top10.blocked} · {lab.top10.message}
        </p>
      </section>

      <section className="grid gap-2">
        <h2 className="text-lg font-medium">Risk (simulation)</h2>
        <p className="text-sm">
          Flat / Fractional Kelly / Risk-capped READY · Masaniello challenger ·
          real_money={String(lab.risk.real_money)} · correlation max exposure=
          {lab.risk.correlation_max_exposure}
        </p>
      </section>

      <section className="grid gap-2">
        <h2 className="text-lg font-medium">Errors</h2>
        <ul className="text-sm text-zinc-600 dark:text-zinc-400">
          {lab.errors.top_error_classes.map((e) => (
            <li key={e.class}>
              {e.class}: {e.count}
            </li>
          ))}
        </ul>
      </section>

      <p className="text-sm text-zinc-500">
        <Link href="/">← System status</Link>
      </p>
    </main>
  );
}
