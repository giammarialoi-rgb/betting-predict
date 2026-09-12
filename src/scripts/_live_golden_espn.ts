/**
 * Lab-compatible alias for the Golden Event ESPN refresh.
 * Prefer: pnpm betmind:live -- --event de3b08b74a8249c647ee0e42
 */
import { GOLDEN_EVENT_ID } from "@/domain/eval/betmind-runtime/live-state";

process.argv.push("--event", GOLDEN_EVENT_ID);
await import("@/scripts/betmind-live");
