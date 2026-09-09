import { loadExp055Config } from "@/domain/eval/catalog-055/config";
import type { Task055Report } from "@/domain/eval/catalog-055/lab";

export function auditTask055(report: Task055Report | null): { ok: boolean; failures: string[] } {
  const failures: string[] = [];
  const cfg = loadExp055Config();
  if (cfg.winner !== null) failures.push("cfg_winner");
  if (cfg.auto_promotion || cfg.real_money) failures.push("cfg_money");
  if (cfg.open_task_056) failures.push("open_056");
  if (cfg.modify_lab_a || cfg.synthetic_data || cfg.capital_gate) failures.push("integrity");
  if (cfg.scraping_default !== false) failures.push("scraping_default");
  if (cfg.no_artificial_event_cap !== true) failures.push("cap");
  if (report) {
    if (report.LAB_A_MUTATION !== false) failures.push("lab_a");
    if (report.LAB_A_EVENTS !== 114 || report.LAB_A_LOCKED !== 114) failures.push("lab_a_size");
    if (report.REAL_MONEY || report.CAPITAL !== "PAPER_ONLY") failures.push("capital");
    if (report.AUTO_PROMOTION !== false) failures.push("promo");
    if (report.MODEL_EDGE !== "UNKNOWN") failures.push("edge");
    if (report.ARTIFICIAL_CAP !== false) failures.push("artificial_cap");
    if (report.PAPER_BANKROLL !== 1000 || report.PAPER_INITIAL_CAPITAL !== 1000) failures.push("bankroll");
    if (report.OBSERVATORY_API_CALLS_UI !== 0) failures.push("ui_api");
    if (report.open_task_056) failures.push("report_056");
    if (report.NO_DUPLICATE_WORKERS !== true) failures.push("dup_workers");
    const okV = [
      "UNIVERSAL_24_7_SPORTS_INTELLIGENCE_BRAIN_READY",
      "PARTIAL",
      "BLOCKED",
      // legacy verdict accepted only if not claiming READY without autostart
      "MULTI_SOURCE_UNIVERSAL_LIVE_BRAIN_READY",
    ].includes(report.FINAL_VERDICT);
    if (!okV) failures.push("verdict");
    if (
      report.FINAL_VERDICT === "UNIVERSAL_24_7_SPORTS_INTELLIGENCE_BRAIN_READY" &&
      !report.AUTOSTART_VERIFIED
    ) {
      failures.push("ready_without_autostart");
    }
    const sofa = report.SOURCE_STATUS.find((s) => s.sourceId === "SOFASCORE");
    if (sofa && sofa.status !== "DISABLED_BY_POLICY") failures.push("sofa_policy");
    if (report.MULTI_SPORT_ADAPTERS === "FAIL") failures.push("sport_adapters");
    if (report.MULTI_MARKET_ENGINE === "FAIL") failures.push("markets");
    if (report.AUTOPSY === "FAIL" || report.LEARNING === "FAIL") failures.push("learning_stack");
  }
  return { ok: failures.length === 0, failures };
}
