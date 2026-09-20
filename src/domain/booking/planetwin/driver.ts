/**
 * DRIVER PLANETWIN365 — compone la schedina e riporta il codice di prenotazione.
 *
 * Gira su un Chromium reale, dalla connessione di casa. Non è una scelta di
 * stile: sisal.it e planetwin365.it stanno dietro Akamai e rispondono 403 a
 * qualsiasi client che non arrivi da un IP residenziale. Misurato il 20/09/2026
 * da tre ambienti diversi, curl e Chromium reale compresi.
 *
 * Cosa NON fa, per costruzione:
 *   - non fa login e non tocca credenziali;
 *   - non preme mai SCOMMETTI: l'unico bottone che conosce è PRENOTA, e il
 *     passo irreversibile — pagare alla cassa — resta a chi gioca;
 *   - non prenota un biglietto parziale: se anche una sola gamba non si trova o
 *     la sua quota è peggiorata oltre la tolleranza, non prenota niente.
 *
 * L'ultimo punto è il motivo per cui il modulo esiste. Comporre a mano un
 * listone lungo sbaglia raramente in modo vistoso e spesso in modo invisibile:
 * la riga sotto, la linea sbagliata, la quota di dieci minuti fa. Qui ogni
 * gamba viene riletta dalla schedina dopo il clic e confrontata con quella
 * decisa, e il biglietto o è esattamente quello o non esiste.
 */
import type { Browser, Locator, Page } from "playwright";
import { locateSelection, type CatalogEntry } from "@/domain/booking/planetwin/catalog";
import {
  BIN_ATTR,
  findCellInPage,
  markSearchNode,
  markSlipBin,
  NAV_ATTR,
  TARGET_ATTR,
  type BinHit,
  type CellHit,
  type NavHit,
} from "@/domain/booking/planetwin/cell-finder";
import {
  BookingError,
  DEFAULT_ODDS_TOLERANCE,
  driftIsAcceptable,
  oddsDrift,
  type BookedTicket,
  type PlacedLeg,
  type TicketLeg,
} from "@/domain/booking/types";

const BOOKMAKER = "Planetwin365";
/**
 * La sezione scommesse, non la homepage: la casella di ricerca esiste solo qui.
 * Partire dalla home costava 15s di attesa su un elemento che non c'è.
 */
const SPORT_PAGE = "https://www.planetwin365.it/scommesse/sport/";
/** Il nodo sport da aprire nell'albero filtrato. Escludo "ANTEPOST CALCIO" e "GIOCATORI CALCIO". */
const SPORT_NODE = /^\s*CALCIO\s*$/i;
/** Quante competizioni provare prima di arrendersi. */
const MAX_COMPETITIONS = 6;

/** L'unico bottone che questo driver ha il permesso di premere. */
const BOOK_BUTTON = "PRENOTA";
/** Bottoni che impegnano denaro. Se un selettore ne raggiunge uno, è un bug. */
const FORBIDDEN_BUTTONS = ["SCOMMETTI", "GIOCA", "CONFERMA GIOCATA", "DEPOSITA"] as const;

export type BookingOptions = {
  readonly tolerance?: number;
  /** Chromium a vista: lasciato acceso di default, così la composizione si guarda mentre accade. */
  readonly headless?: boolean;
  readonly timeoutMs?: number;
  /** Profilo persistente, per non ripassare dal banner cookie ogni volta. */
  readonly profileDir?: string;
};

/** Legge una quota dal testo di una cella. "3.20" → 3.2 */
export function parseOdds(text: string): number {
  const m = /(\d+[.,]\d{1,2})/.exec(text.trim());
  const raw = m?.[1];
  if (raw === undefined) throw new BookingError(`quota non leggibile da "${text}"`);
  const n = Number(raw.replace(",", "."));
  if (!Number.isFinite(n) || n <= 1) {
    throw new BookingError(`quota fuori range da "${text}": ${n}`);
  }
  return n;
}

/**
 * La quota totale che la schedina DEVE mostrare: il prodotto delle gambe.
 *
 * È il controllo che rende innocuo un clic finito dove non doveva. Contare le
 * gambe con un selettore è fragile; il prodotto no — una gamba in più o in
 * meno lo cambia, e il biglietto viene rifiutato invece che prenotato sbagliato.
 */
