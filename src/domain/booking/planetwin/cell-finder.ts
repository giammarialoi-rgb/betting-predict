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


/** L'attributo con cui viene marcato un nodo dell'albero di ricerca. */
export const NAV_ATTR = "data-betmind-nav";

export type NavHit =
  | { readonly kind: "marked"; readonly text: string }
  | { readonly kind: "absent"; readonly available: readonly string[] };

/**
 * Marca un nodo DENTRO i risultati della ricerca, e solo lì.
 *
 * Cliccare per testo su tutta la pagina è pericoloso qui: il pannello schedina
 * ripete gli stessi testi — nome squadra, campionato — e ogni gamba ha la sua
 * "×" per rimuoverla. Un getByText(...).first() non scoped finisce lì dentro e
 * CANCELLA una gamba già inserita, in silenzio. È successo: la gamba 1 spariva
 * mentre si cercava l'evento della gamba 2.
 *
 * La regione è delimitata da "Ricerca per eventi sportivi" sopra e
 * "Campionati:" sotto. Se le ancore non si trovano, non si clicca niente.
 */
export function markSearchNode(query: {
  text: string | null;
  attr: string;
  /**
   * Le due squadre, per l'abbinamento tollerante.
   *
   * Serve perche' i nomi differiscono tra i sistemi: lo storico dice
   * "Fiorentina", The Odds API "ACF Fiorentina", il book scrive
   * "Fiorentina - Napoli". Un confronto letterale fallisce su differenze che
   * per una persona non esistono. Si richiede comunque che ENTRAMBE compaiano:
   * abbinare una partita sbagliata non dà errore, dà una scommessa sbagliata.
   */
  teams?: readonly [string, string] | null;
}): NavHit {
  const { text, attr, teams } = query;
  const norm = (s: string | null): string => (s ?? "").replace(/\s+/g, " ").trim();
  const visible = (e: Element): boolean => e.getClientRects().length > 0;

  document.querySelectorAll("[" + attr + "]").forEach((e) => e.removeAttribute(attr));

  const input = document.querySelector('input[placeholder="Ricerca" i]');
  if (!input) return { kind: "absent", available: [] };

  // ZONA VIETATA: il pannello schedina. È l'unico posto dove un clic fa danno,
  // perche' ripete gli stessi nomi degli eventi accanto alla "×" che rimuove la
  // gamba. Definire per esclusione invece che per inclusione: una regione
  // delimitata da ancore di testo si rompe appena il book cambia una scritta,
  // e quando si rompe non si trova più niente. Questa regge finche' la schedina
  // resta riconoscibile, e se non la si riconosce si rinuncia del tutto.
  const slipMarker = Array.from(document.querySelectorAll("*")).find((e) => {
    const t = norm(e.textContent).toUpperCase();
    return e.children.length === 0 && (t === "BETSCANNER" || t === "SCHEDINA");
  });
  let forbidden: Element | null = null;
  if (slipMarker) {
    let node: Element | null = slipMarker.parentElement;
    // Il contenitore più ampio della schedina che NON contiene la ricerca.
    while (node && !node.contains(input)) {
      forbidden = node;
      node = node.parentElement;
    }
  }

  // Si cerca su tutta la pagina. Restringere al contenitore del form non
  // funziona: lì dentro ci sono solo le due iconcine "search" e "close", i
  // risultati vivono altrove nel DOM. La sicurezza non viene più da DOVE si
  // cerca ma da dove NON si clicca, ed è la zona vietata a garantirla.
  const candidates = Array.from(document.body.querySelectorAll("*")).filter(
    (e) =>
      e.children.length === 0 &&
      visible(e) &&
      norm(e.textContent).length > 0 &&
      norm(e.textContent).length < 80 &&
      !(forbidden && forbidden.contains(e)) &&
      e !== input,
  );

  const available: string[] = [];
  for (const e of candidates) {
    const t = norm(e.textContent);
    if (!available.includes(t)) available.push(t);
    if (available.length >= 200) break;
  }

  if (text === null) return { kind: "absent", available };

  const semplifica = (v: string): string =>
    v
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();

  let hit = candidates.find((e) => norm(e.textContent) === norm(text));

  if (!hit && teams) {
    const [casa, ospite] = teams;
    const a = semplifica(casa);
    const b = semplifica(ospite);
    // Il nome più lungo di ciascuna squadra è spesso un sovrainsieme dell'altro
    // ("ACF Fiorentina" contro "Fiorentina"): basta che la parola più
    // caratterizzante di entrambe compaia nel nodo.
    const chiave = (v: string): string =>
      v.split(" ").sort((x, y) => y.length - x.length)[0] ?? v;
    const ka = chiave(a);
    const kb = chiave(b);
    if (ka.length >= 4 && kb.length >= 4) {
      hit = candidates.find((e) => {
        const t = semplifica(norm(e.textContent));
        return t.includes(ka) && t.includes(kb);
      });
    }
  }

  if (!hit) return { kind: "absent", available };
  if (forbidden && forbidden.contains(hit)) return { kind: "absent", available };
  hit.setAttribute(attr, "1");
  return { kind: "marked", text: norm(hit.textContent) };
}

