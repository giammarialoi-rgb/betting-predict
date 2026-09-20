/**
 * Il trova-cella contro un DOM vero, nel browser che userà in esercizio.
 *
 * Non serve rete: la pagina viene costruita in memoria con setContent. Il
 * markup riproduce la forma osservata sulla board di Planetwin365, dove
 * etichetta e quota sono elementi ADIACENTI SENZA SPAZIO — quindi il
 * textContent della cella è "13.20", non "1 3.20". È la trappola che ha rotto
 * la prima versione, e il caso "12 a 1.30" contro "1 a 21.30" è il motivo per
 * cui questo test esiste: sbagliarlo significherebbe piazzare una scommessa
 * diversa da quella decisa, in silenzio.
 */
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import type { Browser, Page } from "playwright";
import {
  BIN_ATTR,
  findCellInPage,
  markSearchNode,
  markSlipBin,
  NAV_ATTR,
  readSlipContents,
  TARGET_ATTR,
} from "@/domain/booking/planetwin/cell-finder";

const BOARD = `<!doctype html><html><body>
  <div class="mk"><span class="title">1X2</span><div class="cells">
    <div class="c"><span>1</span><span>3.20</span></div>
    <div class="c"><span>X</span><span>3.40</span></div>
    <div class="c"><span>2</span><span>2.25</span></div></div></div>
  <div class="mk"><span class="title">DC</span><div class="cells">
    <div class="c"><span>1X</span><span>1.63</span></div>
    <div class="c"><span>12</span><span>1.30</span></div>
    <div class="c"><span>X2</span><span>1.35</span></div></div></div>
  <div class="mk"><span class="title">GG/NG</span><div class="cells">
    <div class="c"><span>GG</span><span>1.62</span></div>
    <div class="c"><span>NG</span><span>2.20</span></div></div></div>
  <div class="mk" style="display:none"><span class="title">1X2</span><div class="cells">
    <div class="c"><span>1</span><span>99.00</span></div>
    <div class="c"><span>X</span><span>99.00</span></div>
    <div class="c"><span>2</span><span>99.00</span></div></div></div>
  <div class="mk"><span class="title">U/O ANGOLI</span><div class="rows">
    <div class="r"><span>8.5</span><div class="c"><span>U</span><span>1.90</span></div><div class="c"><span>O</span><span>1.77</span></div></div>
    <div class="r"><span>9.5</span><div class="c"><span>U</span><span>1.50</span></div><div class="c"><span>O</span><span>2.35</span></div></div>
    <div class="r"><span>10.5</span><div class="c"><span>U</span><span>1.30</span></div><div class="c"><span>O</span><span>3.15</span></div></div></div></div>
</body></html>`;

type Hit = { kind: string; odds?: number; cellText?: string };

