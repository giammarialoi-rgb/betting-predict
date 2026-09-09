"use client";

import {
  Card,
  EmptyState,
  Pill,
  SnapshotBadge,
  StatusDot,
  asRecord,
  fmtWhen,
  normalizeState,
  type BmState,
} from "@/components/betmind/ui";
import { useBetMindData } from "@/components/betmind/DataProvider";

function sourceState(status: string | undefined): BmState {
  const s = String(status ?? "UNKNOWN").toUpperCase();
  if (["ACTIVE", "ACTIVE_ASOF", "ONLINE", "OK"].includes(s)) return "ONLINE";
  if (["FOUNDATION", "TEMPORALLY_CAUTIOUS", "PLAN_LIMITED", "RESEARCH_TEST", "CANDIDATE"].includes(s))
    return "DEGRADED";
  if (["UNAVAILABLE", "DISABLED_BY_POLICY", "OFFLINE", "DISABLED"].includes(s)) return "OFFLINE";
  return "UNKNOWN";
}

const PRIORITY_IDS = [
  "api-sports",
  "the-odds-api",
  "clubelo",
  "football-data-co-uk",
  "open-meteo",
] as const;

export default function SourcesPage() {
  const { sources, coverage, updating, lastUpdate, error } = useBetMindData();
  const list = sources?.sources ?? [];
  const byId = new Map(list.map((s) => [s.id, s]));

  const ordered = [
    ...PRIORITY_IDS.map((id) => byId.get(id)).filter(Boolean),
    ...list.filter((s) => !(PRIORITY_IDS as readonly string[]).includes(s.id)),
  ];

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="bm-section-label">Data</div>
          <h1 className="mt-1 text-2xl font-bold">Sources</h1>
          <p className="mt-1 text-sm bm-muted">
            Honest registry — no invented coverage or last-update clocks.
          </p>
        </div>
        <SnapshotBadge updating={updating} />
      </div>

      {error && (
        <Card>
          <p className="text-sm text-[var(--bm-danger)]">{error}</p>
        </Card>
      )}

      <Card title="Registry metadata">
        <div className="flex flex-wrap gap-2 text-xs">
          <Pill>Payload {String(sources?.source ?? "—")}</Pill>
          <Pill>Updated {fmtWhen(sources?.at ?? lastUpdate)}</Pill>
          <Pill tone={sources?.scrape_enters_model ? "danger" : "accent"}>
            scrape→model {String(sources?.scrape_enters_model ?? false)}
          </Pill>
          <Pill>TEST_SCRAPE {String(sources?.test_scrape_enabled ?? false)}</Pill>
        </div>
        {sources?.note && <p className="mt-3 text-sm bm-muted">{sources.note}</p>}
        {coverage?.note && <p className="mt-2 text-sm bm-muted">{coverage.note}</p>}
        <div className="mt-3 flex flex-wrap gap-2">
          <Pill>
            DATA_COVERAGE{" "}
            {coverage?.DATA_COVERAGE != null ? String(coverage.DATA_COVERAGE) : "—"}
          </Pill>
          <Pill>SOURCE_COUNT {coverage?.SOURCE_COUNT != null ? String(coverage.SOURCE_COUNT) : "—"}</Pill>
        </div>
      </Card>

      {!ordered.length ? (
        <EmptyState
          title="NO SOURCE REGISTRY"
          reason="data-sources API returned no sources array."
        />
      ) : (
        <div className="grid gap-3">
          {ordered.map((s) => {
            if (!s) return null;
            const st = sourceState(s.status);
            const fallback =
              sources?.source === "memory"
                ? "In-memory registry (Lab B JSON absent)"
                : s.status === "UNAVAILABLE" || s.status === "DISABLED_BY_POLICY"
                  ? "Unavailable / policy disabled"
                  : null;
            return (
              <Card key={s.id}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="text-base font-semibold">{s.title ?? s.id}</h2>
                    <p className="text-xs bm-muted">{s.id}</p>
                  </div>
                  <span className="bm-pill inline-flex items-center gap-1.5">
                    <StatusDot state={st} />
                    {String(s.status ?? "UNKNOWN")}
                  </span>
                </div>
                <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="bm-metric-label">Role</dt>
                    <dd>{s.role ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="bm-metric-label">Temporal</dt>
                    <dd>{s.temporal_precision ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="bm-metric-label">Enters independent model</dt>
                    <dd>{String(s.enters_independent_model ?? false)}</dd>
                  </div>
                  <div>
                    <dt className="bm-metric-label">Last update</dt>
                    <dd>—</dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="bm-metric-label">Reason / coverage note</dt>
                    <dd className="bm-muted">{s.reason ?? "—"}</dd>
                  </div>
                  {fallback && (
                    <div className="sm:col-span-2">
                      <dt className="bm-metric-label">Fallback</dt>
                      <dd>{fallback}</dd>
                    </div>
                  )}
                </dl>
              </Card>
            );
          })}
        </div>
      )}

      {(coverage?.FEATURES_STUB?.length || coverage?.FEATURES_MISSING?.length) && (
        <Card title="Feature readiness (manifest)">
          <div className="space-y-2 text-sm">
            {!!coverage?.FEATURES_ACTIVE?.length && (
              <p>
                <span className="bm-muted">ACTIVE: </span>
                {coverage.FEATURES_ACTIVE.join(", ")}
              </p>
            )}
            {!!coverage?.FEATURES_STUB?.length && (
              <p>
                <span className="bm-muted">STUB: </span>
                {coverage.FEATURES_STUB.join(", ")}
              </p>
            )}
            {!!coverage?.FEATURES_MISSING?.length && (
              <p>
                <span className="bm-muted">MISSING: </span>
                {coverage.FEATURES_MISSING.join(", ")}
              </p>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}

// silence unused if tree-shaken oddly
void asRecord;
void normalizeState;
