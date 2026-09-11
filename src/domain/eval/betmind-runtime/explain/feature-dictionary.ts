/**
 * Human feature dictionary — labels follow actual PI engine semantics.
 * Never invent meaning for unknown keys.
 */

export type FeatureQualityKind =
  | "REAL"
  | "DERIVED"
  | "HISTORICAL_PRIOR"
  | "MISSING"
  | "STALE"
  | "INVALID"
  | "EXCLUDED";

export type FeatureGroupId =
  | "FORMA"
  | "ATTACCO"
  | "DIFESA"
  | "CONTESTO"
  | "FORZA"
  | "SQUADRA"
  | "HEAD_TO_HEAD"
  | "ALTRO";

export type FeatureGroupMeta = {
  id: FeatureGroupId;
  label_it: string;
};

export const FEATURE_GROUPS: FeatureGroupMeta[] = [
  { id: "FORMA", label_it: "Forma recente" },
  { id: "ATTACCO", label_it: "Attacco" },
  { id: "DIFESA", label_it: "Difesa" },
  { id: "CONTESTO", label_it: "Contesto di gara" },
  { id: "FORZA", label_it: "Forza delle squadre" },
  { id: "SQUADRA", label_it: "Rosa e disponibilita" },
  { id: "HEAD_TO_HEAD", label_it: "Scontri diretti" },
  { id: "ALTRO", label_it: "Altri dati" },
];

const ROLLING_METRIC: Record<
  string,
  { group: FeatureGroupId; tpl: (team: string, n: number) => string }
> = {
  gf: { group: "FORMA", tpl: (t, n) => `Gol segnati da ${t} nelle ultime ${n} partite (media)` },
  ga: { group: "DIFESA", tpl: (t, n) => `Gol subiti da ${t} nelle ultime ${n} partite (media)` },
  pts: { group: "FORMA", tpl: (t, n) => `Punti conquistati da ${t} nelle ultime ${n} partite (media)` },
  shots: { group: "ATTACCO", tpl: (t, n) => `Tiri effettuati da ${t} nelle ultime ${n} partite (media)` },
  sot: { group: "ATTACCO", tpl: (t, n) => `Tiri nello specchio di ${t} nelle ultime ${n} partite (media)` },
  corners: { group: "ATTACCO", tpl: (t, n) => `Calci d'angolo di ${t} nelle ultime ${n} partite (media)` },
  cards: {
    group: "CONTESTO",
    tpl: (t, n) => `Cartellini di ${t} nelle ultime ${n} partite (media, giallo + 2x rosso)`,
  },
  cs: { group: "DIFESA", tpl: (t, n) => `Clean sheet di ${t} nelle ultime ${n} partite (quota)` },
  xg: { group: "ATTACCO", tpl: (t, n) => `Expected Goals (xG) di ${t} nelle ultime ${n} partite (media Understat)` },
  xga: { group: "DIFESA", tpl: (t, n) => `Expected Goals against (xGA) di ${t} nelle ultime ${n} partite (media Understat)` },
  score_cons: {
    group: "ATTACCO",
    tpl: (t, n) =>
      `Regolarita realizzativa di ${t} nelle ultime ${n} partite (quota partite con almeno un gol)`,
  },
};

const STATIC: Record<
  string,
  { group: FeatureGroupId; quality: FeatureQualityKind; label: (home: string, away: string) => string }