describe("trova-cella su DOM reale", { timeout: 120_000 }, () => {
  let browser: Browser;
  let page: Page;

  before(async () => {
    const { chromium } = await import("playwright");
    browser = await chromium.launch();
    page = await browser.newPage();
    // Stesso helper che installa il driver: tsx avvolge le funzioni in
    // __name(), che nel browser non esiste. Senza, ogni evaluate muore.
    await page.addInitScript("window.__name = window.__name || function (f) { return f; };");
    await page.setContent(BOARD);
    await page.evaluate("window.__name = window.__name || function (f) { return f; };");
  });

  after(async () => {
    await browser?.close();
  });

  const find = (block: string, outcome: string, line?: string): Promise<Hit> =>
    page.evaluate(findCellInPage, {
      block,
      outcome,
      line: line ?? null,
      attr: TARGET_ATTR,
    }) as Promise<Hit>;

  it("legge l'1X2 anche se etichetta e quota sono attaccate", async () => {
    assert.equal((await find("1X2", "1")).odds, 3.2);
    assert.equal((await find("1X2", "X")).odds, 3.4);
    assert.equal((await find("1X2", "2")).odds, 2.25);
  });

  it("non confonde l'esito 12 con l'esito 1", async () => {
    // "121.30" si potrebbe leggere come 12@1.30 oppure 1@21.30.
    assert.equal((await find("DC", "12")).odds, 1.3);
    assert.equal((await find("DC", "1X")).odds, 1.63);
    assert.equal((await find("DC", "X2")).odds, 1.35);
    // E l'1 secco non deve comparire nella doppia chance.
    assert.notEqual((await find("DC", "1")).kind, "found");
  });

  it("prende la linea giusta e non quella accanto", async () => {
    assert.equal((await find("U/O ANGOLI", "O", "9.5")).odds, 2.35);
    assert.equal((await find("U/O ANGOLI", "U", "9.5")).odds, 1.5);
    assert.equal((await find("U/O ANGOLI", "O", "8.5")).odds, 1.77);
    assert.equal((await find("U/O ANGOLI", "O", "10.5")).odds, 3.15);
  });

  it("marca la cella cliccata e smarca la precedente", async () => {
    await find("1X2", "1");
    assert.equal(await page.locator(`[${TARGET_ATTR}="1"]`).count(), 1);
    const primo = await page.locator(`[${TARGET_ATTR}="1"]`).innerText();

    await find("1X2", "2");
    assert.equal(await page.locator(`[${TARGET_ATTR}="1"]`).count(), 1, "una sola marcatura per volta");
    const secondo = await page.locator(`[${TARGET_ATTR}="1"]`).innerText();
    assert.notEqual(primo, secondo);
  });

  it("dice quale blocco manca invece di prendere il primo che capita", async () => {
    const r = await find("SANZIONI", "Si");
    assert.equal(r.kind, "no-block");
  });

  it("rifiuta una linea non quotata invece di ripiegare sulla più vicina", async () => {
    const r = await find("U/O ANGOLI", "O", "6.5");
    assert.notEqual(r.kind, "found");
  });

  it("ignora un blocco identico dentro una scheda non attiva", async () => {
    // Sulla pagina partita le schede non attive restano nel DOM. Se il finder
    // le vedesse, marcherebbe una cella invisibile: la quota si leggerebbe, il
    // clic non farebbe niente, e la gamba non entrerebbe mai nella schedina.
    // Il blocco nascosto qui quota 99.00 — se compare, il finder guarda dove
    // non deve.
    assert.equal((await find("1X2", "1")).odds, 3.2);
    assert.equal((await find("1X2", "X")).odds, 3.4);
  });

  it("GG/NG: due esiti, nessuna ambiguità", async () => {
    assert.equal((await find("GG/NG", "GG")).odds, 1.62);
    assert.equal((await find("GG/NG", "NG")).odds, 2.2);
  });
});

/**
 * La regione dei risultati contro il pannello schedina.
 *
 * Il difetto che questo test fissa: cliccare per testo su tutta la pagina
 * finiva nel pannello schedina, dove gli stessi nomi compaiono accanto alla
 * "×" che rimuove la gamba. Nella corsa reale la gamba 1 spariva mentre si
 * cercava l'evento della gamba 2.
 */
const PAGINA_CON_SCHEDINA = `<!doctype html><html><body>
  <div class="left">
    <form><input placeholder="Ricerca" value="Milan"></form>
    <div>
      <span>Ricerca per eventi sportivi</span>
      <span>Calcio</span>
      <span>Serie A</span>
      <span class="event-name">Milan - Lecce</span>
      <span>Campionati:</span>
      <span>Tutti</span>
    </div>
  </div>
  <div class="slip">
    <span>SCHEDINA</span>
    <div class="leg"><span>Serie A</span><span>Milan - Lecce</span><span class="x">×</span></div>
  </div>
</body></html>`;

