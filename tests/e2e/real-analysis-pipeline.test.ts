/**
 * Vertical-slice E2E. External APIs are real when reachable.
 * Missing keys → NOT_CONFIGURED in the report. Never fake PREDICTION success.
 */
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { NEON_IN_USE } from "@/domain/storage";
import { runRealAnalysisPipeline } from "@/domain/eval/real-pipeline";
import { createMemoryRemoteMirrorStore, setRemoteMirrorStoreOverride } from "@/domain/eval/betmind-runtime/remote-mirror";

describe("real analysis pipeline e2e", () => {
  it("never uses Neon", () => {
    assert.equal(NEON_IN_USE, false);
  });

  it("analyzes one real future match end-to-end", { timeout: 240_000 }, async () => {
    const root = mkdtempSync(join(tmpdir(), "betmind-slice-"));
    mkdirSync(join(root, "predictive-intelligence", "datasets"), { recursive: true });
    writeFileSync(join(root, "events.jsonl"), "");
    setRemoteMirrorStoreOverride(createMemoryRemoteMirrorStore());
    try {
      const report = await runRealAnalysisPipeline({
        labBRoot: root,
        ensureHistoricalPriors: true,
      });

      if (!report.event) {
        const codes = report.blocked_by.map((b) => `${b.code}:${b.service}`).join(", ");
        assert.fail(`discovery produced no future event (${codes || report.errors.join(",")})`);
      }

      assert.equal(report.neon_in_use, false);
      assert.equal(report.event.future, true, "primary demo must be a future match, not a historical one");
      assert.ok(report.event.home && report.event.away && report.event.event_id);
      assert.ok(report.event.kickoff_utc);

      for (const src of report.source_coverage) {
        if (src.status === "ACTIVE") {
          assert.notEqual(src.status, "UNAVAILABLE");
          assert.ok(src.fetched || src.records > 0, `${src.source_id} ACTIVE without fetch/records`);
        }
        if (src.env_var && !process.env[src.env_var]?.trim()) {
          assert.notEqual(src.status, "ACTIVE", `${src.source_id} must not be ACTIVE without ${src.env_var}`);
        }
      }

      assert.ok(
        ["BET", "WATCH", "NO BET", "INSUFFICIENT DATA"].includes(report.decision),
        `unexpected decision ${report.decision}`,
      );

      if (report.probs) {
        assert.equal(typeof report.probs.HOME, "number");
        assert.equal(typeof report.probs.DRAW, "number");
        assert.equal(typeof report.probs.AWAY, "number");
        assert.ok(String(report.model.version).includes("INDEPENDENT"));
      } else {
        assert.ok(
          report.decision === "INSUFFICIENT DATA" || report.decision === "NO BET" || report.decision === "WATCH",
          "null probs cannot become BET",
        );
        assert.ok(
          report.model.reason_codes.some((c) => /INSUFFICIENT|NO_PREDICTION|SPARSE|NOT_CONFIGURED/i.test(c)),
          `honest no-prob must carry a reason code, got ${report.model.reason_codes.join(",")}`,
        );
      }

      assert.ok(report.dossier_state === "ok" || report.dossier_state === "local_only");
      assert.ok(report.dossier_id);
      assert.ok(report.publish.local_verified);

      if (!process.env.BLOB_READ_WRITE_TOKEN?.trim() && report.publish.backend === "none") {
        assert.ok(
          report.remote_board === "BLOB_NOT_CONFIGURED" || report.remote_board === "DOSSIER_NOT_MIRRORED",
        );
      }

      const odds = report.source_coverage.find((s) => s.source_id === "the-odds-api");
      if (odds && !process.env.THE_ODDS_API_KEY?.trim()) {
        assert.equal(odds.status, "NOT_CONFIGURED");
      }
    } finally {
      setRemoteMirrorStoreOverride(null);
      rmSync(root, { recursive: true, force: true });
    }
  });
});