/** L'attributo con cui viene marcato il cestino della schedina. */
export const BIN_ATTR = "data-betmind-bin";

export type BinHit =
  | { readonly kind: "marked"; readonly label: string }
  | { readonly kind: "absent"; readonly insideSlip: readonly string[] };

/**
 * Marca il cestino DENTRO il pannello schedina.
 *
 * Il cestino non ha una classe riconoscibile: è un'icona Material, cioè un
 * elemento il cui TESTO è la legatura ("delete_outline"). Cercarlo per classe
 * non trovava nulla e la schedina non veniva mai svuotata — una gamba di una
 * corsa precedente restava dentro e finiva nel biglietto successivo.
 *
 * È l'unico punto in cui si clicca volontariamente nel pannello schedina,
 * quindi qui il pannello va trovato, non evitato.
 */
export function markSlipBin(query: { attr: string }): BinHit {
  const { attr } = query;
  const norm = (s: string | null): string => (s ?? "").replace(/\s+/g, " ").trim();
  const visible = (e: Element): boolean => e.getClientRects().length > 0;

  document.querySelectorAll("[" + attr + "]").forEach((e) => e.removeAttribute(attr));

  const input = document.querySelector('input[placeholder="Ricerca" i]');
  const marker = Array.from(document.querySelectorAll("*")).find((e) => {
    const t = norm(e.textContent).toUpperCase();
    return e.children.length === 0 && (t === "BETSCANNER" || t === "SCHEDINA");
  });
  if (!marker) return { kind: "absent", insideSlip: [] };

  let panel: Element | null = null;
  let node: Element | null = marker.parentElement;
  while (node && (!input || !node.contains(input))) {
    panel = node;
    node = node.parentElement;
  }
  if (!panel) return { kind: "absent", insideSlip: [] };

  const insideSlip: string[] = [];
  for (const e of Array.from(panel.querySelectorAll("*"))) {
    if (e.children.length !== 0 || !visible(e)) continue;
    const t = norm(e.textContent);
    if (t && t.length < 40 && !insideSlip.includes(t)) insideSlip.push(t);
    if (insideSlip.length >= 40) break;
  }

  // Il cestino è un BUTTON senza testo — l'icona è un'immagine, non una
  // legatura. Verificato sulla pagina vera: la barra strumenti della schedina
  // ha tre bottoni senza nome e l'ultimo svuota tutto. Cercarlo per legatura
  // testuale non trovava niente e lo svuotamento falliva in silenzio.
  const bare = Array.from(panel.querySelectorAll("button")).filter(
    (b) => visible(b) && norm(b.textContent).length === 0,
  );
  const bin = bare[bare.length - 1];
  if (!bin) return { kind: "absent", insideSlip };
  bin.setAttribute(attr, "1");
  return { kind: "marked", label: "bottone senza nome #" + bare.length };
}

export type SlipContents = {
  readonly total: number | null;
  readonly lines: readonly string[];
  readonly found: boolean;
};

/**
 * Cosa c'è dentro la schedina, in chiaro.
 *
 * Un totale da solo non basta a capire cosa è andato storto: "1.60" può essere
 * un residuo, una gamba sbagliata o la gamba giusta con la quota mossa, e
 * distinguerli richiedeva una corsa per ipotesi. Questo restituisce le righe.
 */
export function readSlipContents(): SlipContents {
  const norm = (s: string | null): string => (s ?? "").replace(/\s+/g, " ").trim();
  const visible = (e: Element): boolean => e.getClientRects().length > 0;

  const input = document.querySelector('input[placeholder="Ricerca" i]');
  const marker = Array.from(document.querySelectorAll("*")).find((e) => {
    const t = norm(e.textContent).toUpperCase();
    return e.children.length === 0 && (t === "BETSCANNER" || t === "SCHEDINA");
  });
  if (!marker) return { total: null, lines: [], found: false };

  let panel: Element | null = null;
  let node: Element | null = marker.parentElement;
  while (node && (!input || !node.contains(input))) {
    panel = node;
    node = node.parentElement;
  }
  if (!panel) return { total: null, lines: [], found: false };

  const lines: string[] = [];
  for (const e of Array.from(panel.querySelectorAll("*"))) {
    if (e.children.length !== 0 || !visible(e)) continue;
    const t = norm(e.textContent);
    if (t && t.length < 60 && !lines.includes(t)) lines.push(t);
    if (lines.length >= 60) break;
  }

  const whole = norm(panel.textContent);
  const m = /Quota\s*Tot[^\d]*(\d+[.,]\d+)/i.exec(whole);
  const raw = m?.[1];
  const total = raw === undefined ? null : Number(raw.replace(",", "."));

  return { total: Number.isFinite(total as number) ? total : null, lines, found: true };
}
