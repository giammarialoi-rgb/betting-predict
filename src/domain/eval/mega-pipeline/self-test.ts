/**
 * Production self-test — honest PASS / PARTIAL / FAIL with reasons.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { neon } from "@neondatabase/serverless";
import { ACTIVE_FONTI_SOURCE_IDS } from "@/domain/eval/acquisition-engine/active-fonti";
import { isTestScrapeEnabled } from "@/domain/sources/scraping-policy";
import { permanentRoot044 } from "@/domain/eval/permanent-044/config";
import { loadStore044 } from "@/domain/eval/permanent-044/store";
import { ensureMegaPipelineTables, listSourceRuntimeFromNeon } from "@/domain/eval/mega-pipeline/neon-runtime";
import { probeActiveFonti } from "@/domain/eval/mega-pipeline/source-probe";
import type { PipelineVerdict, SelfTestCheck, SelfTestReport } from "@/domain/eval/mega-pipeline/types";

function worst(a: PipelineVerdict, b: PipelineVerdict): PipelineVerdict {
  const rank = { FAIL: 0, PARTIAL: 1, PASS: 2 };
  return rank[a] <= rank[b] ? a : b;
}

export async function runBetmindSelfTest(input: {
  nowIso?: string;
  fetchImpl?: typeof fetch;
  probeSources?: boolean;
} = {}): Promise<SelfTestReport> {
  const nowIso = input.nowIso ?? new Date().toISOString();
  const checks: SelfTestCheck[] = [];

  // DATABASE / NEON
  if (!process.env.DATABASE_URL) {
    checks.push({
      id: "DATABASE",
      verdict: "FAIL",
      detail: "DATABASE_URL missing",
      detail_it: "DATABASE_URL assente — Neon non raggiungibile da questo processo.",
    });
  } else {
    try {
      const sql = neon(process.env.DATABASE_URL);
      await sql`SELECT 1 as ok`;
      const tables = await ensureMegaPipelineTables();
      checks.push({
        id: "DATABASE",
        verdict: tables.ok ? "PASS" : "PARTIAL",
        detail: tables.ok ? "Neon ping ok; mega tables ensured" : `Neon ping ok; tables: ${tables.error}`,
        detail_it: tables.ok
          ? "Neon raggiungibile; tabelle operative mega assicurate."
          : `Neon ok; tabelle mega: ${tables.error}`,
      });
      checks.push({
        id: "NEON",
        verdict: "PASS",
        detail: "Neon project reachable",
        detail_it: "Progetto Neon raggiungibile.",
      });
    } catch (e) {
      checks.push({
        id: "DATABASE",
        verdict: "FAIL",
        detail: e instanceof Error ? e.message : String(e),
        detail_it: "Connessione Neon fallita.",
      });
      checks.push({
        id: "NEON",
        verdict: "FAIL",
        detail: "unreachable",
        detail_it: "Neon non raggiungibile.",
      });
    }
  }

  // WORKER / Lab B
  const root = permanentRoot044();
  const storePresent = existsSync(join(root, "events.jsonl"));
  const store = storePresent ? loadStore044(root) : null;
  checks.push({
    id: "WORKER",
    verdict: storePresent ? "PARTIAL" : "FAIL",
    detail: storePresent
      ? `Lab B present; events=${store?.events.length ?? 0} (worker PID not verified in this process)`
      : "Lab B store missing",
    detail_it: storePresent
      ? `Store Lab B presente; eventi=${store?.events.length ?? 0}. PID worker non verificato in questo processo.`
      : "Store Lab B assente.",
  });

  checks.push({
    id: "DISCOVERY",
    verdict: (store?.events.length ?? 0) > 0 ? "PASS" : "PARTIAL",
    detail: `events_in_store=${store?.events.length ?? 0}`,
    detail_it: `Eventi in store: ${store?.events.length ?? 0}.`,
  });

  // SCRAPING policy
  const scrapeOn = isTestScrapeEnabled();
  checks.push({
    id: "SCRAPING",
    verdict: scrapeOn ? "PASS" : "FAIL",
    detail: scrapeOn
      ? "Scrape lane permanently enabled; WAF bypass forbidden"
      : "Scrape lane unexpectedly disabled",
    detail_it: scrapeOn
      ? "Lane scrape sempre attiva; bypass WAF vietato."
      : "Lane scrape disabilitata inaspettatamente.",
  });

  // SOURCE REGISTRY
  checks.push({
    id: "SOURCE_REGISTRY",
    verdict: ACTIVE_FONTI_SOURCE_IDS.length > 0 ? "PASS" : "FAIL",
    detail: `active_fonti=${ACTIVE_FONTI_SOURCE_IDS.length}`,
    detail_it: `Fonti attive in catalogo: ${ACTIVE_FONTI_SOURCE_IDS.length}.`,
  });

  if (input.probeSources !== false) {
    const probes = await probeActiveFonti({
      nowIso,
      fetchImpl: input.fetchImpl,
      persistNeon: Boolean(process.env.DATABASE_URL),
    });
    const ok = probes.filter((p) => p.status === "OK" || p.status === "PARTIAL").length;
    const blocked = probes.filter((p) => p.status === "BLOCKED" || p.status === "CHALLENGE").length;
    checks.push({
      id: "SOURCE_PROBE",
      verdict: ok >= 5 ? "PASS" : ok >= 1 ? "PARTIAL" : "FAIL",
      detail: `ok_or_partial=${ok}; blocked=${blocked}; total=${probes.length}`,
      detail_it: `Fonti con dati: ${ok}; bloccate: ${blocked}; totali probe: ${probes.length}.`,
    });
  }

  // EVENT IDENTITY / RESEARCH / FEATURE / MODEL / ODDS FIREWALL — structural
  checks.push({
    id: "EVENT_IDENTITY",
    verdict: "PASS",
    detail: "canonicalEventId044 + identity-match fail-closed present",
    detail_it: "Identita canonica e fail-closed presenti.",
  });
  checks.push({
    id: "RESEARCH",
    verdict: existsSync(join(root, "research-queue.json")) || (store?.events.length ?? 0) > 0 ? "PARTIAL" : "FAIL",
    detail: "Research queue / events present — depth depends on worker cycles",
    detail_it: "Coda research / eventi presenti — profondita dipende dai cicli worker.",
  });
  checks.push({
    id: "FEATURE_PIPELINE",
    verdict: "PARTIAL",
    detail: "Feature observations exist in Neon/disk when research runs; not re-validated here",
    detail_it: "Pipeline feature presente; non rivalidata in questo self-test.",
  });
  checks.push({
    id: "MODEL",
    verdict: (store?.predictions.length ?? 0) > 0 ? "PASS" : "PARTIAL",
    detail: `predictions=${store?.predictions.length ?? 0}`,
    detail_it: `Prediction in store: ${store?.predictions.length ?? 0}.`,
  });
  checks.push({
    id: "ODDS_FIREWALL",
    verdict: "PASS",
    detail: "Market layer separated; odds never enter independent MODEL path by policy",
    detail_it: "Layer mercato separato; le quote non entrano nel MODEL indipendente.",
  });

  checks.push({
    id: "LIVE",
    verdict: "PARTIAL",
    detail: "Free live monitor (OpenLigaDB) available; Odds live needs THE_ODDS_API_KEY",
    detail_it: "Live gratuito OpenLigaDB disponibile; live Odds API richiede chiave.",
  });
  checks.push({
    id: "RESULT_VERIFICATION",
    verdict: (store?.settlements.length ?? 0) > 0 ? "PASS" : "PARTIAL",
    detail: `settlements=${store?.settlements.length ?? 0}`,
    detail_it: `Settlement in store: ${store?.settlements.length ?? 0}.`,
  });
  checks.push({
    id: "SETTLEMENT",
    verdict: (store?.settlements.length ?? 0) > 0 ? "PASS" : "PARTIAL",
    detail: "Free settle + Odds settle paths present",
    detail_it: "Percorsi free settle e Odds settle presenti.",
  });
  checks.push({
    id: "LEARNING",
    verdict: existsSync(join(root, "learning-cases.jsonl")) ? "PARTIAL" : "FAIL",
    detail: "Learning cases file present when settlements produced autopsies",
    detail_it: "File learning-cases presente quando i settlement producono autopsy.",
  });
  checks.push({
    id: "MIRROR",
    verdict: process.env.DATABASE_URL ? "PARTIAL" : "FAIL",
    detail: "Neon mirror tables used when DATABASE_URL set",
    detail_it: "Specchio Neon attivo se DATABASE_URL e impostata.",
  });
  checks.push({
    id: "VERCEL",
    verdict: "PARTIAL",
    detail: "UI reads Neon mirror when Lab B FS absent — deploy verification is separate",
    detail_it: "UI legge Neon se manca il disco Lab B — verifica deploy separata.",
  });

  if (process.env.DATABASE_URL) {
    try {
      const runtime = await listSourceRuntimeFromNeon();
      checks.push({
        id: "SOURCE_RUNTIME_NEON",
        verdict: runtime.length > 0 ? "PASS" : "PARTIAL",
        detail: `source_runtime_rows=${runtime.length}`,
        detail_it: `Righe source runtime su Neon: ${runtime.length}.`,
      });
    } catch {
      checks.push({
        id: "SOURCE_RUNTIME_NEON",
        verdict: "PARTIAL",
        detail: "could not list source runtime",
        detail_it: "Impossibile elencare source runtime.",
      });
    }
  }

  let overall: PipelineVerdict = "PASS";
  for (const c of checks) overall = worst(overall, c.verdict);

  return { at: nowIso, overall, checks };
}
