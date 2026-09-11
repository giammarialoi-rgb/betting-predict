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
  const operational = (sources?.operational ?? []).map((s) => ({
    ...s,
    id: s.id ?? (s as { source_id?: string }).source_id,
    title: s.title ?? (s as { name?: string }).name,
  }));
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
                    <dt className="bm-metric-label">Last attempt</dt>
                    <dd>{fmtWhen(s.last_attempt ?? null)}</dd>
                  </div>
                  <div>
                    <dt className="bm-metric-label">Last success</dt>
                    <dd>{fmtWhen(s.last_success ?? null)}</dd>
                  </div>
                  <div>
                    <dt className="bm-metric-label">Last failure</dt>
                    <dd>{fmtWhen(s.last_failure ?? null)}</dd>
                  </div>
                  <div>
                    <dt className="bm-metric-label">Ultimo evento reperito</dt>
                    <dd>{s.last_event_label ?? "nessun evento reperito"}</dd>
                  </div>
                  <div>
                    <dt className="bm-metric-label">Blocked / NO_EVENT</dt>
                    <dd>
                      {s.blocked_count ?? 0} / {s.no_event_count ?? 0}
                    </dd>
                  </div>
                  <div>
                    <dt className="bm-metric-label">Capabilities</dt>
                    <dd className="bm-muted">{(s.capabilities ?? []).join(", ") || "—"}</dd>
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

      {!!operational.length && (
        <Card title="Rendimento event-level">
          <p className="mb-3 text-xs bm-muted">
            Una fonte e ACTIVE solo se ha restituito dati associati a un evento. HTTP 200 sulla homepage non conta.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bm-muted text-xs">
                  <th className="py-1 pr-3">Fonte</th>
                  <th className="py-1 pr-3">Stato</th>
                  <th className="py-1 pr-3">Eventi</th>
                  <th className="py-1 pr-3">Osservazioni</th>
                  <th className="py-1">Ultimo errore / nota</th>
                </tr>
              </thead>
              <tbody>
                {operational.map((s) => (
                  <tr key={String(s.id)} className="border-t border-[rgba(255,255,255,0.06)]">
                    <td className="py-2 pr-3 font-medium">{s.title ?? s.id}</td>
                    <td className="py-2 pr-3">{String(s.status ?? "IDLE")}</td>
                    <td className="py-2 pr-3">{s.events_found ?? 0}</td>
                    <td className="py-2 pr-3">{s.observations_found ?? 0}</td>
                    <td className="py-2 text-xs bm-muted">
                      {s.last_event_label ?? (s.blocked_count ? `${s.blocked_count} blocked` : "—")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
      {(coverage?.FEATURES_STUB?.length || coverage?.FEATURES_MISSING?.length || coverage?.FEATURES_ACTIVE?.length) && (
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
