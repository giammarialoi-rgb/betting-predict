import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  eventStatusIt,
  honestyLayersIt,
  isInPlayBoardStatus,
  operationalStatusIt,
  roleLabelIt,
  sourceBlurbIt,
  sourceStatusKind,
  sourceTitleIt,
  temporalLabelIt,
} from "@/domain/eval/betmind-runtime/status-copy";

describe("status-copy Italian honesty", () => {
  it("maps the five Fonti kinds without inventing OK", () => {
    assert.equal(sourceStatusKind("OK"), "OK");
    assert.equal(sourceStatusKind("ACTIVE"), "OK");
    assert.equal(sourceStatusKind("NO_DATA"), "NO_DATA");
    assert.equal(sourceStatusKind("NO_EVENT"), "NO_DATA");
    assert.equal(sourceStatusKind("AUTH_REQUIRED"), "AUTH_REQUIRED");
    assert.equal(sourceStatusKind("PLAN_LIMITED"), "AUTH_REQUIRED");
    assert.equal(sourceStatusKind("BLOCKED"), "BLOCKED");
    assert.equal(sourceStatusKind("NETWORK_ERROR"), "NETWORK_ERROR");
    assert.equal(sourceStatusKind("FOUNDATION"), "OTHER");
    assert.equal(sourceStatusKind("STALE_MIRROR"), "OTHER");
  });

  it("uses short Italian labels for the honest source states", () => {
    assert.equal(operationalStatusIt("OK"), "OK — dati ottenuti");
    assert.equal(operationalStatusIt("NO_DATA"), "Nessun dato");
    assert.equal(operationalStatusIt("AUTH_REQUIRED"), "Autenticazione richiesta");
    assert.equal(operationalStatusIt("BLOCKED"), "Bloccata");
    assert.equal(operationalStatusIt("NETWORK_ERROR"), "Errore di rete");
  });

  it("keeps blurbs honest when the registry reason is a raw code", () => {
    assert.match(sourceBlurbIt("AUTH_REQUIRED", "AUTH_REQUIRED"), /chiave|token/i);
    assert.match(sourceBlurbIt("BLOCKED", "HTTP_403"), /bypass/i);
    assert.match(sourceBlurbIt("NO_DATA", "EMPTY"), /senza dati/i);
    assert.equal(
      sourceBlurbIt("OK", "RSS pubblico. Solo contesto; nessun infortunio inventato dai titoli."),
      "RSS pubblico. Solo contesto; nessun infortunio inventato dai titoli.",
    );
  });

  it("keeps App online, Runtime offline, and Specchio scaduto as distinct phrases", () => {
    assert.equal(
      honestyLayersIt({ webOnline: true, runtimeState: "OFFLINE" }),
      "App online · Runtime offline",
    );
    assert.equal(
      honestyLayersIt({ webOnline: true, runtimeState: "ONLINE", mirrorStale: true }),
      "App online · Specchio scaduto",
    );
  });

  it("translates event / role / temporal jargon into Italian", () => {
    assert.equal(eventStatusIt("SCHEDULED"), "In programma");
    assert.equal(eventStatusIt("IN_PLAY"), "In corso");
    assert.equal(eventStatusIt("HT"), "In corso");
    assert.equal(eventStatusIt("STATUS_HALFTIME"), "In corso");
    assert.equal(eventStatusIt("FT"), "Terminata");
    assert.equal(isInPlayBoardStatus("HT"), true);
    assert.equal(isInPlayBoardStatus("STATUS_HALFTIME"), true);
    assert.equal(isInPlayBoardStatus("STATUS_FIRST_HALF"), true);
    assert.equal(isInPlayBoardStatus("STATUS_IN_PROGRESS"), true);
    assert.equal(isInPlayBoardStatus("LIVE"), true);
    assert.equal(isInPlayBoardStatus("FINISHED"), false);
    assert.equal(isInPlayBoardStatus("STATUS_FINAL"), false);
    assert.equal(isInPlayBoardStatus("UPCOMING"), false);
    assert.equal(roleLabelIt("MARKET_COMPARE"), "Quote di mercato, solo confronto");
    assert.equal(temporalLabelIt("DATE_ONLY"), "Solo data, non orario esatto");
    assert.equal(sourceTitleIt("espn"), "ESPN Scoreboard (non ufficiale)");
    assert.equal(sourceTitleIt("gazzetta"), "Gazzetta dello Sport");
    assert.equal(sourceTitleIt("openfootball"), "OpenFootball");
  });
});
