import { existsSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { permanentRoot044, ensurePermanentDirs044 } from "@/domain/eval/permanent-044/config";
import { writeCheckpoint044, appendJournal044, loadStore044 } from "@/domain/eval/permanent-044/store";

const root = permanentRoot044();
ensurePermanentDirs044(root);
const lockPath = join(root, "collector.lock");
if (existsSync(lockPath)) {
  try {
    const j = JSON.parse(readFileSync(lockPath, "utf8")) as { pid: number };
    try {
      process.kill(j.pid, 0);
      console.log(JSON.stringify({ ok: false, error: "still_running", pid: j.pid }));
      process.exit(2);
    } catch {
      unlinkSync(lockPath);
    }
  } catch {
    unlinkSync(lockPath);
  }
}
const store = loadStore044(root);
writeCheckpoint044(root, {
  recovered: true,
  events: store.events.length,
  predictions: store.predictions.length,
  locks: store.locks.length,
});
appendJournal044(root, { kind: "recover", events: store.events.length });
writeFileSync(
  join(root, "collector-status.json"),
  JSON.stringify({ status: "RECOVERED", pid: null, updated_at: new Date().toISOString() }, null, 2),
);
console.log(JSON.stringify({ ok: true, recovered_from_disk: true, events: store.events.length, locks: store.locks.length }));
