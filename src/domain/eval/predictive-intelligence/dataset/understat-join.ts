/**
 * Aggancio degli xG Understat allo storico Football-Data.
 *
 * Perche serve. Football-Data pubblica HxG/AxG solo dalla stagione in corso:
 * 893 partite su 54.000, e zero sulla 24/25 su cui si misura il modello. Per
 * allenare la forza sugli xG serve una fonte con storico, e Understat copre i
 * cinque campionati maggiori dal 2014.
 *
 * Il problema e unire due anagrafiche diverse ("Man United" / "Manchester
 * United", "Wolves" / "Wolverhampton Wanderers") senza scrivere a mano una
 * tabella di alias che invecchia a ogni promozione. La soluzione qui non usa i
 * nomi come chiave: in una stagione ogni squadra ha un calendario suo, cioe un
 * insieme di date in cui gioca, e quell'insieme la identifica da solo. Si
 * accoppiano le squadre per sovrapposizione di calendario (il nome entra solo
 * come spareggio, con peso basso) e poi si uniscono le partite.
 *
 * La verifica non e il numero di accoppiamenti ma i GOL: se l'abbinamento
 * fosse sbagliato, i punteggi delle due fonti non coinciderebbero. Ogni riga
 * unita con gol discordanti viene scartata, non corretta.
 */

export type UnderstatFixture = {
  date: string; // YYYY-MM-DD
  home: string;
  away: string;
  goalsHome: number;
  goalsAway: number;
  xgHome: number;
  xgAway: number;
};

export type TargetFixture = {
  key: string;
  date: string; // YYYY-MM-DD
  home: string;
  away: string;
  goalsHome: number;
  goalsAway: number;
};

export type JoinReport = {
  understat: number;
  target: number;
  joined: number;
  rejectedGoals: number;
  ambiguous: number;
};

function dayNumber(iso: string): number {
  return Math.round(Date.parse(`${iso}T00:00:00.000Z`) / 86_400_000);
}

/** Similarita grezza fra due nomi, 0..1. Serve solo a rompere i pareggi. */
export function nameSimilarity(a: string, b: string): number {
  const norm = (s: string) =>
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]/g, "");
  const x = norm(a);
  const y = norm(b);
  if (!x || !y) return 0;
  const short = x.length <= y.length ? x : y;
  const long = x.length <= y.length ? y : x;
  let hit = 0;
  for (let i = 0; i + 3 <= short.length; i += 1) {
    if (long.includes(short.slice(i, i + 3))) hit += 1;
  }
  const grams = Math.max(1, short.length - 2);
  return hit / grams;
}

function calendars<T extends { date: string; home: string; away: string }>(
  rows: readonly T[],
): Map<string, number[]> {
  const out = new Map<string, number[]>();
  for (const r of rows) {
    const d = dayNumber(r.date);
    for (const t of [r.home, r.away]) {
      const cur = out.get(t);
      if (cur) cur.push(d);
      else out.set(t, [d]);
    }
  }
  return out;
}

/**
 * Accoppia i nomi squadra fra le due fonti confrontando i calendari.
 * Tolleranza di un giorno: Understat marca l'orario locale, Football-Data la
 * data di gioco, e una partita in tarda serata puo cadere sul giorno dopo.
 */
export function matchTeamsByCalendar(
  understat: readonly UnderstatFixture[],
  target: readonly TargetFixture[],
): Map<string, string> {
  const cu = calendars(understat);
  const ct = calendars(target);
  const scored: Array<{ score: number; u: string; t: string }> = [];
  for (const [u, du] of cu) {
    for (const [t, dt] of ct) {
      let overlap = 0;
      for (const d of du) {
        if (dt.some((z) => Math.abs(z - d) <= 1)) overlap += 1;
      }
      scored.push({
        score: overlap / Math.max(1, du.length) + 0.3 * nameSimilarity(u, t),
        u,
        t,
      });
    }
  }
  scored.sort((a, b) => b.score - a.score || (a.u < b.u ? -1 : 1));
  const map = new Map<string, string>();
  const taken = new Set<string>();
  for (const s of scored) {
    if (map.has(s.u) || taken.has(s.t)) continue;
    map.set(s.u, s.t);
    taken.add(s.t);
  }
  return map;
}

/**
 * Restituisce, per ogni chiave di destinazione, gli xG della partita.
 * Le righe in cui i gol delle due fonti non coincidono vengono scartate.
 */
export function joinUnderstatXg(
  understat: readonly UnderstatFixture[],
  target: readonly TargetFixture[],
): { xg: Map<string, { hxg: number; axg: number }>; report: JoinReport } {
  const map = matchTeamsByCalendar(understat, target);
  const byPair = new Map<string, TargetFixture[]>();
  for (const t of target) {
    const k = `${t.home}\u0000${t.away}`;
    const cur = byPair.get(k);
    if (cur) cur.push(t);
    else byPair.set(k, [t]);
  }

  const xg = new Map<string, { hxg: number; axg: number }>();
  let rejectedGoals = 0;
  let ambiguous = 0;
  for (const u of understat) {
    const h = map.get(u.home);
    const a = map.get(u.away);
    if (!h || !a) {
      ambiguous += 1;
      continue;
    }
    const d = dayNumber(u.date);
    const cands = (byPair.get(`${h}\u0000${a}`) ?? []).filter(
      (c) => Math.abs(dayNumber(c.date) - d) <= 2,
    );
    if (cands.length !== 1) {
      ambiguous += 1;
      continue;
    }
    const c = cands[0]!;
    if (c.goalsHome !== u.goalsHome || c.goalsAway !== u.goalsAway) {
      rejectedGoals += 1;
      continue;
    }
    xg.set(c.key, { hxg: u.xgHome, axg: u.xgAway });
  }

  return {
    xg,
    report: {
      understat: understat.length,
      target: target.length,
      joined: xg.size,
      rejectedGoals,
      ambiguous,
    },
  };
}