export function expectedTotalOdds(odds: readonly number[]): number {
  if (odds.length === 0) throw new BookingError("nessuna gamba da moltiplicare");
  return odds.reduce((acc, o) => acc * o, 1);
}

/** Il book arrotonda a due decimali a ogni passo: la tolleranza deve reggerlo. */
export function totalOddsMatches(shown: number, expected: number): boolean {
  if (!Number.isFinite(shown) || shown <= 1) return false;
  return Math.abs(shown - expected) / expected < 0.01;
}

/** Normalizza il codice emesso: "RE 02 79 89 19 53" → "RE0279891953". */
export function normalizeBookingCode(raw: string): string {
  const code = raw.replace(/\s+/g, "").toUpperCase();
  if (!/^[A-Z]{0,3}\d{8,16}$/.test(code)) {
    throw new BookingError(`codice di prenotazione non riconosciuto: "${raw}"`);
  }
  return code;
}

/** Il biglietto proposto è componibile? Solleva sulla prima gamba che non lo è. */
export function planTicket(legs: readonly TicketLeg[]): readonly CatalogEntry[] {
  if (legs.length === 0) throw new BookingError("biglietto vuoto");
  const seen = new Set<string>();
  for (const leg of legs) {
    const key = `${leg.event}|${leg.selection}`;
    if (seen.has(key)) {
      throw new BookingError(`gamba duplicata: ${key}`);
    }
    seen.add(key);
  }
  return legs.map((leg) => locateSelection(leg.selection));
}

/**
 * Il widget di consenso non è solo un fastidio visivo: porta con sé una propria
 * casella di ricerca ("Ricerca nell'elenco dei cookie"), nascosta ma presente
 * nel DOM. Un selettore generico sulla ricerca la aggancia e aspetta per sempre
 * un input che non diventerà mai visibile. Va tolto di mezzo per primo, e i
 * selettori successivi devono comunque escluderlo.
 */
const CONSENT_DECLINE = [
  /continua senza accettare/i,
  /rifiuta tutt/i,
  /solo (i )?necessari/i,
];

/**
 * Le barre fisse del sito — il banner legale, "Gioca Intelligente", l'header —
 * restano sopra a tutto e intercettano i clic: Playwright scrolla l'elemento
 * nella vista, ci trova sopra un overlay e riprova finche' scade il timeout.
 * Non vanno nascoste (servono a chi guarda), va tolto il posizionamento fisso
 * che le fa galleggiare sopra il contenuto.
 */
/**
 * Definisce nella pagina l'helper __name.
 *
 * tsx compila con esbuild, che avvolge le funzioni in __name(fn, "nome") per
 * conservarne il nome nei tracciati. Playwright serializza il sorgente della
 * funzione e lo esegue nel browser, dove quell'helper non esiste: senza questo,
 * ogni page.evaluate di una nostra funzione muore con
 * "ReferenceError: __name is not defined".
 *
 * Passato come stringa perche' una funzione verrebbe avvolta a sua volta, ed è
 * proprio quello che stiamo rimediando.
 */
const NAME_HELPER = "window.__name = window.__name || function (f) { return f; };";

async function installEvaluateHelpers(page: Page): Promise<void> {
  await page.addInitScript(NAME_HELPER).catch(() => undefined);
  await page.evaluate(NAME_HELPER).catch(() => undefined);
}

async function neutraliseOverlays(page: Page): Promise<void> {
  await installEvaluateHelpers(page);
  await page
    .addStyleTag({
      content: `
        .legal--container, app-header, .discipline-container,
        [class*="sticky"], [class*="banner"] {
          position: static !important;
        }
        #onetrust-consent-sdk, [id*="onetrust"] { display: none !important; }
      `,
    })
    .catch(() => undefined);
}

/**
 * Clic che non si lascia bloccare da un overlay residuo.
 *
 * Prima il clic vero, con tutti i controlli di Playwright. Se un overlay lo
 * intercetta comunque, il fallback invoca il gestore direttamente sull'elemento:
 * salta il test di collisione, non la logica della pagina. Non uso force:true
 * perche' quello spara il clic alle coordinate e puo' colpire l'overlay.
 */
async function safeClick(target: Locator, timeout: number): Promise<void> {
  try {
    await target.click({ timeout: Math.min(timeout, 8_000) });
    return;
  } catch (first) {
    const handled = await target
      .evaluate((el) => {
        (el as HTMLElement).click();
        return true;
      })
      .catch(() => false);
    if (!handled) throw first;
  }
}