> = {
  home_attack_home: {
    group: "ATTACCO",
    quality: "HISTORICAL_PRIOR",
    label: (h) => `Media gol segnati da ${h} in casa`,
  },
  home_defense_home: {
    group: "DIFESA",
    quality: "HISTORICAL_PRIOR",
    label: (h) => `Media gol subiti da ${h} in casa`,
  },
  away_attack_away: {
    group: "ATTACCO",
    quality: "HISTORICAL_PRIOR",
    label: (_h, a) => `Media gol segnati da ${a} in trasferta`,
  },
  away_defense_away: {
    group: "DIFESA",
    quality: "HISTORICAL_PRIOR",
    label: (_h, a) => `Media gol subiti da ${a} in trasferta`,
  },
  home_attack_all: {
    group: "ATTACCO",
    quality: "HISTORICAL_PRIOR",
    label: (h) => `Media gol segnati da ${h} in tutte le sedi`,
  },
  away_attack_all: {
    group: "ATTACCO",
    quality: "HISTORICAL_PRIOR",
    label: (_h, a) => `Media gol segnati da ${a} in tutte le sedi`,
  },
  strength_diff_pts: {
    group: "FORZA",
    quality: "DERIVED",
    label: (h, a) => `Differenza di forza (punti medi) tra ${h} e ${a}`,
  },
  home_rest_days: {
    group: "CONTESTO",
    quality: "DERIVED",
    label: (h) => `Giorni di riposo di ${h}`,
  },
  away_rest_days: {
    group: "CONTESTO",
    quality: "DERIVED",
    label: (_h, a) => `Giorni di riposo di ${a}`,
  },
  home_advantage: {
    group: "CONTESTO",
    quality: "DERIVED",
    label: () => "Vantaggio campo (indicatore fisso della sede)",
  },
  league_avg_gf: {
    group: "CONTESTO",
    quality: "DERIVED",
    label: () => "Media gol per squadra nel campionato (storico)",
  },
  h2h_n: {
    group: "HEAD_TO_HEAD",
    quality: "HISTORICAL_PRIOR",
    label: (h, a) => `Numero di scontri diretti precedenti tra ${h} e ${a}`,
  },
  h2h_home_win_rate: {
    group: "HEAD_TO_HEAD",
    quality: "HISTORICAL_PRIOR",
    label: (h) => `Quota vittorie della squadra di casa (${h}) negli scontri diretti`,
  },
  h2h_draw_rate: {
    group: "HEAD_TO_HEAD",
    quality: "HISTORICAL_PRIOR",
    label: () => "Quota pareggi negli scontri diretti",
  },
  season_phase: {
    group: "CONTESTO",
    quality: "DERIVED",
    label: () => "Fase di stagione (partite gia giocate / 38)",
  },
  home_elo: { group: "FORZA", quality: "REAL", label: (h) => `Rating Elo di ${h}` },
  away_elo: { group: "FORZA", quality: "REAL", label: (_h, a) => `Rating Elo di ${a}` },
  elo_diff: { group: "FORZA", quality: "DERIVED", label: () => "Differenza Elo (casa - trasferta)" },
  home_xg_prematch: {
    group: "ATTACCO",
    quality: "HISTORICAL_PRIOR",
    label: (h) => `Expected Goals pre-partita di ${h} (priors Understat, non nel modello)`,
  },
  away_xg_prematch: {
    group: "ATTACCO",
    quality: "HISTORICAL_PRIOR",
    label: (_h, a) => `Expected Goals pre-partita di ${a} (priors Understat, non nel modello)`,
  },
  home_xga_prematch: {
    group: "DIFESA",
    quality: "HISTORICAL_PRIOR",
    label: (h) => `Expected Goals against pre-partita di ${h} (priors Understat, non nel modello)`,
  },
  away_xga_prematch: {
    group: "DIFESA",
    quality: "HISTORICAL_PRIOR",
    label: (_h, a) => `Expected Goals against pre-partita di ${a} (priors Understat, non nel modello)`,
  },
  home_injuries_n: {
    group: "SQUADRA",
    quality: "REAL",
    label: (h) => `Numero di giocatori indisponibili di ${h}`,
  },
  away_injuries_n: {
    group: "SQUADRA",
    quality: "REAL",
    label: (_h, a) => `Numero di giocatori indisponibili di ${a}`,
  },
  home_lineup_confirmed: {
    group: "SQUADRA",
    quality: "REAL",
    label: (h) => `Formazione confermata di ${h}`,
  },
  away_lineup_confirmed: {
    group: "SQUADRA",
    quality: "REAL",
    label: (_h, a) => `Formazione confermata di ${a}`,
  },
  ppda_home: {
    group: "ATTACCO",
    quality: "REAL",
    label: (h) => `Intensita del pressing di ${h} (PPDA)`,
  },
  ppda_away: {
    group: "ATTACCO",
    quality: "REAL",
    label: (_h, a) => `Intensita del pressing di ${a} (PPDA)`,
  },
};

const ROLLING_RE = /^(home|away)_(gf|ga|pts|shots|sot|corners|cards|cs|score_cons|xg|xga)_l(3|5|10)$/;

export function parseRollingFeature(key: string): {
  side: "home" | "away";
  metric: string;
  window: 3 | 5 | 10;
} | null {
  const m = ROLLING_RE.exec(key);
  if (!m) return null;
  return {
    side: m[1] as "home" | "away",
    metric: m[2]!,
    window: Number(m[3]) as 3 | 5 | 10,
  };
}

export function featureGroupOf(key: string): FeatureGroupId {
  const roll = parseRollingFeature(key);
  if (roll) return ROLLING_METRIC[roll.metric]?.group ?? "FORMA";
  return STATIC[key]?.group ?? "ALTRO";
}

export function featureLabelIt(key: string, home: string, away: string): string {
  const h = home.trim() || "la squadra di casa";
  const a = away.trim() || "la squadra ospite";
  const roll = parseRollingFeature(key);
  if (roll) {
    const spec = ROLLING_METRIC[roll.metric];
    if (spec) return spec.tpl(roll.side === "home" ? h : a, roll.window);
  }
  const st = STATIC[key];
  if (st) return st.label(h, a);
  return `Dato tecnico "${key}" (descrizione non in dizionario — non interpretato)`;
}

export function classifyFeatureQuality(input: {
  key: string;
  value: number | string | null;
  status: string;
  entered_model: boolean;
  source?: string;
}): FeatureQualityKind {
  const st = input.status.toUpperCase();
  if (st === "STALE") return "STALE";
  if (st === "INVALID") return "INVALID";
  if (input.value == null || st === "UNAVAILABLE" || st === "INSUFFICIENT") return "MISSING";
  if (!input.entered_model) return "EXCLUDED";
  if (parseRollingFeature(input.key)) return "HISTORICAL_PRIOR";
  const stDef = STATIC[input.key];
  if (stDef) return stDef.quality;
  const src = String(input.source ?? "").toLowerCase();
  if (src.includes("football-data")) return "HISTORICAL_PRIOR";
  if (src.includes("clubelo") || src.includes("api-sports")) return "REAL";
  return "DERIVED";
}

export function qualityLabelIt(q: FeatureQualityKind): string {
  switch (q) {
    case "REAL":
      return "Osservazione reale";
    case "DERIVED":
      return "Calcolato dai dati storici";
    case "HISTORICAL_PRIOR":
      return "Storico (partite gia concluse)";
    case "MISSING":
      return "Non disponibile";
    case "STALE":
      return "Scaduto";
    case "INVALID":
      return "Non valido";
    case "EXCLUDED":
      return "Escluso dal modello";
  }
}