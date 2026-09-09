import { loadOrRunTask020 } from "@/domain/eval/capital-020/lab";

async function main() {
  const report = await loadOrRunTask020();
  console.log("Anno\tDati validi\tDecisioni\tBet\tStart\tFinale\tP/L\tROI\tMax DD\tModello\tStato");
  for (const a of report.annual) {
    const y = a.year === 2026 ? "2026 YTD" : String(a.year);
    console.log(
      [
        y,
        a.valid_data,
        a.decisions,
        a.bets,
        a.start,
        a.final ?? "INSUFFICIENT_DATA",
        a.pnl ?? "—",
        a.roi ?? "—",
        a.max_dd ?? "—",
        a.model,
        a.data_status,
      ].join("\t"),
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
