import { acquirePublicZips, probeTask026 } from "@/domain/eval/bottleneck-026/acquire";
import { inspectKaggleAh } from "@/domain/eval/bottleneck-026/kaggle-ah";
import { inspectZenodoUcd } from "@/domain/eval/bottleneck-026/zenodo";

async function main() {
  const probes = await probeTask026(true);
  const downloads = await acquirePublicZips();
  const kaggle = inspectKaggleAh({ skipFull: false });
  const zenodo = await inspectZenodoUcd({ skipFull: false });
  console.log(
    JSON.stringify(
      {
        probes: [...probes, ...downloads].map((p) => ({
          channel: p.channel,
          http_status: p.http_status,
          acquired: p.acquired,
          note: p.note.slice(0, 200),
        })),
        kaggle: {
          zip_present: kaggle.zip_present,
          public_csv_files: kaggle.public_csv_files,
          exact_timestamp_events: kaggle.exact_timestamp_events,
          quote_rows: kaggle.quote_rows,
          license: kaggle.license,
          note: kaggle.note,
        },
        zenodo: {
          zip_present: zenodo.zip_present,
          raw_rows: zenodo.raw_rows,
          date_precision: zenodo.date_precision,
          header: zenodo.header.slice(0, 12),
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
