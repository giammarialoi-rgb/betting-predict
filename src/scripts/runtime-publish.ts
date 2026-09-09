/**
 * One-shot: publish local Lab B runtime status to Neon for Vercel health/snapshot.
 * Usage: pnpm runtime:publish
 */
import { config } from "dotenv";
import { resolve } from "node:path";

config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });

import {
  buildRuntimePayloadFromLocal,
  publishRuntimeStatus,
} from "@/domain/eval/betmind-runtime/remote-status";

async function main() {
  const payload = buildRuntimePayloadFromLocal();
  const result = await publishRuntimeStatus(payload);
  const next = (payload.observatory?.next_events as unknown[]) ?? [];
  console.log(
    JSON.stringify(
      {
        ...result,
        host: payload.host,
        components: payload.components,
        brain_status: payload.detail.brain_status,
        store_present_local: payload.store_present_local,
        analysis: payload.analysis,
        board_events: next.length,
        sample_event: next[0] ?? null,
      },
      null,
      2,
    ),
  );
  if (!result.ok) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
