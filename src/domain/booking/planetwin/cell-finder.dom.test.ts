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
import { findCellInPage, TARGET_ATTR } from "@/domain/booking/planetwin/cell-finder";

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

  it("GG/NG: due esiti, nessuna ambiguità", async () => {
    assert.equal((await find("GG/NG", "GG")).odds, 1.62);
    assert.equal((await find("GG/NG", "NG")).odds, 2.2);
  });
});
