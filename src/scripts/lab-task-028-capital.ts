import { runTask028 } from "@/domain/eval/validation-028/lab";

async function main() {
  const report = await runTask028({ skipHeavy: false });
  console.log(
    JSON.stringify(
      {
        annual: report.annual.filter((r) => r.year === 2015 || r.year === 2016 || r.bets > 0),
        test_capital: { bets: report.test_capital.bets, roi: report.test_capital.roi, ci: report.test_capital.ci },
        friction: report.friction,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
