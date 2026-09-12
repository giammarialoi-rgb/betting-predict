"use client";

import {
  Card,
  EmptyState,
  SnapshotBadge,
  StatusDot,
  fmtWhen,
  type BmState,
} from "@/components/betmind/ui";
import { useBetMindData } from "@/components/betmind/DataProvider";
import {
  operationalStatusIt,
  roleLabelIt,
  sourceBlurbIt,
  sourceStatusKind,
  sourceTitleIt,
  temporalLabelIt,
} from "@/domain/eval/betmind-runtime/status-copy";

function sourceDot(status: string | undefined): BmState {
  const kind = sourceStatusKind(status);
  if (kind === "OK") return "ONLINE";
  if (kind === "AUTH_REQUIRED" || String(status ?? "").toUpperCase() === "FOUNDATION") return "DEGRADED";
  if (kind === "BLOCKED" || kind === "NO_DATA" || kind === "NETWORK_ERROR") return "OFFLINE";
  const u = String(status ?? "").toUpperCase();
  if (["PARTIAL", "TEMPORALLY_CAUTIOUS", "RESEARCH_TEST", "PLAN_LIMITED", "CANDIDATE"].includes(u)) {
    return "DEGRADED";
  }
  return "UNKNOWN";
}

/** PR #7 + core acquisition first, then the rest of the honest registry. */
const PRIORITY_IDS = [
  "espn",
  "openfootball",
  "openligadb",
  "thesportsdb",
  "bbc-sport",
  "guardian-football",
  "gazzetta",
  "ansa",
  "sky-sports",
  "espn-soccer-news",
  "corriere-sport",
  "il-messaggero",
  "football-data-co-uk",
  "understat",
  "open-meteo",
  "statsbomb",
  "club-football-match-data",
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

  const origin =
    sources?.source === "remote" || sources?.source === "neon"
      ? "Elenco dallo specchio remoto: i numeri sono rendimento reale, non catalogo."
      : sources?.source === "disk"
        ? "Elenco dal disco Lab B su questo host."
        : sources?.source === "memory"
          ? "Elenco dal registro in memoria: su Vercel manca il JSON Lab B. Nessuno stato ONLINE inventato."
          : "Origine del registro sconosciuta.";

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="bm-section-label">Dati</div>
          <h1 className="mt-1 text-2xl font-bold">Fonti</h1>
          <p className="bm-prose-muted mt-2 max-w-xl">
            Stato reale delle fonti collegate: ok, parziale, non raggiungibile, o senza dati.
          </p>
        </div>
        <SnapshotBadge updating={updating} />
      </div>

      {error && (
        <Card>
          <p className="text-sm text-[var(--bm-danger)]">{error}</p>
        </Card>
      )}

      <Card>
        <p className="bm-prose">{origin}</p>
        {sources?.note ? <p className="bm-prose-muted mt-2">{sources.note}</p> : null}
        {coverage?.note ? <p className="bm-prose-muted mt-2">{coverage.note}</p> : null}
        <p className="bm-prose-muted mt-2">
          Aggiornato {fmtWhen(sources?.at ?? lastUpdate)}. Le quote restano solo confronto:
          non entrano nel modello indipendente
          {sources?.scrape_enters_model ? " — attenzione: scrape segnalato verso il modello." : "."}
        </p>
      </Card>

      {!ordered.length ? (
        <EmptyState
          title={lastUpdate || error ? "Nessun elenco fonti" : "Caricamento"}
          reason={
            lastUpdate || error
              ? "L’API non ha restituito un registro. Niente di inventato: o lo specchio remoto è vuoto, o il runtime non ha ancora pubblicato le fonti."
              : "Sto chiedendo il registro fonti. Nessuno stato ONLINE inventato mentre aspettiamo."
          }
        />
      ) : (
        <div className="grid gap-3">
          {ordered.map((s) => {
            if (!s) return null;
            const title = sourceTitleIt(s.id, s.title);
            const status = operationalStatusIt(s.status);
            const blurb = sourceBlurbIt(s.status, s.reason);
            const lastOk = s.last_success ? fmtWhen(s.last_success) : null;
            const lastTry = s.last_attempt ? fmtWhen(s.last_attempt) : null;
            return (
              <Card key={s.id}>
                <div className="bm-source-card">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h2>{title}</h2>
                      <p className="bm-muted text-xs">{s.id}</p>
                    </div>
                    <span className="bm-pill inline-flex items-center gap-1.5">
                      <StatusDot state={sourceDot(s.status)} />
                      {status}
                    </span>
                  </div>
                  <p>{blurb}</p>
                  <p className="bm-prose-muted">
                    {roleLabelIt(s.role)}. {temporalLabelIt(s.temporal_precision)}.
                    {s.enters_independent_model
                      ? " Può entrare nel modello solo se i dati sono ammissibili."
                      : " Non entra nel modello indipendente."}
                  </p>
                  <p className="bm-prose-muted">
                    {lastOk
                      ? `Ultimo successo: ${lastOk}.`
                      : "Nessun successo registrato."}{" "}
                    {lastTry ? `Ultimo tentativo: ${lastTry}.` : ""}
                    {s.last_event_label ? ` Ultimo evento: ${s.last_event_label}.` : ""}
                  </p>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {!!operational.length && (
        <Card title="Rendimento per evento">
          <p className="bm-prose-muted mb-3">
            Una fonte è OK solo se ha restituito dati associati a una partita.
            Una homepage con HTTP 200 non basta.
          </p>
          <ul className="space-y-3">
            {operational.map((s) => (
              <li key={String(s.id)} className="border-t border-[rgba(255,255,255,0.06)] pt-3 first:border-0 first:pt-0">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <strong>{sourceTitleIt(String(s.id), s.title)}</strong>
                  <span className="text-sm">{operationalStatusIt(String(s.status ?? "IDLE"))}</span>
                </div>
                <p className="bm-prose-muted mt-1">
                  {s.events_found ?? 0} eventi · {s.observations_found ?? 0} osservazioni.
                  {s.last_event_label
                    ? ` ${s.last_event_label}.`
                    : s.blocked_count
                      ? ` ${s.blocked_count} tentativi bloccati.`
                      : " Nessun evento associato."}
                </p>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
