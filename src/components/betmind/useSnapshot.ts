"use client";

import { useCallback, useEffect, useState } from "react";

export type BetMindSnapshot = {
  at: string;
  api_calls_ui: 0;
  observatory: Record<string, unknown> | null;
  health: Record<string, unknown> | null;
  predictive: {
    final_verdict: Record<string, unknown> | null;
    validation: Record<string, unknown> | null;
    model_manifest: Record<string, unknown> | null;
    learning_report: Record<string, unknown> | null;
    paper_bankroll_report: Record<string, unknown> | null;
    e2e: Record<string, unknown> | null;
  };
  challengers: unknown[];
  learning_cases: unknown[];
  recent_settlements: unknown[];
  recent_autopsies: unknown[];
};

export function useBetMindSnapshot(pollMs = 4000) {
  const [data, setData] = useState<BetMindSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);

  const load = useCallback(async () => {
    setUpdating(true);
    try {
      const res = await fetch("/api/betmind/snapshot", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as BetMindSnapshot;
      setData(json);
      setError(null);
      setLastUpdate(new Date().toISOString());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setUpdating(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), pollMs);
    return () => clearInterval(t);
  }, [load, pollMs]);

  return { data, error, updating, lastUpdate, reload: load };
}
