/**
 * Deterministic Italian explanation from structured facts only.
 * Every sentence maps to explanation_facts / research_summary fields.
 */
import { FEATURE_GROUPS } from "@/domain/eval/betmind-runtime/explain/feature-dictionary";
import type { ResearchSummary } from "@/domain/eval/betmind-runtime/explain/research-summary";

export type PoissonInternals = {
  lambda_home: number;
  lambda_away: number;
};

export type HumanExplanation = {
  match_line: string;
  prediction_lines: string[];
  why: string[];
  analyzed: string;
  used: string[];
  missing: string[];
  sources_summary: string;
  odds_sentence: string;
  model_card: {
    name_it: string;
    version: string;
    inputs: number;
    coverage_pct: string | null;
    odds_used: false;
  };
  how_model_works: string;
  poisson: string | null;
  insufficient: string | null;
  category_checks: Array<{ label: string; found: boolean; note: string }>;
  facts_used: string[];
};

function pct1(v: number): string {
  return (v * 100).toLocaleString("it-IT", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

export function buildHumanExplanation(input: {
  home: string;
  away: string;
  probability: Record<string, number> | null;
  summary: ResearchSummary;
  poisson?: PoissonInternals | null;
  reason_codes?: string[];
}): HumanExplanation {
  const home = input.home || "Squadra di casa";
  const away = input.away || "Squadra ospite";
  const s = input.summary;
  const facts = [...s.explanation_facts];
  const p = input.probability;
  const hasInf = s.prediction_snapshot.has_independent_inference && p != null;

  const prediction_lines: string[] = [];
  if (hasInf && p) {
    const h = typeof p.HOME === "number" ? p.HOME : p.home;
    const d = typeof p.DRAW === "number" ? p.DRAW : p.draw;
    const a = typeof p.AWAY === "number" ? p.AWAY : p.away;
    if (typeof h === "number" && typeof d === "number" && typeof a === "number") {
      prediction_lines.push(`Casa ${pct1(h)}%`);
      prediction_lines.push(`Pareggio ${pct1(d)}%`);
      prediction_lines.push(`Trasferta ${pct1(a)}%`);
      facts.push(`prob_home=${h}`, `prob_draw=${d}`, `prob_away=${a}`);
    }
  }

  const why: string[] = [];
  if (hasInf && p) {
    const h = typeof p.HOME === "number" ? p.HOME : 0;
    why.push(
      `Il modello assegna il ${pct1(h)}% alla vittoria interna. Sono stime del modello, non probabilità esatte.`,
    );
    why.push(
      "La valutazione deriva dai dati storici e dalle caratteristiche pre-partita disponibili per entrambe le squadre.",
    );
    why.push(
      "Il modello Poisson utilizza congiuntamente le feature disponibili; il sistema non dispone ancora di una misura affidabile del contributo individuale di ogni feature.",
    );
    facts.push("no_feature_contribution=true");
  }

  const foundLabels = s.feature_groups_found
    .map((id) => FEATURE_GROUPS.find((g) => g.id === id)?.label_it)
    .filter(Boolean) as string[];
  const analyzed =
    foundLabels.length > 0
      ? `Prima della partita BetMind ha raccolto informazioni su ${foundLabels.join(", ").toLowerCase()}.`
      : "Prima della partita BetMind non ha ottenuto gruppi di dati sufficienti per descrivere forma o forza delle squadre.";

  const used = s.model_inputs.slice(0, 24).map((f) => f.label_it);
  const missing: string[] = [];
  for (const ex of s.model_exclusions) {
    if (ex.quality !== "MISSING") continue;
    if (
      /infortun|forma<|lineup|xg|elo|ppda|meteo/i.test(ex.key) ||
      /infortun|formazione|Expected|Elo|pressing/i.test(ex.label_it)
    ) {
      missing.push(`${ex.label_it} — ${ex.reason_it}`);
    }
  }
  for (const row of s.source_rows) {
    if (row.human_status === "SUCCESS" || row.market_layer) continue;
    if (row.human_status === "MISSING_ADAPTER" || row.human_status === "DISABLED_BY_POLICY") continue;
    if (row.human_status === "BLOCKED" || row.human_status === "HTTP_ERROR" || row.human_status === "NO_DATA") {
      missing.push(row.reason_it);
    }
  }

  const sources_summary = `BetMind ha consultato ${s.sources_attempted} fonti. ${s.sources_successful} hanno fornito dati utilizzabili. ${s.sources_blocked} non erano accessibili. ${s.sources_missing_adapter} non disponevano dell'adapter. ${s.sources_no_data} non hanno restituito dati sufficienti.`;
  facts.push("sources_summary_counts");

  const odds_sentence =
    "Le quote sono state osservate separatamente e non sono entrate nell'input del modello indipendente.";
  facts.push("odds_entered_model=false");

  let insufficient: string | null = null;
  if (!hasInf) {
    insufficient =
      "BetMind non ha prodotto una previsione indipendente per questa partita perché i dati disponibili non hanno raggiunto i requisiti del modello.";
    if (s.prediction_snapshot.feature_coverage != null) {
      insufficient += ` Copertura dei dati: ${(s.prediction_snapshot.feature_coverage * 100).toFixed(0)}%.`;
    }
    const missKeys = s.model_exclusions.filter((e) => e.quality === "MISSING").slice(0, 6);
    if (missKeys.length) {
      insufficient += ` Mancavano soprattutto: ${missKeys.map((m) => m.label_it).join("; ")}.`;
    }
    facts.push("insufficient_independent=true");
  }

  const category_checks = FEATURE_GROUPS.filter((g) => g.id !== "ALTRO").map((g) => {
    const found = s.feature_groups_found.includes(g.id);
    return {
      label: g.label_it,
      found,
      note: found
        ? "Presente tra gli input usati dal modello"
        : "Cercato o previsto dal catalogo feature, ma non usato (dato assente o non ammissibile)",
    };
  });

  let poisson: string | null = null;
  if (input.poisson && Number.isFinite(input.poisson.lambda_home) && Number.isFinite(input.poisson.lambda_away)) {
    poisson = `Il modello stima circa ${input.poisson.lambda_home.toLocaleString("it-IT", {
      maximumFractionDigits: 2,
    })} gol attesi per ${home} e ${input.poisson.lambda_away.toLocaleString("it-IT", {
      maximumFractionDigits: 2,
    })} per ${away}.`;
    facts.push(`lambda_home=${input.poisson.lambda_home}`, `lambda_away=${input.poisson.lambda_away}`);
  }

  const cov =
    s.prediction_snapshot.feature_coverage != null
      ? `${(s.prediction_snapshot.feature_coverage * 100).toFixed(0)}%`
      : null;

  return {
    match_line: `${home} contro ${away}`,
    prediction_lines,
    why,
    analyzed,
    used,
    missing: [...new Set(missing)].slice(0, 16),
    sources_summary,
    odds_sentence,
    model_card: {
      name_it: "Poisson indipendente",
      version: s.prediction_snapshot.model_version ?? "sconosciuta",
      inputs: s.prediction_snapshot.feature_count_entered,
      coverage_pct: cov,
      odds_used: false,
    },
    how_model_works:
      "BetMind utilizza un modello statistico Poisson per stimare la distribuzione dei gol delle due squadre e da questa distribuzione ricava le probabilità di vittoria, pareggio e sconfitta. Sono stime del modello, non probabilità esatte.",
    poisson,
    insufficient,
    category_checks,
    facts_used: facts,
  };
}