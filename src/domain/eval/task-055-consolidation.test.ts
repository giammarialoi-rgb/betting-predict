import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { assertFileArgQuoted055 } from "@/domain/eval/catalog-055/autostart";
import {
  assessConsolidation055,
  consolidationReady055,
  writeMarketCatalogJson055,
} from "@/domain/eval/catalog-055/consolidation";
import { permanentRoot044 } from "@/domain/eval/permanent-044/config";
import { loadExp055Config } from "@/domain/eval/catalog-055/config";
import { existsSync } from "node:fs";
import { join } from "node:path";

describe("TASK 055 final consolidation", () => {
  it("no TASK 056 / paper / no artificial cap", () => {
    const cfg = loadExp055Config();
    assert.equal(cfg.open_task_056, false);
    assert.equal(cfg.real_money, false);
    assert.equal(cfg.auto_promotion, false);
    assert.equal(cfg.no_artificial_event_cap, true);
  });

  it("Windows -File args must quote paths with spaces (previsioni)", () => {
    const ok =
      '-NoProfile -File "C:\\Users\\giamm\\Desktop\\app previsioni sportive\\betting predict\\scripts\\start-supervisor.ps1"';
    const bad =
      "-File C:\\Users\\giamm\\Desktop\\app previsioni sportive\\betting predict\\scripts\\start-supervisor.ps1";
    assert.equal(assertFileArgQuoted055(ok, "start-supervisor.ps1"), true);
    assert.equal(assertFileArgQuoted055(bad, "start-supervisor.ps1"), false);
  });

  it("market_catalog.json written from observed quotes only", () => {
    const { path, entries } = writeMarketCatalogJson055(permanentRoot044());
    assert.ok(existsSync(path));
    assert.ok(entries >= 0);
    assert.ok(existsSync(join(permanentRoot044(), "market_catalog.json")));
  });

  it("consolidation snapshot: paper, no edge claim, no open 056", () => {
    const s = assessConsolidation055({ leakagePass: true, reproducibilityPass: true });
    assert.equal(s.REAL_MONEY, false);
    assert.equal(s.AUTO_PROMOTION, false);
    assert.equal(s.CAPITAL, "PAPER_ONLY");
    assert.equal(s.PAPER_INITIAL_CAPITAL, 1000);
    assert.equal(s.ARTIFICIAL_CAP, false);
    assert.equal(s.MODEL_EDGE, "UNKNOWN");
    assert.equal(s.API_CALLS_UI, 0);
    assert.equal(s.open_task_056, false);
    assert.equal(s.LAB_A_MUTATION, false);
    assert.ok(["READY", "IMPLEMENTED", "FAIL"].includes(s.AUTOPSY));
    assert.ok(["READY", "IMPLEMENTED", "FAIL"].includes(s.LEARNING));
    // READY requires autostart verified among other gates
    if (consolidationReady055(s)) {
      assert.equal(s.AUTOSTART_VERIFIED, true);
    }
  });

  it("PROVIDER_UNAVAILABLE sports must expose reason not silent zero", () => {
    const s = assessConsolidation055({ leakagePass: true, reproducibilityPass: true });
    for (const [sport, row] of Object.entries(s.SPORT_STATUS)) {
      if (row.status === "PROVIDER_UNAVAILABLE") {
        assert.ok(row.reason.toLowerCase().includes("unavailable"), sport);
      }
      if (row.status === "EMPTY_WINDOW") {
        assert.ok(row.reason.toLowerCase().includes("empty"), sport);
      }
    }
  });
});
