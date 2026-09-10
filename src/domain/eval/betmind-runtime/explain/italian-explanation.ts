/**
 * Deterministic Italian explanation from structured facts only.
 * Every sentence maps to explanation_facts / research_summary fields.
 */
import { FEATURE_GROUPS, qualityLabelIt, parseRollingFeature } from "@/domain/eval/betmind-runtime/explain/feature-dictionary";
import type { ResearchSummary } from "@/domain/eval/betmind-runtime/explain/research-summary";
import { buildAnalyzedTopics, type AnalyzedTopic } from "@/domain/eval/betmind-runtime/explain/analyzed-topics";
import { buildFoundFacts } from "@/domain/eval/betmind-runtime/explain/found-facts";
import type { ResearchObservation } from "@/domain/eval/data-intelligence/research/observations-store";

export type PoissonInternals = {
  lambda_home: number;
  lambda_away: number;
};

export type HumanExplanation = {
  match_line: string;
  did: string;
  live_research: string;
  archive: string;
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
  analyzed_topics: AnalyzedTopic[];
  facts_used: string[];
  found: string[];
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
  observations?: ResearchObservation[];
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
    if (
      s.prediction_snapshot.feature_coverage != null &&
      s.prediction_snapshot.feature_coverage < 0.35
    ) {
      why.push(
        `Copertura dei dati ${Math.round(s.prediction_snapshot.feature_coverage * 100)}% con ${s.prediction_snapshot.feature_count_entered} informazioni: sotto la soglia del modello. Non interpretare questo come una previsione autorevole.`,
      );
    } else if (s.prediction_snapshot.feature_count_entered > 0 && s.prediction_snapshot.feature_count_entered <= 6) {
      why.push(
        `Il modello ha usato solo ${s.prediction_snapshot.feature_count_entered} informazioni. La scarsita informativa e parte del risultato, non un dettaglio secondario.`,
      );
    }
    facts.push("no_feature_contribution=true");
  }

  const o = s.origin ?? {
    live_research_sources: 0,
    historical_prior_features: 0,
    derived_features: 0,
    static_context_features: 0,
    market_sources: 0,
  };
  const fd = s.source_rows.find((r) => r.source_id === "football-data-co-uk");
  const liveOk = o.live_research_sources;
  const did = `BetMind ha analizzato la partita ${home} – ${away} prima del calcio d'inizio. Ha cercato dati storici, forma recente, statistiche, precedenti, forza delle squadre, disponibilita della rosa, xG e altre informazioni pre-partita.`;
  const live_research =
    liveOk === 0
      ? "Ricerca live: 0 fonti con dati evento per questa partita."
      : `Ricerca live: ${liveOk} fonti hanno restituito dati (anche parziali) riferiti all'evento.`;
  const archive =
    fd && (fd.human_status === "SUCCESS" || fd.human_status === "PARTIAL")
      ? `Archivio storico: Football-Data disponibile. Feature derivate dall'archivio: ${o.historical_prior_features}.`
      : fd && (fd.human_status === "NO_EVENT" || fd.human_status === "NO_DATA")
        ? `Archivio storico: Football-Data non ha abbinato questa partita (${fd.reason_it}).`
        : o.historical_prior_features > 0
          ? `Archivio storico: ${o.historical_prior_features} feature storiche sono entrate nel modello (priors), anche se la ricerca live di questo ciclo non ha una riga fonte.`
          : "Archivio storico: nessuna feature storica usata.";

  const found = buildFoundFacts({
    observations: input.observations ?? [],
    home,
    away,
  });
  const foundLabels = s.feature_groups_found
    .map((id) => FEATURE_GROUPS.find((g) => g.id === id)?.label_it)
    .filter(Boolean) as string[];
  const analyzed =
    o.historical_prior_features > 0 && liveOk === 0
      ? `La previsione, se presente, si basa sull'archivio storico, non su una ricerca live di questa partita. ${archive}`
      : foundLabels.length > 0
        ? `Prima della partita BetMind ha usato, tra gli input del modello, dati su ${foundLabels.join(", ").toLowerCase()}.`
        : "Prima della partita BetMind non ha ottenuto gruppi di dati sufficienti per descrivere forma o forza delle squadre.";

  const usedLines = s.model_inputs.slice(0, 24).map((f) => {
    const roll = parseRollingFeature(f.key);
    const base = roll
      ? `Nelle ultime ${roll.window} partite disponibili di ${roll.side === "home" ? home : away}, BetMind ha calcolato ${f.label_it} = ${String(f.value)} dall'archivio Football-Data. Questo dato è stato trasformato nella feature ${f.key}.`
      : (() => {
          const origin =
            f.quality === "HISTORICAL_PRIOR"
              ? "archivio Football-Data"
              : f.quality === "DERIVED"
                ? "calcolo derivato"
                : qualityLabelIt(f.quality);
          return `${f.label_it} = ${String(f.value)} (${origin}).`;
        })();
    if (!hasInf) {
      return `${base} Non è entrata in un modello indipendente: i requisiti di copertura non sono stati raggiunti.`;
    }
    return base;
  });
  const used = usedLines;
  const analyzed_topics = buildAnalyzedTopics({
    entered_keys: s.model_inputs.map((f) => f.key),
    excluded_keys: s.model_exclusions.map((f) => f.key),
    research_fields: s.source_rows.flatMap((r) => r.fields_extracted ?? []),
    temporal_excluded: s.source_rows.some((r) => r.human_status === "POST_KICKOFF"),
  });
  const missing: string[] = [];
  for (const t of analyzed_topics) {
    if (t.light === "MISSING") {
      if (t.id === "xg") missing.push("Non e stato possibile reperire un dato xG specifico per questa partita.");
      else if (t.id === "injuries") missing.push("Non e stato possibile verificare gli infortuni da una fonte compatibile.");
      else if (t.id === "lineups") missing.push("Le formazioni ufficiali non erano ancora disponibili.");
      else if (t.id === "referee") missing.push("Il dato arbitro non e stato trovato.");
      else if (t.id === "weather") missing.push("Non e stato possibile ottenere un meteo verificabile per questa sede.");
    }
  }
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
    if (row.human_status === "BLOCKED" || row.human_status === "HTTP_ERROR" || row.human_status === "NO_DATA" || row.human_status === "NO_EVENT") {
      missing.push(row.reason_it);
    }
  }

  const sources_summary = `Ricerca effettuata: ${s.sources_attempted} fonti/adapter tentati. ${s.sources_successful} hanno restituito dati. ${s.sources_partial} parziali. ${s.sources_blocked} errore/blocco. ${s.sources_no_event} non contenevano la partita. ${s.sources_missing_adapter} senza adapter. ${s.sources_no_data} senza dati sufficienti.`;
  facts.push("sources_summary_counts");
  facts.push(`live_research=${liveOk}`);
  facts.push(`historical_priors=${o.historical_prior_features}`);

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

  const category_checks = analyzed_topics.map((t) => ({
    label: t.label_it,
    found: t.light === "USED" || t.light === "PARTIAL",
    note: t.note_it,
  }));

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
    did,
    live_research,
    archive,
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
      foundLabels.length > 0
        ? `Il modello ha confrontato il rendimento storico delle due squadre e ha stimato il numero di gol attesi per ciascuna. Queste stime vengono poi utilizzate dal modello Poisson per calcolare le probabilità dei tre risultati. Le quote di mercato sono state osservate separatamente e non sono state utilizzate per calcolare la previsione.`
        : "BetMind non ha ottenuto abbastanza dati storici o di ricerca per stimare i gol attesi. Le quote di mercato restano separate e non sostituiscono i dati mancanti.",
    poisson,
    insufficient,
    category_checks,
    analyzed_topics,
    facts_used: facts,
    found,
  };
}