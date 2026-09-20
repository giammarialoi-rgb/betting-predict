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
  findGridCellInPage,
  markSearchNode,
  markSlipBin,
  NAV_ATTR,
  markStakeField,
  readSlipContents,
  STAKE_ATTR,
  TARGET_ATTR,
  type BinHit,
  type CellHit,
  type NavHit,
  type SlipContents,
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
  /** Importo da scrivere nella schedina. Il book ne propone 3,00 di suo. */
  readonly stake?: number;
  /** Chromium a vista: lasciato acceso di default, così la composizione si guarda mentre accade. */
  readonly headless?: boolean;
  readonly timeoutMs?: number;
  /**
   * Profilo persistente. Sconsigliato: il book conserva la schedina nel
   * profilo, quindi una gamba di ieri si ritrova nel biglietto di oggi. Con un
   * contesto pulito la schedina è vuota per costruzione.
   */
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

/**
 * Ripulisce la scadenza dalle legature delle icone Material.
 *
 * Il book scrive la scadenza accanto a un'icona il cui testo È il nome
 * dell'icona: innerText restituisce "14 GIORNI E 23 ORE schedule". Quel
 * "schedule" finiva stampato all'utente.
 */
export function cleanExpiry(raw: string): string {
  const senzaIcone = raw
    .replace(/\b(schedule|timer|access_time|event|info|help)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  return senzaIcone.length > 0 ? senzaIcone : "non indicata";
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

/**
 * Siamo su una pagina partita, o ancora sul palinsesto?
 *
 * Controllare che i nomi delle squadre compaiano NON basta: compaiono anche
 * nella riga del palinsesto. Il driver si è dichiarato "sulla partita" restando
 * sulla pagina scommesse, e poi ovviamente non trovava il blocco 1X2 — con un
 * elenco di blocchi visti che erano tutti voci di menu.
 *
 * "1X2 Builder" è una scheda di mercato: esiste solo sulla pagina di un evento.
 */
const MATCH_PAGE_MARKERS = [/1X2\s*Builder/i, /CREA\s+SUPERCOMBO/i, /Ris\.\s*Esatto/i];

async function onMatchPage(page: Page): Promise<boolean> {
  const body = await page.locator("body").innerText().catch(() => "");
  return MATCH_PAGE_MARKERS.some((re) => re.test(body));
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
async function clickSearchNode(
  page: Page,
  text: string,
  timeout: number,
  teams?: readonly [string, string],
  skip = 0,
): Promise<boolean> {
  await installEvaluateHelpers(page);
  const hit = (await page.evaluate(markSearchNode, {
    text,
    attr: NAV_ATTR,
    teams: teams ?? null,
    skip,
  })) as NavHit;
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
/**
 * Pretende che la schedina sia vuota prima di cominciare.
 *
 * Non la svuota: con un contesto pulito non c'è niente da svuotare, e se
 * qualcosa c'è significa che stiamo girando su un profilo che si porta dietro
 * una sessione precedente — nel qual caso costruire il biglietto sopra un
 * residuo è il modo esatto in cui si prenota una gamba che nessuno ha scelto.
 * Meglio fermarsi e dirlo.
 */
async function requireEmptySlip(page: Page, timeout: number): Promise<void> {
  await page.goto(SPORT_PAGE, { waitUntil: "domcontentloaded", timeout });
  await dismissCookieBanner(page);
  await neutraliseOverlays(page);

  const dentro = await waitForSlipPanel(page);
  if (!dentro.found) {
    throw new BookingError(
      "pannello schedina non comparso entro 20 secondi: non posso garantire che sia vuota",
      { suggerimento: "connessione lenta o pagina cambiata; riprova" },
    );
  }
  if (dentro.total === null) return;

  // Non vuota: può succedere solo con --profile. Un tentativo di svuotarla col
  // cestino, poi si rinuncia — costruire il biglietto sopra un residuo è il
  // modo esatto in cui si prenota una gamba che nessuno ha scelto.
  const hit = (await page.evaluate(markSlipBin, { attr: BIN_ATTR })) as BinHit;
  if (hit.kind === "marked") {
    await safeClick(page.locator(`[${BIN_ATTR}="1"]`).first(), timeout);
    await page.waitForTimeout(1000);
  }

  const dopo = await slipContents(page);
  if (dopo.total !== null) {
    throw new BookingError(
      `la schedina non è vuota (quota ${dopo.total}): svuotala a mano, o togli --profile per partire da un contesto pulito`,
      { residuo: dopo.total, dentro_la_schedina: dopo.lines.slice(0, 25) },
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
    // Si prova ogni candidato col nome giusto, verificando DOPO il clic di
    // essere usciti dal palinsesto. Lo stesso nome compare nella riga del
    // palinsesto, nella foglia dell'albero e altrove, e non tutti navigano.
    for (let skip = 0; skip < 4; skip += 1) {
      if (!(await clickSearchNode(page, leafText, timeout, [home, away], skip))) break;
      await page.waitForTimeout(1200);
      if (await onMatchPage(page)) {
        found = true;
        break;
      }
      // Non ha navigato: si torna al palinsesto e si prova il prossimo.
      await page.goto(SPORT_PAGE, { waitUntil: "domcontentloaded", timeout });
      await dismissCookieBanner(page);
      await neutraliseOverlays(page);
      await search.fill(home);
      await page.waitForTimeout(1200);
    }
    if (found) break;
    // Solo nodi che riguardano questa ricerca: la squadra di casa, o il nodo
    // sport. Allargando la ricerca a tutta la pagina, "il prossimo nodo" era
    // diventato una voce di menu — e cliccarla porta fuori dal palinsesto.
    const semplice = (v: string): string =>
      v.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
    const chiaveCasa = semplice(home).split(" ").sort((a, b) => b.length - a.length)[0] ?? "";
    const nodes = await searchResultNodes(page);
    const next = nodes.find((t) => {
      if (visited.has(t) || t === leafText || NON_EVENT_NODE.test(t) || t.length <= 2) return false;
      const st = semplice(t);
      if (/^calcio$/.test(st)) return true;
      return chiaveCasa.length >= 4 && st.includes(chiaveCasa);
    });
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

  // È l'evento giusto?
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

/** Prova a cercare la cella nello stato attuale della pagina. */
async function cercaCella(page: Page, entry: CatalogEntry): Promise<CellHit> {
  await installEvaluateHelpers(page);
  return (await page.evaluate(findCellInPage, {
    block: entry.block,
    outcome: entry.outcome,
    line: entry.line ?? null,
    attr: TARGET_ATTR,
  })) as CellHit;
}

/**
 * Apre la scheda di mercato. Tentativo, non obbligo.
 *
 * "Principali" è la scheda GIA' aperta su ogni pagina partita: cliccarla non
 * serve, e pretenderlo faceva fallire tutto il biglietto su un bottone che non
 * andava premuto. Per questo la cella si cerca PRIMA: se è già a schermo, la
 * scheda giusta è già quella e non si tocca niente.
 */
async function provaApriScheda(page: Page, tab: string, timeout: number): Promise<void> {
  const perRuolo = page.getByRole("tab", { name: new RegExp(`^\\s*${escapeRegExp(tab)}\\s*$`, "i") }).first();
  if (await perRuolo.isVisible().catch(() => false)) {
    await safeClick(perRuolo, timeout).catch(() => undefined);
    await page.waitForTimeout(900);
    return;
  }
  const perTesto = page
    .getByText(new RegExp(`^\\s*${escapeRegExp(tab)}\\s*$`, "i"))
    .filter({ visible: true })
    .first();
  if (await perTesto.isVisible().catch(() => false)) {
    await safeClick(perTesto, timeout).catch(() => undefined);
    await page.waitForTimeout(900);
  }
}

/**
 * Mette la selezione in schedina partendo dal palinsesto, senza aprire la
 * pagina della partita. Restituisce null se la partita non è nella lista.
 */
async function clickFromGrid(
  page: Page,
  event: string,
  entry: CatalogEntry,
  timeout: number,
): Promise<number | null> {
  const [home, away] = splitEvent(event);
  await page.goto(SPORT_PAGE, { waitUntil: "domcontentloaded", timeout });
  await dismissCookieBanner(page);
  await neutraliseOverlays(page);

  const search = siteSearchBox(page);
  await search.waitFor({ state: "visible", timeout: Math.min(timeout, 15_000) }).catch(() => undefined);
  await search.fill(home).catch(() => undefined);
  await page.waitForTimeout(1500);

  await installEvaluateHelpers(page);
  const hit = (await page.evaluate(findGridCellInPage, {
    home,
    away,
    outcome: entry.outcome,
    line: entry.line ?? null,
    attr: TARGET_ATTR,
  })) as CellHit;
  if (hit.kind !== "found") return null;

  const marked = page.locator(`[${TARGET_ATTR}="1"]`).first();
  await marked.waitFor({ state: "visible", timeout: Math.min(timeout, 10_000) });
  await safeClick(marked, timeout);
  return hit.odds;
}

async function clickOutcome(page: Page, entry: CatalogEntry, timeout: number): Promise<number> {
  const where = `${entry.tab} → ${entry.block}${entry.line ? ` (${entry.line})` : ""} → ${entry.outcome}`;

  // Prima si guarda: se il blocco è già visibile, la scheda giusta è aperta.
  let hit = await cercaCella(page, entry);
  if (hit.kind !== "found") {
    await provaApriScheda(page, entry.tab, timeout);
    hit = await cercaCella(page, entry);
  }

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

/** Il bonus multipla che la schedina dichiara adesso. */
export function parseSlipBonus(bodyText: string): number {
  const m = /Bonus[^\d]*(\d+[.,]\d+)/i.exec(bodyText);
  const raw = m?.[1];
  if (raw === undefined) return 0;
  const n = Number(raw.replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

/** Le righe della schedina, per dire cosa c'è dentro quando qualcosa non torna. */
async function slipContents(page: Page): Promise<SlipContents> {
  await installEvaluateHelpers(page);
  return (await page
    .evaluate(readSlipContents)
    .catch(() => ({ total: null, lines: [], found: false }))) as SlipContents;
}

/**
 * Aspetta che il pannello schedina sia disegnato.
 *
 * Con un contesto pulito la pagina parte senza cache e Angular disegna il
 * pannello dopo il primo colpo d'occhio: leggerlo subito dava "pannello non
 * riconosciuto", che è il modo in cui il driver dice "non posso garantire
 * niente" — giusto come prudenza, sbagliato come diagnosi, perche' il pannello
 * sarebbe arrivato un secondo dopo.
 */
async function waitForSlipPanel(page: Page, timeoutMs = 20_000): Promise<SlipContents> {
  const scadenza = Date.now() + timeoutMs;
  let ultimo: SlipContents = { total: null, lines: [], found: false };
  while (Date.now() < scadenza) {
    ultimo = await slipContents(page);
    if (ultimo.found) return ultimo;
    await page.waitForTimeout(500);
  }
  return ultimo;
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
  // Il totale si legge SOLO dentro il pannello schedina. Leggerlo dal testo di
  // tutta la pagina pescava la "Quota TOT." delle card SUPERCOMBO in cima al
  // palinsesto: il driver confrontava la schedina con una pubblicità e
  // rifiutava biglietti corretti.
  const deadline = Date.now() + timeoutMs;
  let last: number | null = null;
  while (Date.now() < deadline) {
    last = (await slipContents(page)).total;
    if (last !== null && totalOddsMatches(last, expected)) return last;
    await page.waitForTimeout(400);
  }
  return last;
}

/**
 * Scrive l'importo nella schedina.
 *
 * Il book propone 3,00 € di suo: senza questo il codice di prenotazione nasce
 * con una puntata che non è quella decisa, e alla cassa si scopre che il
 * biglietto vale un'altra cifra.
 */
async function setStake(page: Page, stake: number, timeout: number): Promise<void> {
  await installEvaluateHelpers(page);
  const hit = (await page.evaluate(markStakeField, { attr: STAKE_ATTR })) as NavHit;
  if (hit.kind !== "marked") {
    throw new BookingError(
      "non trovo dove scrivere l'importo: la schedina resterebbe alla cifra predefinita dal book",
      { importo_voluto: stake, campi_visti: hit.available.slice(0, 10) },
    );
  }
  const campo = page.locator(`[${STAKE_ATTR}="1"]`).first();
  await campo.waitFor({ state: "visible", timeout: Math.min(timeout, 8_000) });
  await campo.fill(stake.toFixed(2).replace(".", ","));
  await campo.press("Tab").catch(() => undefined);
  await page.waitForTimeout(800);
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

  // Se il book segnala quote cambiate, il bottone di gioco diventa "Accetta e
  // scommetti" e la schedina è in uno stato che non rispecchia più quello che
  // abbiamo deciso. Non si prenota in quello stato.
  const body = await page.locator("body").innerText().catch(() => "");
  if (/quote .*sono cambiate|accetta e scommetti/i.test(body)) {
    throw new BookingError(
      "il book segnala che alcune quote sono cambiate: il biglietto non è più quello deciso",
    );
  }

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
  const grezza = /IL TUO CODICE VALIDO PER ([^\n]+)/i.exec(body)?.[1]
    ?? /SCADENZA\s*\n?\s*([^\n]+)/i.exec(body)?.[1]
    ?? "";

  return { code: normalizeBookingCode(matched), expiry: cleanExpiry(grezza) };
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
    await requireEmptySlip(page, timeout);
    const taken: number[] = [];
    for (let i = 0; i < legs.length; i += 1) {
      const leg = legs[i]!;
      const entry = entries[i]!;

      // Prima si prova dal palinsesto: niente navigazione, niente da
      // indovinare. Solo se il mercato non è in griglia si apre la partita.
      let presa: number | null = null;
      if (entry.onGrid === true) {
        presa = await clickFromGrid(page, leg.event, entry, timeout).catch(() => null);
      }
      if (presa === null) {
        await openEvent(page, leg.event, timeout);
        presa = await clickOutcome(page, entry, timeout);
      }
      taken.push(presa);

      const atteso = expectedTotalOdds(taken);
      const mostrato = await waitForSlipTotal(page, atteso, 8_000);
      if (mostrato === null || !totalOddsMatches(mostrato, atteso)) {
        const dentro = await slipContents(page);
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
            dentro_la_schedina: dentro.lines,
            pannello_riconosciuto: dentro.found,
          },
        );
      }
    }

    if (options.stake !== undefined) await setStake(page, options.stake, timeout);

    const placed = await verifySlip(page, legs, taken, tolerance);

    // Letti ORA, non dopo: premuto PRENOTA la schedina si svuota e questi
    // numeri spariscono dalla pagina. Venivano stampati a zero.
    const primaDiPrenotare = await page.locator("body").innerText().catch(() => "");
    const totalOdds = parseSlipTotal(primaDiPrenotare) ?? expectedTotalOdds(taken);
    const bonus = parseSlipBonus(primaDiPrenotare);

    await pressBookButton(page, timeout);
    const { code, expiry } = await readBookingCode(page, timeout);

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
