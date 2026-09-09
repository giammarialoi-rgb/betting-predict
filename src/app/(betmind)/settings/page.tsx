"use client";

import Link from "next/link";
import { Card, Pill } from "@/components/betmind/ui";
import { useBetMindSnapshot } from "@/components/betmind/useSnapshot";
import { asRecord } from "@/components/betmind/ui";

export default function SettingsPage() {
  const { data } = useBetMindSnapshot(8000);
  const health = asRecord(data?.health);
  const obs = asRecord(data?.observatory);

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
            <Pill accent>PAPER · REAL_MONEY=false</Pill>
          </li>
          <li className="flex justify-between gap-2">
            <span>Polling</span>
            <span className="bm-muted">4s disk snapshot</span>
          </li>
          <li className="flex justify-between gap-2">
            <span>api_calls_ui</span>
            <span>0</span>
          </li>
        </ul>
      </Card>

      <Card title="PWA / iPhone">
        <p className="text-sm">
          Safari → Share → <strong>Add to Home Screen</strong>. Standalone, theme #0A0A0A, safe-area
          ready.
        </p>
      </Card>

      <Card title="SHORTCUTS">
        <div className="flex flex-col gap-2 text-sm">
          <Link className="bm-accent underline" href="/models">
            Models
          </Link>
          <Link className="bm-accent underline" href="/bankroll">
            Bankroll
          </Link>
          <Link className="bm-accent underline" href="/research">
            Research home
          </Link>
          <Link className="bm-accent underline" href="/actuarial-lab/live-total">
            Actuarial Lab · Live Total
          </Link>
        </div>
      </Card>

      <Card title="SYSTEM (read-only)">
        <pre className="max-h-40 overflow-auto text-[11px] text-[var(--bm-muted)]">
          {JSON.stringify(
            {
              at: data?.at ?? null,
              status: asRecord(health?.system)?.status ?? asRecord(obs?.system)?.status ?? "N/A",
              model_readiness: asRecord(obs?.audit_056)?.model_readiness ?? "N/A",
            },
            null,
            2,
          )}
        </pre>
      </Card>
    </div>
  );
}
