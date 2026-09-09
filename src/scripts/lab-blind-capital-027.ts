import { auditTask027 } from "@/domain/eval/breakthrough-027/audit";
import { onePageVerdict, runTask027 } from "@/domain/eval/breakthrough-027/lab";
import { writeTask027Artifacts } from "@/domain/eval/breakthrough-027/write-artifacts";
import { existsSync } from "node:fs";
import { strictCandidatesPath } from "@/domain/eval/breakthrough-027/config";

async function main() {
  const skipHeavy = !existsSync(strictCandidatesPath());
  const report = await runTask027({ allowNetwork: false, skipHeavy });
  if (!skipHeavy) writeTask027Artifacts(report);
  const audit = auditTask027(report);
  console.log(onePageVerdict(report));
  console.log(
    JSON.stringify(
      {
        fixture_mode: report.fixture_mode,
        data_band: report.data_band,
        scientific_verdict: report.scientific_verdict,
        winner: report.winner,
        real_money: report.real_money,
        declared_edge: report.declared_edge,
        model_ready: report.model_ready,
        strict: report.metrics.strict_events,
        decisions: report.metrics.decisions,
        bets: report.metrics.bets,
        annual_2015: report.annual.find((r) => r.year === 2015),
        annual_2016: report.annual.find((r) => r.year === 2016),
        silent_1000: report.annual.some((r) => r.end === 1000 && r.bets === 0),
        audit,
      },
      null,
      2,
    ),
  );
  if (!audit.ok) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
