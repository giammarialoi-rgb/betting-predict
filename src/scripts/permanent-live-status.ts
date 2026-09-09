import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { permanentRoot044 } from "@/domain/eval/permanent-044/config";
import { loadStore044 } from "@/domain/eval/permanent-044/store";
import { buildDailyFactory045 } from "@/domain/eval/factory-045/daily";
import { loadDiscoveryState045 } from "@/domain/eval/factory-045/config";

const root = permanentRoot044();
const mode = process.argv[2] ?? "status";

if (mode === "logs") {
  const log = join(root, "collector.log");
  if (existsSync(log)) console.log(readFileSync(log, "utf8").split(/\n/).slice(-80).join("\n"));
  else console.log("(no logs)");
  process.exit(0);
}

const statusPath = join(root, "collector-status.json");
const lockPath = join(root, "collector.lock");
const store = loadStore044(root);
const daily = buildDailyFactory045(store, new Date().toISOString().slice(0, 10));
const dstate = loadDiscoveryState045(root);
let status = "UNKNOWN";
let lock = null as unknown;
if (existsSync(statusPath)) status = (JSON.parse(readFileSync(statusPath, "utf8")) as { status: string }).status;
if (existsSync(lockPath)) lock = JSON.parse(readFileSync(lockPath, "utf8"));
console.log(
  JSON.stringify(
    {
      root,
      status,
      lock,
      daily,
      discovery: dstate,
      note: "114 seed is not a catalog cap — run pnpm permanent-live:discover --force",
    },
    null,
    2,
  ),
);
