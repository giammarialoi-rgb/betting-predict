import { probeTask025, acquireKaggleWeekly } from "@/domain/eval/turnaround-025/acquire";
import { githubAuditsOnline } from "@/domain/eval/turnaround-025/github-audit";
import { academicCandidates025 } from "@/domain/eval/turnaround-025/academic";
import { inspectKaggleWeekly } from "@/domain/eval/turnaround-025/kaggle-inspect";

async function main() {
  const probes = await probeTask025(true);
  probes.push(await acquireKaggleWeekly());
  const github = await githubAuditsOnline();
  const academic = academicCandidates025();
  const kaggle = await inspectKaggleWeekly();
  console.log(
    JSON.stringify(
      {
        probes: probes.map((p) => ({
          channel: p.channel,
          http_status: p.http_status,
          acquired: p.acquired,
          note: p.note.slice(0, 180),
        })),
        github: github.map((g) => ({ repo: g.repo, license: g.license, hasRawData: g.hasRawData })),
        academic: academic.map((a) => ({ name: a.name, acquired: a.acquired, datasetUrl: a.datasetUrl })),
        kaggle: {
          bulk_acquired: kaggle.bulk_acquired,
          sample_rows: kaggle.sample_rows,
          class_counts: kaggle.class_counts,
        },
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
