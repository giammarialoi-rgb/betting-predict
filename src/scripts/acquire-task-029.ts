import { acquireTask029 } from "@/domain/eval/incremental-029/acquire";

async function main() {
  const acq = await acquireTask029({ skipHeavy: false });
  console.log(
    JSON.stringify(
      {
        overlay_rows: acq.overlay_rows,
        overlay_sha256: acq.overlay_sha256,
        extract_ran: acq.extract_ran,
        probes: acq.probes.map((p) => ({
          channel: p.channel,
          status: p.http_status,
          acquired: p.acquired,
          bytes: p.bytes,
        })),
        sources: acq.sources.map((s) => ({
          source: s.source,
          cluster: s.cluster,
          classification: s.classification,
          access: s.access,
        })),
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