async function dismissCookieBanner(page: Page): Promise<void> {
  for (const label of CONSENT_DECLINE) {
    const button = page.getByText(label).first();
    if (await button.isVisible().catch(() => false)) {
      await button.click().catch(() => undefined);
      await page.waitForTimeout(600);
      return;
    }
  }
}

/**
 * La casella di ricerca del sito: visibile, e non quella del widget cookie.
 * Entrambe le condizioni servono — l'esclusione per id da sola non basta se il
 * widget cambia nome, la visibilità da sola non basta se il banner è aperto.
 */
const SEARCH_CANDIDATES = [
  'input[type="search"]',
  'input[placeholder*="erca" i]',
  'input[aria-label*="erca" i]',
];
/** Gli input del widget di consenso, da escludere ovunque. */
const CONSENT_INPUT_EXCLUSIONS = [
  ':not([aria-label*="cookie" i])',
  ':not([id*="vendor" i])',
  ':not([id*="onetrust" i])',
].join("");

export function searchSelector(): string {
  return SEARCH_CANDIDATES.map((c) => c + CONSENT_INPUT_EXCLUSIONS).join(", ");
}

function siteSearchBox(page: Page): Locator {
  // Le esclusioni vanno attaccate a OGNI candidato nella stessa stringa CSS:
  // concatenare un .locator(":not(...)") cercherebbe i discendenti dell'input,
  // non filtrerebbe l'input stesso.
  return page.locator(searchSelector()).filter({ visible: true }).first();
}

/** "Fiorentina - Napoli" → ["Fiorentina", "Napoli"] */
export function splitEvent(event: string): readonly [string, string] {
  const parts = event.split(/\s+[-–—vs.]+\s+/i).map((p) => p.trim()).filter(Boolean);
  const home = parts[0];
  const away = parts[1];
  if (home === undefined || away === undefined) {
    throw new BookingError(`nome evento non interpretabile: "${event}" — atteso "Casa - Ospite"`);
  }
  return [home, away];
}

/**
 * I nodi dell'albero comparsi sotto la ricerca, letti dalla regione delimitata.
 * Nessun clic qui: solo lettura.
 */
async function searchResultNodes(page: Page): Promise<readonly string[]> {
  await installEvaluateHelpers(page);
  const hit = (await page.evaluate(markSearchNode, { text: null, attr: NAV_ATTR })) as NavHit;
  return hit.kind === "absent" ? hit.available : [];
}

/**
 * Clicca un nodo dell'albero. Il nodo viene prima marcato DENTRO la regione dei
 * risultati, poi cliccato per attributo: un getByText non delimitato finirebbe
 * nel pannello schedina, dove gli stessi testi compaiono accanto a una "×" che
 * rimuove la gamba.
 */
async function clickSearchNode(page: Page, text: string, timeout: number): Promise<boolean> {
  await installEvaluateHelpers(page);
  const hit = (await page.evaluate(markSearchNode, { text, attr: NAV_ATTR })) as NavHit;
  if (hit.kind !== "marked") return false;
  const marked = page.locator(`[${NAV_ATTR}="1"]`).first();
  if (!(await marked.isVisible().catch(() => false))) return false;
  await safeClick(marked, timeout);
  return true;
}

/** Nodi che non portano mai a una partita: antepost, capocannonieri, giocatori. */
const NON_EVENT_NODE = /antepost|capocann|giocator|marcator/i;

/**
 * Svuota la schedina prima di cominciare. Il book la conserva tra le sessioni:
 * un residuo di ieri finirebbe dentro il biglietto di oggi senza che nessuno
 * se ne accorga.
 */
async function clearSlip(page: Page, timeout: number): Promise<void> {
  await page.goto(SPORT_PAGE, { waitUntil: "domcontentloaded", timeout });
  await dismissCookieBanner(page);
  await neutraliseOverlays(page);

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const body = await page.locator("body").innerText().catch(() => "");
    if (parseSlipTotal(body) === null) return;

    const hit = (await page.evaluate(markSlipBin, { attr: BIN_ATTR })) as BinHit;
    if (hit.kind !== "marked") {
      throw new BookingError(
        "schedina non vuota e cestino non trovato — svuotala a mano prima di riprovare",
        { residuo: parseSlipTotal(body), dentro_la_schedina: hit.insideSlip.slice(0, 20) },
      );
    }
    await safeClick(page.locator(`[${BIN_ATTR}="1"]`).first(), timeout);
    await page.waitForTimeout(900);
  }

  const body = await page.locator("body").innerText().catch(() => "");
  const residuo = parseSlipTotal(body);
  if (residuo !== null) {
    throw new BookingError(
      `la schedina contiene ancora qualcosa (quota ${residuo}) dopo tre tentativi di svuotarla`,
      { residuo },
    );
  }
}

