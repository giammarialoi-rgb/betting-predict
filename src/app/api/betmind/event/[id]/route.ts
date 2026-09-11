import { NextResponse } from "next/server";
import { existsSync, openSync, readSync, closeSync, statSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { permanentRoot044 } from "@/domain/eval/permanent-044/config";
import { piRoot } from "@/domain/eval/predictive-intelligence/config";
import {
  buildAnalysisDossier,
  loadBoardEventNeon,
  loadDossierNeon,
} from "@/domain/eval/betmind-runtime/dossier";
import { loadEventAnalyses } from "@/domain/eval/light-analysis/list";
import type { LightAnalysis } from "@/domain/eval/light-analysis/types";

export const dynamic = "force-dynamic";

function readJsonlMatching(
  path: string,
  match: (row: Record<string, unknown>) => boolean,
  limit = 50,
): Record<string, unknown>[] {
  if (!existsSync(path)) return [];
  const size = statSync(path).size;
  const maxBytes = Math.min(size, 8_000_000);
  const fd = openSync(path, "r");
  try {
    const start = Math.max(0, size - maxBytes);
    const buf = Buffer.alloc(size - start);
    readSync(fd, buf, 0, buf.length, start);
    let text = buf.toString("utf8");
    if (start > 0) {
      const nl = text.indexOf("\n");
      if (nl >= 0) text = text.slice(nl + 1);
    }
    const out: Record<string, unknown>[] = [];
    for (const line of text.split(/\n/).filter(Boolean).reverse()) {
      try {
        const row = JSON.parse(line.replace(/^\uFEFF/, "")) as Record<string, unknown>;
        if (match(row)) {
          out.push(row);
          if (out.length >= limit) break;
        }
      } catch {
        /* skip */
      }
    }
    return out;
  } finally {
    closeSync(fd);
  }
}

function findEvent(root: string, id: string): Record<string, unknown> | null {
  const p = join(root, "events.jsonl");
  if (!existsSync(p)) return null;
  for (const line of readFileSync(p, "utf8").split(/\n/).filter(Boolean)) {
    try {
      const row = JSON.parse(line.replace(/^\uFEFF/, "")) as Record<string, unknown>;
      if (row.event_id === id) return row;
    } catch {
      /* skip */
    }
  }
  return null;
}

function categorizeWhy(codes: string[], explanation: Record<string, unknown> | null) {
  const buckets: Record<string, string[]> = {
    FORM: [],
    TEAM_STRENGTH: [],
    HOME_AWAY: [],
    H2H: [],
    STATISTICS: [],
    CONTEXT: [],
  };
  const push = (key: keyof typeof buckets, v: string) => {
    if (v && !buckets[key].includes(v)) buckets[key].push(v);
  };
  for (const c of codes) {
    const u = c.toUpperCase();
    if (/FORM|STREAK|MOMENTUM/.test(u)) push("FORM", c);
    else if (/ELO|STRENGTH|RATING|QUALITY/.test(u)) push("TEAM_STRENGTH", c);
    else if (/HOME|AWAY|VENUE/.test(u)) push("HOME_AWAY", c);
    else if (/H2H|HEAD/.test(u)) push("H2H", c);
    else if (/STAT|XG|SHOT|CORNER|GOAL/.test(u)) push("STATISTICS", c);
    else push("CONTEXT", c);
  }
  const primary = String(explanation?.WHY_PRIMARY ?? "");
  if (primary) push("CONTEXT", primary);
  for (const s of (explanation?.WHY_SUPPORTING as string[] | undefined) ?? []) push("CONTEXT", s);
  return Object.fromEntries(Object.entries(buckets).filter(([, v]) => v.length > 0));
}

/** Event analysis dossier — disk first, Neon mirror on Vercel. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const root = permanentRoot044();
  const pi = piRoot(root);
  const storePresent = existsSync(join(root, "events.jsonl"));

  const lightBundle = await loadEventAnalyses(id);

  if (!storePresent) {
    const remote = await loadDossierNeon(id);
    if (remote) {
      return NextResponse.json({
        ...legacyShapeFromDossier(remote),
        dossier: remote,
        light_analysis: lightBundle.light,
        analysis_modes: analysisModesPayload(lightBundle.light, Boolean(remote.independent_model.probability)),
        mirror_source: "neon",
        api_calls_ui: 0 as const,
        real_money: false as const,
      });
    }

    // Board row alone is not a dossier — do not invent HDA/features/lineage.
    const board = await loadBoardEventNeon(id);
    if (lightBundle.light) {
      return NextResponse.json({
        ...legacyShapeFromLight(lightBundle.light, board),
        light_analysis: lightBundle.light,
        analysis_modes: analysisModesPayload(lightBundle.light, lightBundle.strong_available),
        dossier: null,
        mirror_source: board ? "neon_board_light" : "light",
        api_calls_ui: 0 as const,
        real_money: false as const,
      });
    }
    if (board) {
      const label = String(board.label ?? "");
      const [homeGuess, awayGuess] = label.includes(" vs ")
        ? label.split(" vs ").map((s) => s.trim())
        : [null, null];
      return NextResponse.json(
        {
          error: "dossier_not_mirrored",
          event_id: id,
          reason:
            "Event exists on betmind_board_events but betmind_analysis_dossiers has no row. Full dossier (HDA, features, lineage) requires Lab B mirror — not inventable from board lite fields.",
          present: {
            lab_b_disk: false,
            board_event: true,
            analysis_dossier: false,
            light_analysis: false,
          },
          missing: ["betmind_analysis_dossiers.payload"],
          board_summary: {
            event_id: id,
            bucket: board.bucket ?? null,
            label: board.label ?? null,
            competition: board.competition ?? null,
            kickoff_utc: board.kickoff_utc ?? null,
            model_version: board.model_version ?? null,
            decision: board.decision ?? null,
            prediction_status: board.prediction_status ?? null,
            feature_coverage: board.feature_coverage ?? null,
            analyzed_at: board.analyzed_at ?? null,
            home_or_a: homeGuess,
            away_or_b: awayGuess,
          },
        },
        { status: 404 },
      );
    }

    return NextResponse.json(
      {
        error: "not_found",
        event_id: id,
        reason:
          "NO DATA AVAILABLE — Lab B assente, nessun dossier su Neon, nessun board event, nessuna analisi light",
        present: {
          lab_b_disk: false,
          board_event: false,
          analysis_dossier: false,
          light_analysis: false,
        },
        missing: ["betmind_analysis_dossiers", "betmind_board_events", "betmind_light_analyses"],
      },
      { status: 404 },
    );
  }

  const event = findEvent(root, id);
  if (!event) {
    return NextResponse.json({ error: "not_found", event_id: id }, { status: 404 });
  }

  const dossier = buildAnalysisDossier(id, root);

  const predictions = readJsonlMatching(join(root, "predictions.jsonl"), (r) => r.event_id === id, 5);
  const decisions = readJsonlMatching(join(root, "decisions.jsonl"), (r) => r.event_id === id, 3);
  const settlements = readJsonlMatching(join(root, "settlements.jsonl"), (r) => r.event_id === id, 1);
  const autopsies = readJsonlMatching(join(root, "autopsies.jsonl"), (r) => r.event_id === id, 3);
  const locks = readJsonlMatching(join(root, "locks.jsonl"), (r) => r.event_id === id, 1);
  const learning = [
    ...readJsonlMatching(join(pi, "learning", "cases.jsonl"), (r) => r.event_id === id, 3),
    ...readJsonlMatching(join(root, "learning-cases.jsonl"), (r) => r.event_id === id, 3),
    ...readJsonlMatching(join(root, "learning-candidates.jsonl"), (r) => r.event_id === id, 3),
  ];

  const pred = predictions[0] ?? null;
  const decision = decisions[0] ?? null;
  const settlement = settlements[0] ?? null;
  const lock = locks[0] ?? null;
  const explanation = (decision?.explanation as Record<string, unknown> | undefined) ?? null;
  const reason_codes =
    (pred?.reason_codes as string[]) ?? (decision?.decision_reason_codes as string[]) ?? [];

  const probability_model =
    dossier?.independent_model.probability ??
    (pred?.probability_model && typeof pred.probability_model === "object"
      ? (pred.probability_model as Record<string, number>)
      : learning[0]?.prediction && typeof learning[0].prediction === "object"
        ? (learning[0].prediction as Record<string, number>)
        : null);

  const probability_market =
    dossier?.market.probability ??
    (pred?.probability_market && typeof pred.probability_market === "object"
      ? (pred.probability_market as Record<string, number>)
      : null);

  const modelP =
    typeof decision?.probability === "number"
      ? (decision.probability as number)
      : typeof decision?.fair_probability === "number"
        ? (decision.fair_probability as number)
        : null;
  const marketP =
    typeof decision?.market_probability === "number" ? (decision.market_probability as number) : null;
  const edge =
    typeof decision?.estimated_edge === "number" ? (decision.estimated_edge as number) : null;
  const edge_status = edge == null ? "UNKNOWN" : "KNOWN";

  const learn0 = learning[0] ?? null;
  const finished =
    Boolean(settlement) ||
    Boolean(learn0?.actual) ||
    /FT|FINAL|ENDED|FINISHED/i.test(String(event.status ?? ""));

  return NextResponse.json({
    event: {
      event_id: id,
      sport: String(event.sport ?? "UNKNOWN"),
      competition: String(event.competition ?? "N/A"),
      home_or_a: String(event.home_or_a ?? "N/A"),
      away_or_b: String(event.away_or_b ?? "N/A"),
      kickoff_utc: (event.kickoff_utc as string | null) ?? null,
      semantic_level: String(event.semantic_level ?? "N/A"),
      status: String(event.status ?? "N/A"),
    },
    predictions: [
      {
        selection:
          (pred?.selection as string | null) ?? (decision?.prediction as string | null) ?? null,
        confidence_score:
          typeof pred?.confidence_score === "number"
            ? pred.confidence_score
            : typeof decision?.confidence === "number"
              ? decision.confidence
              : 0,
        human_readable_reason: String(
          pred?.human_readable_reason ?? explanation?.WHY_PRIMARY ?? "N/A",
        ),
        probability_model,
        probability_market,
        model_version: String(
          pred?.model_version ?? decision?.model_version ?? dossier?.cycle.model_version ?? "N/A",
        ),
        reason_codes,
        prediction_id: (pred?.prediction_id as string | null) ?? null,
        timestamp: (pred?.timestamp as string | null) ?? null,
      },
    ].filter((p) => p.probability_model || p.probability_market || pred || decision),
    settlement: settlement
      ? {
          result: String(settlement.result ?? "N/A"),
          outcome: String(settlement.outcome ?? "N/A"),
          settled_at: String(settlement.settled_at ?? "N/A"),
          market: String(settlement.market ?? "N/A"),
          selection: (settlement.selection as string | null) ?? null,
        }
      : null,
    autopsies: autopsies.map((a) => ({
      result_class: String(a.result_class ?? "N/A"),
      error_type: (a.error_type as string | null) ?? null,
      evidence: (a.evidence as string[]) ?? [],
      missed_signals: (a.missed_signals as string[]) ?? [],
      success_class: (a.success_class as string | null) ?? null,
    })),
    structured_explanation: {
      WHY_SELECTED: (explanation?.WHY_SUPPORTING as string[]) ?? [],
      WHY_NOT_SELECTED: [
        ...((explanation?.WHY_AGAINST as string[]) ?? []),
        ...((explanation?.WHY_RISK as string[]) ?? []),
      ],
      FINAL: String(explanation?.WHY_PRIMARY ?? "N/A"),
      WHY_NO_BET: (explanation?.WHY_NO_BET as string | null) ?? null,
    },
    why_buckets: categorizeWhy(reason_codes, explanation),
    decision_048: decision
      ? {
          decision: String(decision.decision ?? "N/A"),
          estimated_edge: edge,
          edge_status,
          confidence: typeof decision.confidence === "number" ? decision.confidence : 0,
          stake: typeof decision.stake === "number" ? decision.stake : 0,
          model_pct: modelP != null ? modelP * 100 : null,
          market_pct: marketP != null ? marketP * 100 : null,
          explanation: {
            WHY_PRIMARY: String(explanation?.WHY_PRIMARY ?? "N/A"),
            WHY_SUPPORTING: (explanation?.WHY_SUPPORTING as string[]) ?? [],
            WHY_AGAINST: (explanation?.WHY_AGAINST as string[]) ?? [],
            WHY_RISK: (explanation?.WHY_RISK as string[]) ?? [],
            WHY_NO_BET: (explanation?.WHY_NO_BET as string | null) ?? null,
          },
        }
      : null,
    learning_case: learn0,
    post_match: finished
      ? {
          prediction:
            (pred?.selection as string | null) ??
            (decision?.prediction as string | null) ??
            "N/A",
          actual_result: String(learn0?.actual ?? settlement?.result ?? "INSUFFICIENT_DATA"),
          model_probability: modelP,
          probability_error:
            typeof learn0?.probability_error === "number" ? learn0.probability_error : null,
          decision: String(decision?.decision ?? "N/A"),
          bet_result: String(learn0?.stake_outcome ?? settlement?.outcome ?? "N/A"),
          pnl: typeof learn0?.pnl === "number" ? learn0.pnl : null,
          autopsy_class: String(autopsies[0]?.result_class ?? "INSUFFICIENT_DATA"),
          error_type: (autopsies[0]?.error_type as string | null) ?? null,
          lesson: String(
            learn0?.calibration_note ??
              learn0?.decision_correctness ??
              autopsies[0]?.success_class ??
              "INSUFFICIENT_DATA",
          ),
        }
      : null,
    autopsy_ui: autopsies[0]
      ? {
          PREVISIONE: (pred?.selection as string | null) ?? null,
          RISULTATO: String(settlement?.result ?? learn0?.actual ?? "N/A"),
          OUTCOME_CLASS: String(autopsies[0].result_class ?? "N/A"),
          ERROR_LABELS: autopsies[0].error_type ? [String(autopsies[0].error_type)] : [],
          capital_note: "SOLO SIMULAZIONE · REAL_MONEY=false",
        }
      : null,
    lock: lock
      ? {
          lock_timestamp: String(lock.lock_timestamp ?? "N/A"),
          decision_context_hash: String(lock.decision_context_hash ?? "N/A"),
          model_version: String(lock.model_version ?? "N/A"),
        }
      : null,
    model_version: String(
      pred?.model_version ?? decision?.model_version ?? dossier?.cycle.model_version ?? "N/A",
    ),
    dossier,
    light_analysis: lightBundle.light,
    analysis_modes: analysisModesPayload(
      lightBundle.light,
      Boolean(dossier?.independent_model.probability) || lightBundle.strong_available,
    ),
    finished,
    mirror_source: "local_disk",
    api_calls_ui: 0 as const,
    real_money: false as const,
  });
}

function analysisModesPayload(light: LightAnalysis | null, strongAvailable: boolean) {
  return {
    light: {
      label_it: "Analisi light",
      available: Boolean(light && light.markets.some((m) => m.status === "OK")),
    },
    strong: {
      label_it: "Analisi forte",
      available: strongAvailable,
      unavailable_it: strongAvailable
        ? null
        : (light?.strong_unavailable_it ??
          "Analisi forte non disponibile: i gate del modello indipendente restano invariati."),
    },
  };
}

function legacyShapeFromLight(
  light: LightAnalysis,
  board: Record<string, unknown> | null,
) {
  const label = String(board?.label ?? "");
  const [homeGuess, awayGuess] = label.includes(" vs ")
    ? label.split(" vs ").map((s) => s.trim())
    : [light.home, light.away];
  return {
    event: {
      event_id: light.event_id,
      sport: light.sport,
      competition: light.competition ?? String(board?.competition ?? "N/A"),
      home_or_a: light.home || homeGuess || "N/A",
      away_or_b: light.away || awayGuess || "N/A",
      kickoff_utc: light.kickoff_utc ?? (board?.kickoff_utc as string | null) ?? null,
      semantic_level: "N/A",
      status: light.status ?? String(board?.status ?? "N/A"),
    },
    predictions: [],
    settlement: null,
    autopsies: [],
    structured_explanation: { WHY_SELECTED: [], WHY_NOT_SELECTED: [], FINAL: "N/A", WHY_NO_BET: null },
    why_buckets: {},
    decision_048: null,
    learning_case: null,
    post_match: null,
    autopsy_ui: null,
    lock: null,
    model_version: null,
    finished: false,
  };
}

function legacyShapeFromDossier(d: NonNullable<ReturnType<typeof buildAnalysisDossier>>) {
  return {
    event: {
      event_id: d.event.event_id,
      sport: d.event.sport,
      competition: d.event.competition,
      home_or_a: d.event.home,
      away_or_b: d.event.away,
      kickoff_utc: d.event.kickoff_utc,
      semantic_level: "N/A",
      status: d.event.status,
    },
    predictions: [
      {
        selection: null,
        confidence_score: d.independent_model.confidence ?? 0,
        human_readable_reason: d.independent_model.note ?? "N/A",
        probability_model: d.independent_model.probability,
        probability_market: d.market.probability,
        model_version: d.independent_model.model_version ?? d.cycle.model_version ?? "N/A",
        reason_codes: d.independent_model.reason_codes,
        prediction_id: d.prediction_id,
        timestamp: d.analyzed_at,
      },
    ],
    settlement: null,
    autopsies: [],
    structured_explanation: { WHY_SELECTED: [], WHY_NOT_SELECTED: [], FINAL: "N/A", WHY_NO_BET: null },
    why_buckets: {},
    decision_048: d.independent_model.decision
      ? {
          decision: d.independent_model.decision,
          estimated_edge: null,
          edge_status: "UNKNOWN",
          confidence: d.independent_model.confidence ?? 0,
          stake: 0,
          model_pct: null,
          market_pct:
            d.market.selection_pct != null ? d.market.selection_pct * 100 : null,
          explanation: {
            WHY_PRIMARY: "N/A",
            WHY_SUPPORTING: [],
            WHY_AGAINST: [],
            WHY_RISK: [],
            WHY_NO_BET: null,
          },
        }
      : null,
    learning_case: null,
    post_match: null,
    autopsy_ui: null,
    lock: null,
    model_version: d.cycle.model_version,
    finished: false,
  };
}
