"use client";

import Link from "next/link";
import { Card, Pill, StatusPill } from "@/components/betmind/ui";
import { useBetMindData } from "@/components/betmind/DataProvider";
import { asRecord } from "@/components/betmind/ui";

export default function SettingsPage() {
  const { data, strip, health } = useBetMindData();
  const detail = asRecord(health?.detail);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <div>
        <div className="bm-section-label">More</div>
        <h1 className="text-2xl font-bold">Settings</h1>
      </div>

      <Card title="APP">
        <ul className="space-y-2 text-sm">
          <li className="flex justify-between gap-2">
            <span>Brand</span>
            <span className="font-semibold">
              Bet<span className="bm-accent">Mind</span>
            </span>
          </li>
          <li className="flex justify-between gap-2">
            <span>Mode</span>
            <Pill tone="accent">PAPER · REAL_MONEY=false</Pill>
          </li>
          <li className="flex justify-between gap-2">
            <span>Polling</span>
            <span className="bm-muted">5s snapshot + health</span>
          </li>
          <li className="flex justify-between gap-2">
            <span>api_calls_ui</span>
            <span>0</span>
          </li>
        </ul>
      </Card>

      <Card title="System (honest)">
        <div className="flex flex-wrap gap-2">
          <StatusPill state={strip.webApp} label={`WEB ${strip.webApp}`} />
          <StatusPill state={strip.dataPipeline} label={`PIPELINE ${strip.dataPipeline}`} />
          <StatusPill state={strip.brain} label={`BRAIN ${strip.brain}`} />
          <StatusPill state={strip.worker} label={`WORKER ${strip.worker}`} />
        </div>
        <p className="mt-3 text-xs bm-muted">
          store_present={String(detail?.store_present ?? false)} · snapshot at {String(data?.at ?? "—")}
        </p>
      </Card>

      <Card title="PWA / iPhone">
        <p className="text-sm leading-relaxed">
          Safari → Share → <strong>Add to Home Screen</strong>. Opens{" "}
          <code className="text-[var(--bm-accent)]">/</code> in standalone (manifest start_url).
          Theme #0A0A0A · safe-area · no offline service worker yet.
        </p>
      </Card>

      <Card title="SHORTCUTS">
        <div className="flex flex-col gap-2 text-sm">
          <Link className="bm-accent underline" href="/sources">
            Data sources
          </Link>
          <Link className="bm-accent underline" href="/models">
            Models
          </Link>
          <Link className="bm-accent underline" href="/bankroll">
            Bankroll
          </Link>
          <Link className="bm-accent underline" href="/research">
            Research home
          </Link>
        </div>
      </Card>
    </div>
  );
}
