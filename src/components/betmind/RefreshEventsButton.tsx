"use client";

import { useState } from "react";
import { useBetMindData } from "@/components/betmind/DataProvider";

type LastRefresh = { msg: string | null; err: string | null };

let lastRefresh: LastRefresh = { msg: null, err: null };

export function RefreshEventsButton({
  compact = false,
  hideStatus = false,
  onDone,
  onProgress,
}: {
  compact?: boolean;
  hideStatus?: boolean;
  onDone?: () => void;
  onProgress?: (note: string | null, err: string | null) => void;
}) {
  const { reload } = useBetMindData();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(lastRefresh.msg);
  const [err, setErr] = useState<string | null>(lastRefresh.err);

  function remember(next: LastRefresh) {
    lastRefresh = next;
    setMsg(next.msg);
    setErr(next.err);
    onProgress?.(next.msg, next.err);
  }

  async function run() {
    setBusy(true);
    remember({ msg: "Aggiorno partite e percentuali…", err: null });
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
        brain_online_claimed?: boolean;
        acquisition?: { note_it?: string; timed_out?: boolean };
      };
      const historyNote =
        body && typeof body === "object" && "history" in body
          ? String((body as { history?: { note_it?: string } }).history?.note_it ?? "")
          : "";
      const parts = [body.progress_it, historyNote].filter(Boolean);
      if (!res.ok || body.ok === false) {
        remember({ msg: null, err: parts.join(" ") || "Aggiornamento non riuscito." });
      } else {
        remember({ msg: parts.join(" "), err: null });
      }
      await reload();
      onDone?.();
    } catch (e) {
      remember({
        msg: null,
        err: e instanceof Error ? e.message : "Aggiornamento non riuscito.",
      });
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
      {!hideStatus && msg && (
        <p className={compact ? "max-w-[16rem] text-right text-[10px] text-[var(--bm-muted)]" : "bm-prose-muted max-w-md text-xs"}>
          {msg}
        </p>
      )}
      {!hideStatus && err && (
        <p className={compact ? "max-w-[14rem] text-[10px] text-[var(--bm-danger)]" : "max-w-md text-xs text-[var(--bm-danger)]"}>
          {err}
        </p>
      )}
    </div>
  );
}
