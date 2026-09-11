/**
 * Human "Cosa ha analizzato" topics. Lights come from persisted facts only.
 */
export type TopicLight = "USED" | "PARTIAL" | "MISSING" | "TEMPORAL";

export type AnalyzedTopic = {
  id: string;
  label_it: string;
  light: TopicLight;
  note_it: string;
};

export function topicLightLabelIt(l: TopicLight): string {
  switch (l) {
    case "USED":
      return "disponibile e utilizzata";
    case "PARTIAL":
      return "disponibile parzialmente";
    case "MISSING":
      return "non disponibile";
    case "TEMPORAL":
      return "esclusa per problema temporale o di validazione";
  }
}

const TOPICS: Array<{ id: string; label_it: string; keys: RegExp; groups?: string[] }> = [
  { id: "form", label_it: "Forma recente", keys: /_(gf|ga|pts)_l(3|5|10)$/ },
  { id: "home_away", label_it: "Rendimento casa/trasferta", keys: /_(attack|defense)_(home|away)$/ },
  { id: "goals", label_it: "Gol", keys: /_(gf|ga|attack|defense)/ },
  { id: "shots", label_it: "Tiri", keys: /_shots_l/ },
  { id: "sot", label_it: "Tiri nello specchio", keys: /_sot_l/ },
  { id: "corners", label_it: "Corner", keys: /_corners_l/ },
  { id: "cards", label_it: "Cartellini", keys: /_cards_l/ },
  { id: "cs", label_it: "Clean sheet", keys: /_cs_l/ },
  { id: "h2h", label_it: "H2H", keys: /^h2h_/ },
  { id: "xg", label_it: "xG", keys: /xg/i },
  { id: "injuries", label_it: "Infortuni", keys: /injur/i },
  { id: "lineups", label_it: "Formazioni", keys: /lineup/i },
  { id: "referee", label_it: "Arbitro", keys: /referee|arbitro/i },
  { id: "weather", label_it: "Meteo", keys: /weather|meteo|temp|precip|wind|humid/i },
  { id: "calendar", label_it: "Calendario e riposo", keys: /matches_last_|days_since_last|rest_days/ },
  { id: "news", label_it: "Notizie", keys: /^news_|rss_/ },
];

export function buildAnalyzedTopics(input: {
  entered_keys: string[];
  excluded_keys: string[];
  research_fields: string[];
  temporal_excluded: boolean;
}): AnalyzedTopic[] {
  return TOPICS.map((t) => {
    const entered = input.entered_keys.some((k) => t.keys.test(k));
    const excluded = input.excluded_keys.some((k) => t.keys.test(k));
    const researched = input.research_fields.some((k) => t.keys.test(k));
    let light: TopicLight = "MISSING";
    if (input.temporal_excluded && (excluded || researched) && !entered) light = "TEMPORAL";
    else if (entered) light = "USED";
    else if (researched || excluded) light = "PARTIAL";
    let note: string;
    if (light === "USED") {
      note = `${t.label_it}: trovato e usato nel modello.`;
    } else if (light === "PARTIAL") {
      note = `${t.label_it}: parzialmente trovato. I dati restano nel dossier anche se non tutti entrano nel modello.`;
    } else if (light === "TEMPORAL") {
      note = `${t.label_it}: trovato ma escluso perche non era disponibile prima del calcio d'inizio.`;
    } else {
      note = `${t.label_it}: non disponibile.`;
    }
    return {
      id: t.id,
      label_it: t.label_it,
      light,
      note_it: note,
    };
  });
}
