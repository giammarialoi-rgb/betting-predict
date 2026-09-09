import { loadOrRunTask020 } from "@/domain/eval/capital-020/lab";

async function main() {
  const report = await loadOrRunTask020();
  console.log("MODEL_READY");
  for (const [m, ready] of Object.entries(report.model_ready)) {
    console.log(`  ${m}: ${ready ? "YES" : "NO"}`);
  }
  console.log("");
  console.log("Period\tMarket\tN\tMarketBrier\tModelBrier\tMarketLL\tModelLL\tSignificant\tCapital");
  for (const r of report.model_rows) {
    console.log(
      [
        r.period,
        r.market,
        r.n,
        r.market_brier?.toFixed(4) ?? "—",
        r.model_brier?.toFixed(4) ?? "—",
        r.market_logloss?.toFixed(4) ?? "—",
        r.model_logloss?.toFixed(4) ?? "—",
        r.significant,
        r.used_for_capital,
      ].join("\t"),
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