describe("nodi della ricerca contro pannello schedina", { timeout: 120_000 }, () => {
  let browser2: Browser;
  let page2: Page;

  before(async () => {
    const { chromium } = await import("playwright");
    browser2 = await chromium.launch();
    page2 = await browser2.newPage();
    await page2.addInitScript("window.__name = window.__name || function (f) { return f; };");
    await page2.setContent(PAGINA_CON_SCHEDINA);
    await page2.evaluate("window.__name = window.__name || function (f) { return f; };");
  });

  after(async () => {
    await browser2?.close();
  });

  const mark = (text: string | null): Promise<{ kind: string; available?: string[] }> =>
    page2.evaluate(markSearchNode, { text, attr: NAV_ATTR }) as Promise<{
      kind: string;
      available?: string[];
    }>;

  it("elenca i nodi della barra laterale e mai quelli della schedina", async () => {
    const r = await mark(null);
    assert.ok(r.available?.includes("Milan - Lecce"), "la foglia dell'evento");
    assert.ok(r.available?.includes("Calcio"));
    assert.ok(!r.available?.includes("×"), "la × che rimuove una gamba");
    assert.ok(!r.available?.includes("SCHEDINA"), "il pannello schedina è zona vietata");
  });

  it("marca il nodo nella barra laterale, non l'omonimo nella schedina", async () => {
    const r = await mark("Milan - Lecce");
    assert.equal(r.kind, "marked");
    assert.equal(await page2.locator(`[${NAV_ATTR}="1"]`).count(), 1);
    // Deve essere quello con class="event-name", non quello dentro .slip
    const dentroSchedina = await page2.locator(`.slip [${NAV_ATTR}="1"]`).count();
    assert.equal(dentroSchedina, 0, "ha marcato la gamba nella schedina");
    const classe = await page2.locator(`[${NAV_ATTR}="1"]`).getAttribute("class");
    assert.equal(classe, "event-name");
  });

  it("non marca niente se il testo non è nella regione", async () => {
    const r = await mark("×");
    assert.equal(r.kind, "absent");
    assert.equal(await page2.locator(`[${NAV_ATTR}="1"]`).count(), 0);
  });
});

/**
 * Il cestino della schedina.
 *
 * Nella corsa reale una gamba della sessione precedente restava dentro e
 * finiva nel biglietto nuovo: la schedina mostrava 5.20 quando la prima gamba
 * valeva 3.25. Il cestino non ha una classe riconoscibile — è un'icona
 * Material, il cui testo è la legatura.
 */
const PAGINA_CON_RESIDUO = `<!doctype html><html><body>
  <div class="left"><form><input placeholder="Ricerca"></form></div>
  <div class="slip">
    <span>SCHEDINA</span>
    <span class="material-icons">delete_outline</span>
    <div class="leg"><span>Milan - Lecce</span><span>1.60</span><span class="x">×</span></div>
    <div><span>Quota Tot</span><span>1.60</span></div>
  </div>
</body></html>`;

describe("cestino della schedina", { timeout: 120_000 }, () => {
  let browser3: Browser;
  let page3: Page;

  before(async () => {
    const { chromium } = await import("playwright");
    browser3 = await chromium.launch();
    page3 = await browser3.newPage();
    await page3.addInitScript("window.__name = window.__name || function (f) { return f; };");
    await page3.setContent(PAGINA_CON_RESIDUO);
    await page3.evaluate("window.__name = window.__name || function (f) { return f; };");
  });

  after(async () => {
    await browser3?.close();
  });

  it("trova il cestino dalla legatura Material, non dalla classe", async () => {
    const r = (await page3.evaluate(markSlipBin, { attr: BIN_ATTR })) as { kind: string };
    assert.equal(r.kind, "marked");
    assert.equal(await page3.locator(`[${BIN_ATTR}="1"]`).count(), 1);
    assert.equal(await page3.locator(`[${BIN_ATTR}="1"]`).innerText(), "delete_outline");
  });

  it("marca il cestino, non la × che rimuove una singola gamba", async () => {
    await page3.evaluate(markSlipBin, { attr: BIN_ATTR });
    assert.equal(await page3.locator(`.x[${BIN_ATTR}="1"]`).count(), 0);
  });

  it("legge le righe della schedina, non solo il totale", async () => {
    const c = (await page3.evaluate(readSlipContents)) as {
      total: number | null;
      lines: string[];
      found: boolean;
    };
    assert.equal(c.found, true);
    assert.equal(c.total, 1.6);
    assert.ok(c.lines.includes("Milan - Lecce"), "deve dire QUALE gamba c'è dentro");
  });

  it("i nodi di navigazione restano fuori dalla schedina anche qui", async () => {
    const r = (await page3.evaluate(markSearchNode, { text: "Milan - Lecce", attr: NAV_ATTR })) as {
      kind: string;
    };
    assert.equal(r.kind, "absent", "l'unico Milan - Lecce è dentro la schedina");
  });
});
