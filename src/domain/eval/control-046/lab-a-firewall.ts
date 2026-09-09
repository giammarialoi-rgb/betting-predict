import { createHash } from "node:crypto";
import { loadStore039 } from "@/domain/eval/live-039/store";
import { labAStore044 } from "@/domain/eval/permanent-044/config";

export function labAFingerprint046(root = labAStore044()): {
  events: number;
  decisions: number;
  decisions_hash: string;
} {
  const store = loadStore039(root);
  return {
    events: store.events.length,
    decisions: store.decisions.length,
    decisions_hash: createHash("sha256").update(JSON.stringify(store.decisions)).digest("hex"),
  };
}

export function assertLabAUntouched046(
  before: { events: number; decisions: number; decisions_hash: string },
  after = labAFingerprint046(),
): void {
  if (after.events !== before.events || after.decisions !== before.decisions || after.decisions_hash !== before.decisions_hash) {
    throw new Error("LAB_A_MUTATION_DETECTED");
  }
}
