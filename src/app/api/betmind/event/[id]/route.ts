import { NextResponse } from "next/server";
import { existsSync, openSync, readSync, closeSync, statSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { permanentRoot044 } from "@/domain/eval/permanent-044/config";
import { piRoot } from "@/domain/eval/predictive-intelligence/config";

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

/** Lite event detail — disk only, no full store load. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const root = permanentRoot044();
  const pi = piRoot(root);
  const event = findEvent(root, id);
  if (!event) {
    return NextResponse.json({ error: "not_found", event_id: id }, { status: 404 });
  }

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
    pred && typeof pred.home_prob === "number"
      ? {
          HOME: pred.home_prob as number,
          DRAW: pred.draw_prob as number,
          AWAY: pred.away_prob as number,
        }
      : pred?.probability_model && typeof pred.probability_model === "object"
        ? (pred.probability_model as Record<string, number>)
        : learning[0]?.prediction && typeof learning[0].prediction === "object"
          ? (learning[0].prediction as Record<string, number>)
          : null;

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
    predictions: pred
      ? [
          {
            selection:
              (pred.selection as string | null) ?? (decision?.prediction as string | null) ?? null,
            confidence_score: typeof pred.confidence_score === "number" ? pred.confidence_score : 0,
            human_readable_reason: String(
              pred.human_readable_reason ?? explanation?.WHY_PRIMARY ?? "N/A",
            ),
            probability_model,
            probability_market:
              marketP != null && decision?.prediction
                ? { [String(decision.prediction)]: marketP }
                : null,
            model_version: String(pred.model_version ?? decision?.model_version ?? "N/A"),
            reason_codes,
          },
        ]
      : probability_model
        ? [
            {
              selection: (decision?.prediction as string | null) ?? null,
              confidence_score: typeof decision?.confidence === "number" ? decision.confidence : 0,
              human_readable_reason: String(explanation?.WHY_PRIMARY ?? "N/A"),
              probability_model,
              probability_market: null,
              model_version: String(decision?.model_version ?? "N/A"),
              reason_codes,
            },
          ]
        : [],
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
          actual_result: String(
            learn0?.actual ?? settlement?.result ?? "INSUFFICIENT_DATA",
          ),
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
          capital_note: "PAPER_ONLY · REAL_MONEY=false",
        }
      : null,
    lock: lock
      ? {
          lock_timestamp: String(lock.lock_timestamp ?? "N/A"),
          decision_context_hash: String(lock.decision_context_hash ?? "N/A"),
          model_version: String(lock.model_version ?? "N/A"),
        }
      : null,
    model_version: String(pred?.model_version ?? decision?.model_version ?? "N/A"),
    finished,
    api_calls_ui: 0 as const,
  });
}
