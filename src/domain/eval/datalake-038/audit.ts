import { loadExp038Config } from "@/domain/eval/datalake-038/config";
import { canEnterStrict038 } from "@/domain/eval/datalake-038/classify";

export type AuditSlice038 = {
  winner: null;
  auto_promotion: boolean;
  real_money: boolean;
  BETS: number;
  BANKROLL: string;
  MODEL_READY: boolean;
  leakage: { throws: boolean }[];
  API_KEY: "configured" | "missing";
  COLLECTION_STATUS: string;
  FINAL_VERDICT: string;
  STRICT_EVENTS: number;
  DATA_LAKE_STATUS: string;
  open_task_039: false;
};

export function auditTask038(report: AuditSlice038 | null): { ok: boolean; failures: string[] } {
  const failures: string[] = [];
  const cfg = loadExp038Config();
  if (cfg.winner !== null) failures.push("cfg_winner");
  if (cfg.auto_promotion || cfg.real_money) failures.push("cfg_money");
  if (cfg.open_task_039) failures.push("open_039");
  if (cfg.historical_hunt) failures.push("historical_hunt");
  if (cfg.invent_timestamps || cfg.synthetic_data) failures.push("synthetic");
  if (cfg.modify_frozen_031) failures.push("modify_031");
  if (cfg.count_legacy_031_as_new_strict) failures.push("legacy_as_new");
  if (cfg.client_retrieved_as_quote) failures.push("client_ts");
  if (cfg.date_only_promoted_to_strict) failures.push("date_only");
  if (cfg.capital_gate) failures.push("capital_flag");
  if (
    canEnterStrict038({
      quoteTimestampUtc: "2026-10-01T16:00:00.000Z",
      kickoffUtc: "2026-10-01T16:00:00.000Z",
      temporalBasis: "SOURCE_TIMESTAMP",
      clientRetrievedAt: null,
      match: "MATCH_EXACT",
      market: "1X2",
      provenance: "the-odds-api",
    })
  ) {
    failures.push("quote_eq_kickoff_entered_strict");
  }
  if (report) {
    if (report.winner !== null) failures.push("winner");
    if (report.auto_promotion || report.real_money) failures.push("promo");
    if (report.BETS !== 0) failures.push("bets");
    if (report.BANKROLL !== "—") failures.push("silent_bankroll");
    if (report.MODEL_READY) failures.push("model_ready_without_protocol");
    if (report.leakage.some((l) => !l.throws)) failures.push("leakage");
    if (report.API_KEY === "configured" && report.COLLECTION_STATUS === "NOT_CONFIGURED") {
      failures.push("configured_marked_not_configured");
    }
    if (report.API_KEY === "missing" && report.FINAL_VERDICT !== "LIVE_NOT_CONFIGURED") {
      failures.push("missing_key_wrong_verdict");
    }
    if (report.STRICT_EVENTS > 0 && report.DATA_LAKE_STATUS !== "READY") failures.push("strict_without_lake");
    if (report.open_task_039) failures.push("report_open_039");
  }
  return { ok: failures.length === 0, failures };
}
