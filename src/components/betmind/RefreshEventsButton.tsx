"use client";

import { useState } from "react";
import { useBetMindData } from "@/components/betmind/DataProvider";

export function RefreshEventsButton({
  compact = false,
  onDone,
}: {
  compact?: boolean;
  onDone?: () => void;
}) {
  const { reload } = useBetMindData();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setErr(null);
    setMsg("Aggiorno…");
    try {
      const res = await fetch("/api/betmind/refresh-events", {
        method: "POST",
        cache: "no-store",
      });
      const body = (await res.json()) as {
        ok?: boolean;
        progress_it?: string;
        errors?: string[];
        brain_ran?: boolean;
        acquisition?: { note_it?: string; timed_out?: boolean };
      };
      const parts = [body.progress_it, body.acquisition?.note_it].filter(Boolean);
      if (!res.ok || body.ok === false) {
        setErr(parts.join(" ") || "Aggiornamento non riuscito.");
        setMsg(null);
      } else {
        setMsg(parts.join(" "));
      }
      await reload();
      onDone?.();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Aggiornamento non riuscito.");
      setMsg(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={compact ? "flex flex-col items-end gap-1" : "flex flex-col gap-2"}>
      <button
        type="button"
        className={compact ? "bm-btn bm-btn-ghost text-xs" : "bm-btn bm-btn-primary"}
        disabled={busy}
        onClick={() => void run()}
      >
        {busy ? "Aggiorno…" : "Aggiorna eventi"}
      </button>
      {!compact && msg && <p className="bm-prose-muted max-w-md text-xs">{msg}</p>}
      {err && (
        <p className={compact ? "max-w-[14rem] text-[10px] text-[var(--bm-danger)]" : "max-w-md text-xs text-[var(--bm-danger)]"}>
          {err}
        </p>
      )}
    </div>
  );
}