async function openEvent(page: Page, event: string, timeout: number): Promise<void> {
  const [home, away] = splitEvent(event);
  const leafText = `${home} - ${away}`;

  await page.goto(SPORT_PAGE, { waitUntil: "domcontentloaded", timeout });
  await dismissCookieBanner(page);
  await neutraliseOverlays(page);

  const search = siteSearchBox(page);
  try {
    await search.waitFor({ state: "visible", timeout: Math.min(timeout, 15_000) });
  } catch {
    throw new BookingError("casella di ricerca non trovata sulla pagina scommesse", {
      evento: event,
      pagina: SPORT_PAGE,
    });
  }
  await search.fill(home);
  await page.waitForTimeout(1500);

  // La ricerca non restituisce eventi: filtra l'albero di navigazione, e i nodi
  // restano CHIUSI. L'evento è una foglia in fondo a sport → competizione →
  // evento, e solo la foglia porta il nome unito "Casa - Ospite".
  // Si prova direttamente a cliccare la foglia; se non c'è ancora, si apre un
  // nodo e si riprova. Nessuna sonda separata di visibilità: marcare e cliccare
  // sono la stessa operazione, e una sonda globale è proprio ciò che finiva nel
  // pannello schedina cancellando una gamba.
  const visited = new Set<string>();
  let found = false;

  for (let round = 0; round < MAX_COMPETITIONS; round += 1) {
    if (await clickSearchNode(page, leafText, timeout)) {
      found = true;
      break;
    }
    const nodes = await searchResultNodes(page);
    const next = nodes.find(
      (t) => !visited.has(t) && t !== leafText && !NON_EVENT_NODE.test(t) && t.length > 2,
    );
    if (next === undefined) break;
    visited.add(next);
    await clickSearchNode(page, next, timeout).catch(() => false);
    await page.waitForTimeout(800);
  }

  if (!found) {
    throw new BookingError(`evento non trovato nell'albero: "${event}"`, {
      cercato: home,
      foglia_attesa: leafText,
      nodi_visitati: [...visited],
      suggerimento: "usa i nomi esattamente come li scrive Planetwin365",
    });
  }

  await page.waitForLoadState("domcontentloaded", { timeout });
  await neutraliseOverlays(page);

  const body = await page.locator("body").innerText();
  const onRightEvent =
    new RegExp(escapeRegExp(home), "i").test(body) && new RegExp(escapeRegExp(away), "i").test(body);
  if (!onRightEvent) {
    throw new BookingError(`aperta la pagina sbagliata per "${event}"`);
  }
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function clickOutcome(page: Page, entry: CatalogEntry, timeout: number): Promise<number> {
  const tab = page.getByRole("tab", { name: new RegExp(`^${escapeRegExp(entry.tab)}$`, "i") }).first();
  if (await tab.isVisible().catch(() => false)) {
    await safeClick(tab, timeout);
  } else {
    const fallback = page.getByText(new RegExp(`^\\s*${escapeRegExp(entry.tab)}\\s*$`, "i")).first();
    await safeClick(fallback, timeout);
  }
  await page.waitForTimeout(900);

  // Il DOM decide QUALE cella, e la marca. Il clic resta un clic vero, fatto da
  // Playwright sull'attributo: non ci si fida della pagina per l'azione, solo
  // per l'identificazione — che è l'unica cosa che le classi Angular rendono
  // impossibile fare da fuori.
  await installEvaluateHelpers(page);
  const hit = (await page.evaluate(findCellInPage, {
    block: entry.block,
    outcome: entry.outcome,
    line: entry.line ?? null,
    attr: TARGET_ATTR,
  })) as CellHit;

  const where = `${entry.tab} → ${entry.block}${entry.line ? ` (${entry.line})` : ""} → ${entry.outcome}`;

  if (hit.kind === "no-block") {
    throw new BookingError(`blocco mercato non trovato: ${where}`, {
      blocchi_visti: hit.blocksSeen.slice(0, 30),
    });
  }
  if (hit.kind === "no-cell") {
    throw new BookingError(`cella non trovata dentro il blocco: ${where}`, {
      celle_viste: hit.cellsSeen.slice(0, 30),
    });
  }

  const marked = page.locator(`[${TARGET_ATTR}="1"]`).first();
  await marked.waitFor({ state: "visible", timeout: Math.min(timeout, 10_000) });
  await safeClick(marked, timeout);
  return hit.odds;
}

/** La quota totale che la schedina mostra adesso, o null se non la mostra. */
export function parseSlipTotal(bodyText: string): number | null {
  const m = /Quota\s*Tot[^\d]*(\d+[.,]\d+)/i.exec(bodyText);
  const raw = m?.[1];
  if (raw === undefined) return null;
  const n = Number(raw.replace(",", "."));
  return Number.isFinite(n) && n > 1 ? n : null;
}

/**
 * Aspetta che la schedina rifletta le gambe inserite finora.
 *
 * Verificare solo alla fine dice che qualcosa non torna, non QUALE gamba non è
 * entrata: la prima corsa reale si è fermata con "3.25 invece di 9.52" senza
 * modo di sapere se fosse la seconda o la terza. Controllare dopo ogni clic
 * nomina il colpevole, e ferma il lavoro prima di sprecare le gambe successive.
 */
async function waitForSlipTotal(
  page: Page,
  expected: number,
  timeoutMs: number,
): Promise<number | null> {
  const deadline = Date.now() + timeoutMs;
  let last: number | null = null;
  while (Date.now() < deadline) {
    const body = await page.locator("body").innerText().catch(() => "");
    last = parseSlipTotal(body);
    if (last !== null && totalOddsMatches(last, expected)) return last;
    await page.waitForTimeout(400);
  }
  return last;
}

/** Rilegge la schedina e verifica che contenga esattamente le gambe decise. */
async function verifySlip(
  page: Page,
  legs: readonly TicketLeg[],
  taken: readonly number[],
  tolerance: number,
): Promise<readonly PlacedLeg[]> {
  const placed: PlacedLeg[] = [];
  const rejected: string[] = [];

  legs.forEach((leg, i) => {
    const takenOdds = taken[i];
    if (takenOdds === undefined) {
      rejected.push(`${leg.event} ${leg.selection}: quota non letta`);
      return;
    }
    const drift = oddsDrift(leg.expectedOdds, takenOdds);
    if (!driftIsAcceptable(drift, tolerance)) {
      rejected.push(
        `${leg.event} ${leg.selection}: attesa ${leg.expectedOdds}, presa ${takenOdds} (${(drift * 100).toFixed(1)}%)`,
      );
      return;
    }
    placed.push({ ...leg, takenOdds, drift });
  });

  if (rejected.length > 0) {
    throw new BookingError(
      `quote mosse oltre la tolleranza su ${rejected.length} gamba/e — biglietto non prenotato`,
      { rejected },
    );
  }

  // Controllo aritmetico: la quota totale mostrata dal book deve essere il
  // prodotto delle gambe che abbiamo messo noi. Se un clic è finito su una
  // cella sbagliata, o se la schedina si portava dietro un residuo, il prodotto
  // non torna e il biglietto non parte.
  const expected = expectedTotalOdds(placed.map((p) => p.takenOdds));
  const body = await page.locator("body").innerText();
  const shown = Number(
    /Quota\s*Tot[^\d]*(\d+[.,]\d+)/i.exec(body)?.[1]?.replace(",", ".") ?? "0",
  );
  if (shown > 0 && !totalOddsMatches(shown, expected)) {
    throw new BookingError(
      `la schedina mostra quota ${shown} invece di ${expected.toFixed(2)} — contiene qualcosa che non abbiamo messo noi`,
      { attesa: Number(expected.toFixed(2)), mostrata: shown, gambe: placed.length },
    );
  }
  return placed;
}

async function pressBookButton(page: Page, timeout: number): Promise<void> {
  const button = page.getByRole("button", { name: new RegExp(`^\\s*${BOOK_BUTTON}\\s*$`, "i") }).first();
  const visible = await button.isVisible().catch(() => false);
  const target = visible
    ? button
    : page.getByText(new RegExp(`^\\s*${BOOK_BUTTON}\\s*$`, "i")).first();

  const label = (await target.innerText().catch(() => "")).trim().toUpperCase();
  if (FORBIDDEN_BUTTONS.some((f) => label.includes(f))) {
    throw new BookingError(`rifiutato: il selettore ha raggiunto "${label}", non ${BOOK_BUTTON}`);
  }
  if (!label.includes(BOOK_BUTTON)) {
    throw new BookingError(`bottone ${BOOK_BUTTON} non trovato (letto "${label}")`);
  }
  await safeClick(target, timeout);
}

async function readBookingCode(page: Page, timeout: number): Promise<{ code: string; expiry: string }> {
  const panel = page.getByText(/PRENOTAZIONE CONFERMATA|La tua prenotazione/i).first();
  await panel.waitFor({ state: "visible", timeout });

  const body = await page.locator("body").innerText();
  const matched = /\b([A-Z]{2}\s?(?:\d{2}\s?){5})\b/.exec(body)?.[1];
  if (matched === undefined) {
    throw new BookingError("prenotazione confermata ma codice non leggibile");
  }
  const expiry = /IL TUO CODICE VALIDO PER ([^\n]+)/i.exec(body)?.[1]?.trim()
    ?? /SCADENZA\s*\n?\s*([^\n]+)/i.exec(body)?.[1]?.trim()
    ?? "non indicata";

  return { code: normalizeBookingCode(matched), expiry };
}

/**
 * Compone il biglietto su Planetwin365 e restituisce il codice di prenotazione.
 * Non prenota nulla se anche una sola gamba non corrisponde a quella decisa.
 */
export async function bookTicket(
  legs: readonly TicketLeg[],
  options: BookingOptions = {},
): Promise<BookedTicket> {
  const tolerance = options.tolerance ?? DEFAULT_ODDS_TOLERANCE;
  const timeout = options.timeoutMs ?? 45_000;
  const entries = planTicket(legs);

  const { chromium } = await import("playwright");
  let browser: Browser | undefined;
  let page: Page;

  if (options.profileDir) {
    const ctx = await chromium.launchPersistentContext(options.profileDir, {
      headless: options.headless ?? false,
      locale: "it-IT",
      timezoneId: "Europe/Rome",
    });
    page = ctx.pages()[0] ?? (await ctx.newPage());
  } else {
    browser = await chromium.launch({ headless: options.headless ?? false });
    const ctx = await browser.newContext({ locale: "it-IT", timezoneId: "Europe/Rome" });
    page = await ctx.newPage();
  }

  try {
    await clearSlip(page, timeout);
    const taken: number[] = [];
    for (let i = 0; i < legs.length; i += 1) {
      const leg = legs[i]!;
      await openEvent(page, leg.event, timeout);
      taken.push(await clickOutcome(page, entries[i]!, timeout));

      const atteso = expectedTotalOdds(taken);
      const mostrato = await waitForSlipTotal(page, atteso, 8_000);
      if (mostrato === null || !totalOddsMatches(mostrato, atteso)) {
        throw new BookingError(
          `la gamba ${i + 1} non è entrata nella schedina: ${leg.event} ${leg.selection}`,
          {
            gamba: i + 1,
            evento: leg.event,
            selezione: leg.selection,
            quota_letta_sulla_cella: taken[i],
            schedina_attesa: Number(atteso.toFixed(2)),
            schedina_mostrata: mostrato,
            gambe_entrate_finora: i,
          },
        );
      }
    }

    const placed = await verifySlip(page, legs, taken, tolerance);
    await pressBookButton(page, timeout);
    const { code, expiry } = await readBookingCode(page, timeout);

    const body = await page.locator("body").innerText();
    const totalOdds = Number(/Quota Tot[^\d]*(\d+[.,]\d+)/i.exec(body)?.[1]?.replace(",", ".") ?? "0");
    const bonus = Number(/Bonus[^\d]*(\d+[.,]\d+)/i.exec(body)?.[1]?.replace(",", ".") ?? "0");

    return {
      bookmaker: BOOKMAKER,
      code,
      bookedAt: new Date().toISOString(),
      expiry,
      legs: placed,
      totalOdds,
      bonus,
    };
  } finally {
    await page.context().close().catch(() => undefined);
    await browser?.close().catch(() => undefined);
  }
}
