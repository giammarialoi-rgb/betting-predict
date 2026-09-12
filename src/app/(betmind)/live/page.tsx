"use client";

import Link from "next/link";
import {
  Card,
  EmptyState,
  SnapshotBadge,
  asRecord,
} from "@/components/betmind/ui";
import { EventCard } from "@/components/betmind/EventCard";
import { useBetMindData } from "@/components/betmind/DataProvider";
import { decisionLabelIt, isInPlayBoardStatus } from "@/domain/eval/betmind-runtime/status-copy";

export default function LivePage() {
  const { data, error, updating, lastUpdate, health } = useBetMindData();
  const obs = asRecord(data?.observatory);
  const sys = asRecord(obs?.system);
  const detail = asRecord(health?.detail);
  const activity =
    asRecord(asRecord(obs?.multisource_055)?.current_activity) ?? asRecord(obs?.current_work);
  const events = ((obs?.next_events as Record<string, unknown>[]) ?? []).filter(Boolean);
  const live = events.filter((e) => isInPlayBoardStatus(e.status));
  const decisions = events.slice(0, 12);
  const settlements = data?.recent_settlements ?? [];
  const phase = String(activity?.phase ?? sys?.phase ?? "");
  const idle = /IDLE|SLEEP/i.test(phase);
  const stale = detail?.mirror_stale === true;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="bm-section-label">Monitor</div>
          <h1 className="text-2xl font-bold">Live</h1>
          <p className="bm-prose-muted mt-1 max-w-xl">
            Solo partite davvero in corso o decisioni già sul board. Se il runtime è spento
            o lo specchio è scaduto, lo diciamo: niente LIVE inventato.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <SnapshotBadge updating={updating} />
          <span className="bm-muted">{lastUpdate ? new Date(lastUpdate).toLocaleTimeString("it-IT") : "—"}</span>
        </div>
      </div>

      {error && (
        <Card className="border-[rgba(255,77,77,0.4)]">
          <p className="text-sm text-[var(--bm-danger)]">{error}</p>
        </Card>
      )}

      <Card title="Cosa sta facendo ora">
        {stale ? (
          <p className="bm-prose">
            Specchio scaduto. Il PC può essere acceso, ma Vercel non ha un battito recente —
            non mostriamo il sistema come online.
          </p>
        ) : idle || !phase ? (
          <p className="bm-prose">
            In attesa del prossimo ciclo
            {activity?.note ? `: ${String(activity.note)}` : "."} Nessuna analisi live inventata.
          </p>
        ) : (
          <p className="bm-prose">
            Fase {phase}
            {activity?.sport ? ` · ${String(activity.sport)}` : ""}
            {activity?.note ? `. ${String(activity.note)}` : "."}
          </p>
        )}
      </Card>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Partite in corso</h2>
        {live.length === 0 ? (
          <EmptyState
            title="Nessuna partita live"
            reason="Sul board attuale non c’è nessuna riga in corso. Non inventiamo un live vuoto."
          />
        ) : (
          <div className="grid gap-3">
            {live.map((e) => (
              <EventCard
                key={String(e.event_id)}
                event={e}
                href={e.event_id ? `/events/${String(e.event_id)}` : undefined}
              />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Decisioni recenti</h2>
        {decisions.length === 0 ? (
          <EmptyState
            title="Nessuna decisione sul board"
            reason="Il board è vuoto. Se lo specchio remoto è spento o scaduto, le decisioni restano assenti."
          />
        ) : (
          <div className="grid gap-3">
            {decisions.map((e) => (
              <EventCard
                key={String(e.event_id)}
                event={e}
                href={e.event_id ? `/events/${String(e.event_id)}` : undefined}
              />
            ))}
          </div>
        )}
      </section>

      <Card title="Risultati recenti">
        {settlements.length === 0 ? (
          <EmptyState
            title="Nessun esito liquidato"
            reason="Non ci sono settlements recenti. Il ciclo di apprendimento aspetta partite terminate."
          />
        ) : (
          <ul className="space-y-2 text-sm">
            {settlements.slice(0, 10).map((s, i) => {
              const row = asRecord(s);
              return (
                <li
                  key={String(row?.event_id ?? i)}
                  className="border-t border-[var(--bm-border)] py-2 first:border-0"
                >
                  <Link className="bm-accent underline" href={`/events/${String(row?.event_id)}`}>
                    {String(row?.label ?? row?.event_id ?? "evento")}
                  </Link>
                  <p className="bm-muted mt-0.5">
                    {String(row?.result ?? "esito assente")} ·{" "}
                    {decisionLabelIt(String(row?.outcome ?? ""))}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
