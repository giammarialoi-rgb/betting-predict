import { blockedSources035, probePublic035, writeProbes035 } from "@/domain/eval/breakthrough-035/acquire";
import { catalog035 } from "@/domain/eval/breakthrough-035/catalog";
import { inventoryFilesystem035 } from "@/domain/eval/breakthrough-035/inventory";
import { loadAllNewQuotes035 } from "@/domain/eval/breakthrough-035/parsers";

async function main() {
  const skip = process.env.TASK_035_SKIP_HEAVY === "1";
  const inv = skip ? { files: [], roots_missing: [] } : await inventoryFilesystem035({ hashMaxBytes: 40_000_000 });
  const quotes = loadAllNewQuotes035({ skipHeavy: skip });
  const probes = skip ? [] : await probePublic035({ timeoutMs: 12_000 });
  if (!skip) writeProbes035(probes);
  console.log(
    JSON.stringify(
      {
        acquisition_status: skip ? "LOCAL_FIXTURE" : "LOCAL_PLUS_PROBES",
        catalog: catalog035().length,
        files_seen: inv.files.length,
        roots_missing: inv.roots_missing,
        new_quotes: quotes.length,
        blocked: blockedSources035(),
        probes: probes.map((p) => ({ id: p.id, status: p.http_status, class: p.classification, acquired: p.acquired })),
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
