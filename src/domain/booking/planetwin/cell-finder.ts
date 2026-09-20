/**
 * TROVA LA CELLA — senza dipendere dai nomi delle classi.
 *
 * Sulla pagina partita le celle delle quote non sono bottoni: sono div con un
 * gestore di clic, invisibili all'albero di accessibilità. Non hanno un ruolo
 * da cercare, e le loro classi sono generate da Angular (_ngcontent-...), cioè
 * cambiano a ogni build del book.
 *
 * Quindi non si cerca il markup, si cerca la FORMA: un titolo di blocco, e
 * dentro quel blocco un elemento che contiene un'etichetta di esito e un
 * numero decimale. Questa forma sopravvive a un rifacimento del CSS.
 *
 * La funzione gira dentro la pagina, marca la cella trovata con un attributo e
 * restituisce la quota letta. Il clic lo fa poi Playwright sull'attributo: così
 * il DOM decide QUALE elemento, ma il clic resta un clic vero e verificabile.
 */

/** L'attributo con cui la cella viene marcata prima del clic. */
export const TARGET_ATTR = "data-betmind-target";

export type CellQuery = {
  readonly block: string;
  readonly outcome: string;
  readonly line?: string;
};

export type CellHit =
  | { readonly kind: "found"; readonly odds: number; readonly cellText: string }
  | { readonly kind: "no-block"; readonly blocksSeen: readonly string[] }
  | { readonly kind: "no-cell"; readonly cellsSeen: readonly string[] };

/** Estrae la quota da un testo di cella. Esportata per poterla provare senza browser. */
export function oddsFromCellText(text: string): number | null {
  const m = /(\d+[.,]\d{1,2})\s*$/.exec(text.replace(/\s+/g, " ").trim());
  if (!m?.[1]) return null;
  const n = Number(m[1].replace(",", "."));
  return Number.isFinite(n) && n > 1 ? n : null;
}

/**
 * Il testo di una cella corrisponde all'esito cercato?
 * Accetta "1 3.20" e "O 1.80", rifiuta "10 3.20" e "X 3.40" quando si cerca "1".
 */
