import { acquireTask031 } from "@/domain/eval/breakthrough-031/acquire";

async function main() {
  const acq = await acquireTask031({ skipHeavy: false });
  console.log(
    JSON.stringify(
      {
        base_sha256: acq.base_sha256,
        added_strict_events: acq.added_strict_events,
        hunt_exhausted: acq.hunt_exhausted,
        five_dollar: acq.five_dollar,
        julien: acq.julien,
        probes: acq.probes.map((p) => ({
          channel: p.channel,
          status: p.http_status,
          acquired: p.acquired,
          bytes: p.bytes,
          sha256: p.sha256,
        })),
        sources: acq.sources.map((s) => ({
          source: s.source,
          level: s.level,
          status: s.status,
          strict_events: s.strict_events,
          sha256: s.sha256,
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
