"use client";

import Link from "next/link";
import { Card, Pill, StatusPill } from "@/components/betmind/ui";
import { useBetMindData } from "@/components/betmind/DataProvider";
import { asRecord } from "@/components/betmind/ui";
import { brainStatusIt, formatAgeIt, isRemoteMirrorSource, statusWordIt } from "@/domain/eval/betmind-runtime/status-copy";

export default function SettingsPage() {
  const { data, strip, health } = useBetMindData();
  const detail = asRecord(health?.detail);
  const mirrorAge = typeof detail?.mirror_age_ms === "number" ? detail.mirror_age_ms : null;
  const stale = detail?.mirror_stale === true;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <div>
        <div className="bm-section-label">Altro</div>
        <h1 className="text-2xl font-bold">Impostazioni</h1>
        <p className="mt-1 text-sm bm-muted">
          App web, runtime sul PC e motore predittivo sono tre cose diverse. Solo simulazione.
        </p>
      </div>

      <Card title="App">
        <ul className="space-y-2 text-sm">
          <li className="flex justify-between gap-2">
            <span>Marchio</span>
            <span className="font-semibold">
              Bet<span className="bm-accent">Mind</span>
            </span>
          </li>
          <li className="flex justify-between gap-2">
            <span>Modalità</span>
            <Pill tone="accent">Carta · REAL_MONEY=false</Pill>
          </li>
          <li className="flex justify-between gap-2">
            <span>Aggiornamento</span>
            <span className="bm-muted">snapshot + salute ogni 5 s</span>
          </li>
          <li className="flex justify-between gap-2">
            <span>Chiamate API dalla UI</span>
            <span>0</span>
          </li>
        </ul>
      </Card>

      <Card title="Sistema (onesto)">
        <div className="flex flex-wrap gap-2">
          <StatusPill state={strip.webApp} label={`App web ${statusWordIt(strip.webApp)}`} />
          <StatusPill state={strip.dataPipeline} label={`Pipeline ${statusWordIt(strip.dataPipeline)}`} />
          <StatusPill state={strip.brain} label={`Cervello ${statusWordIt(strip.brain)}`} />
          <StatusPill state={strip.worker} label={`Worker ${statusWordIt(strip.worker)}`} />
        </div>
        <p className="mt-3 text-sm">
          {stale
            ? brainStatusIt("STALE_MIRROR")
            : isRemoteMirrorSource(detail?.mirror_source)
              ? `Specchio remoto da ${String(detail?.mirror_host ?? "PC")} · ultimo segnale ${formatAgeIt(mirrorAge)}.`
              : "Nessuno specchio remoto su questo host."}
        </p>
        <p className="mt-2 text-xs bm-muted">
          Store Lab B su Vercel: {detail?.store_present === true ? "presente" : "assente"}.
          {detail?.store_present_local_on_publisher === true
            ? " Sul PC publisher lo store c’è."
            : ""}{" "}
          Snapshot {String(data?.at ?? "—")}.
        </p>
      </Card>

      <Card title="PWA / iPhone">
        <p className="text-sm leading-relaxed">
          Safari → Condividi → <strong>Aggiungi a Home</strong>. Si apre{" "}
          <code className="text-[var(--bm-accent)]">/</code> a tutto schermo (manifest start_url).
          Tema #0A0A0A · safe-area · nessun service worker offline per ora.
        </p>
      </Card>

      <Card title="Collegamenti">
        <div className="flex flex-col gap-2 text-sm">
          <Link className="bm-accent underline" href="/sources">
            Fonti
          </Link>
          <Link className="bm-accent underline" href="/models">
            Modelli
          </Link>
          <Link className="bm-accent underline" href="/bankroll">
            Bankroll
          </Link>
        </div>
      </Card>
    </div>
  );
}