export function cellMatchesOutcome(text: string, outcome: string): boolean {
  const t = text.replace(/\s+/g, " ").trim();
  const esc = outcome.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^${esc}\\s+\\d+[.,]\\d{1,2}$`, "i").test(t);
}

/**
 * Gira DENTRO la pagina, via page.evaluate.
 *
 * Deve restare autosufficiente: non può chiudere su niente di questo modulo,
 * perche' Playwright ne serializza il sorgente e lo esegue nel browser, dove
 * questo modulo non esiste. Tutto ciò che le serve arriva da `query`.
 *
 * Passata come FUNZIONE, non come stringa: `page.evaluate(stringa, arg)` NON
 * chiama la stringa con l'argomento, valuta l'espressione e restituisce una
 * funzione non serializzabile, cioè undefined. Verificato, non dedotto.
 */
export function findCellInPage(query: {
  block: string;
  outcome: string;
  line: string | null;
  attr: string;
}): CellHit {
  const { block, outcome, line, attr } = query;
  const norm = (s: string | null): string => (s ?? "").replace(/\s+/g, " ").trim();
  const up = (s: string | null): string => norm(s).toUpperCase();
  const isOdds = (s: string | null): boolean => /^\d+[.,]\d{1,2}$/.test(norm(s));
  const oddsOf = (s: string | null): number => Number(norm(s).replace(",", "."));

  document.querySelectorAll("[" + attr + "]").forEach((e) => e.removeAttribute(attr));

  // Solo ciò che è davvero a schermo. La pagina partita tiene in DOM anche le
  // schede non attive: lì il blocco esiste, la quota si legge, ma il clic non
  // fa niente perche' l'elemento è nascosto — la cella finirebbe marcata e la
  // gamba non entrerebbe mai nella schedina, senza un errore.
  const visible = (e: Element): boolean => e.getClientRects().length > 0;

  const leavesIn = (root: Element): Element[] =>
    Array.from(root.querySelectorAll("*")).filter((e) => e.children.length === 0 && visible(e));
  const oddsLeaves = (root: Element): Element[] =>
    leavesIn(root).filter((e) => isOdds(e.textContent));

  const allLeaves = Array.from(document.querySelectorAll("*")).filter(
    (e) => e.children.length === 0 && visible(e),
  );

  // 1. Il titolo del blocco.
  const headers = allLeaves.filter((e) => up(e.textContent) === up(block));
  if (headers.length === 0) {
    const seen: string[] = [];
    for (const e of allLeaves) {
      const t = norm(e.textContent);
      if (t.length > 2 && t.length < 40 && !isOdds(t) && !seen.includes(t)) seen.push(t);
      if (seen.length >= 60) break;
    }
    return { kind: "no-block", blocksSeen: seen };
  }

  // 2. Il contenitore: primo antenato del titolo con almeno due quote sotto.
  let container: Element | null = null;
  for (const header of headers) {
    let node: Element | null = header.parentElement;
    for (let i = 0; i < 6 && node; i += 1) {
      if (oddsLeaves(node).length >= 2) {
        container = node;
        break;
      }
      node = node.parentElement;
    }
    if (container) break;
  }
  if (!container) return { kind: "no-block", blocksSeen: [block + " (senza quote sotto)"] };

  // 3. Con più linee, restringi alla riga giusta. La riga si trova dalla FOGLIA
  //    che contiene esattamente la linea: nel testo "9.5" e le sue quote sono
  //    concatenate senza spazi ("9.5U1.50O2.35") e non si possono separare.
  let scope: Element = container;
  if (line) {
    const lineLeaf = leavesIn(container).find((e) => norm(e.textContent) === norm(line));
    if (!lineLeaf) {
      const presenti = leavesIn(container)
        .map((e) => norm(e.textContent))
        .filter((t) => /^\d+\.\d$/.test(t));
      return {
        kind: "no-cell",
        cellsSeen: ["linea " + line + " non quotata; presenti: " + presenti.join(", ")],
      };
    }
    let node: Element | null = lineLeaf.parentElement;
    let row: Element | null = null;
    for (let i = 0; i < 4 && node; i += 1) {
      if (oddsLeaves(node).length >= 1) {
        row = node;
        break;
      }
      node = node.parentElement;
    }
    if (!row) return { kind: "no-cell", cellsSeen: ["riga della linea " + line + " senza quote"] };
    scope = row;
  }

  // 4. La cella. Forma principale: etichetta e quota sono elementi SEPARATI.
  //    Si sale dalla foglia dell'esito fino al primo antenato che contiene UNA
  //    quota. Se ne contiene più di una siamo saliti troppo e prenderemmo la
  //    quota di un altro esito.
  let cell: Element | null = null;
  let odds: number | null = null;
  for (const label of leavesIn(scope).filter((e) => up(e.textContent) === up(outcome))) {
    let node: Element | null = label.parentElement;
    for (let i = 0; i < 3 && node; i += 1) {
      const found = oddsLeaves(node);
      if (found.length === 1) {
        cell = node;
        odds = oddsOf(found[0]?.textContent ?? null);
        break;
      }
      if (found.length > 1) break;
      node = node.parentElement;
    }
    if (cell) break;
  }

  // Forma alternativa: etichetta e quota nello stesso elemento, separate da uno
  // spazio. Lo spazio è obbligatorio: senza, "121.30" sarebbe insieme "12" a
  // 1.30 e "1" a 21.30, e non c'è modo di sapere quale dei due.
  if (!cell) {
    const esc = outcome.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp("^" + esc + "\\s+(\\d+[.,]\\d{1,2})$", "i");
    for (const e of leavesIn(scope)) {
      const m = re.exec(norm(e.textContent));
      if (m?.[1]) {
        cell = e;
        odds = oddsOf(m[1]);
        break;
      }
    }
  }

  if (!cell || odds === null || !(odds > 1)) {
    const seen: string[] = [];
    for (const e of leavesIn(scope)) {
      const t = norm(e.textContent);
      if (t && t.length < 30 && !seen.includes(t)) seen.push(t);
      if (seen.length >= 30) break;
    }
    return { kind: "no-cell", cellsSeen: seen };
  }

  if (!visible(cell)) {
    return {
      kind: "no-cell",
      cellsSeen: ["cella trovata ma non visibile: la scheda di mercato non è attiva"],
    };
  }
  cell.setAttribute(attr, "1");
  return { kind: "found", odds, cellText: norm(cell.textContent) };
}
