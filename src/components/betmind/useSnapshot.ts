"use client";

import { useCallback, useEffect, useState } from "react";
import type { BmState } from "@/components/betmind/ui";
import { componentState } from "@/components/betmind/ui";

export type BetMindSnapshot = {
  at: string;
  api_calls_ui: 0;
  real_money?: false;
  observatory: Record<string, unknown> | null;
  health: Record<string, unknown> | null;
  analysis?: Record<string, unknown> | null;
  mirror_source?: string;
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
  error?: string;
  ok?: boolean;
};

export type BetMindHealth = {
  ok: boolean;
  components?: Record<string, string>;
  detail?: Record<string, unknown>;
  real_money?: false;
};

export type DataSourceEntry = {
  id: string;
  title?: string;
  status?: string;
  role?: string;
  reason?: string;
  enters_independent_model?: boolean;
  temporal_precision?: string;
  legal_status?: string;
  last_error?: string | null;
  last_attempt?: string | null;
  last_success?: string | null;
  last_failure?: string | null;
  events_found?: number;
  blocked_count?: number;
  no_event_count?: number;
  last_event_label?: string | null;
  capabilities?: string[];
  missing_adapter?: boolean;
};

export type DataSourcesPayload = {
  ok: boolean;
  source?: string;
  at?: string;
  note?: string;
  test_scrape_enabled?: boolean;
  scrape_enters_model?: boolean;
  sources?: DataSourceEntry[];
  operational?: DataSourceEntry[];
};

export type CoveragePayload = {
  ok: boolean;
  source?: string;
  note?: string;
  DATA_COVERAGE?: number | null;
  SOURCE_COUNT?: number | null;
  FEATURES_ACTIVE?: string[];
  FEATURES_STUB?: string[];
  FEATURES_MISSING?: string[];
};

export type SystemStrip = {
  webApp: BmState;
  dataPipeline: BmState;
  brain: BmState;
  worker: BmState;
  supervisor: BmState;
  predictiveEngine: BmState;
};

export function deriveSystemStrip(input: {
  snapshotOk: boolean;
  health: BetMindHealth | null;
}): SystemStrip {
  const c = input.health?.components ?? {};
  return {
    webApp: "ONLINE",
    dataPipeline: componentState(c.data_pipeline) !== "UNKNOWN"
      ? componentState(c.data_pipeline)
      : input.snapshotOk
        ? "DEGRADED"
        : "OFFLINE",
    brain: componentState(c.brain),
    worker: componentState(c.worker),
    supervisor: componentState(c.supervisor),
    predictiveEngine: componentState(c.predictive_engine),
  };
}

export function useBetMindSnapshot(pollMs = 4000) {
  const [data, setData] = useState<BetMindSnapshot | null>(null);
  const [health, setHealth] = useState<BetMindHealth | null>(null);
  const [sources, setSources] = useState<DataSourcesPayload | null>(null);
  const [coverage, setCoverage] = useState<CoveragePayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);

  const load = useCallback(async () => {
    setUpdating(true);
    try {
      const [snapRes, healthRes, srcRes, covRes] = await Promise.all([
        fetch("/api/betmind/snapshot", { cache: "no-store" }),
        fetch("/api/betmind/health", { cache: "no-store" }),
        fetch("/api/betmind/data-sources", { cache: "no-store" }),
        fetch("/api/betmind/coverage", { cache: "no-store" }),
      ]);

      if (!snapRes.ok) throw new Error(`snapshot HTTP ${snapRes.status}`);
      const json = (await snapRes.json()) as BetMindSnapshot;
      setData(json);

      if (healthRes.ok) {
        setHealth((await healthRes.json()) as BetMindHealth);
      } else {
        setHealth(null);
      }

      if (srcRes.ok) {
        setSources((await srcRes.json()) as DataSourcesPayload);
      } else {
        setSources(null);
      }

      if (covRes.ok) {
        setCoverage((await covRes.json()) as CoveragePayload);
      } else {
        setCoverage(null);
      }

      setError(null);
      setLastUpdate(new Date().toISOString());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setUpdating(false);
    }
  }, []);

  useEffect(() => {
    const kick = window.setTimeout(() => {
      void load();
    }, 0);
    const t = setInterval(() => void load(), pollMs);
    return () => {
      window.clearTimeout(kick);
      clearInterval(t);
    };
  }, [load, pollMs]);

  const strip = deriveSystemStrip({ snapshotOk: Boolean(data) && !error, health });

  return {
    data,
    health,
    sources,
    coverage,
    strip,
    error,
    updating,
    lastUpdate,
    reload: load,
  };
}
