import { config } from "dotenv";
import { collectOnce036 } from "@/domain/eval/prospective-036/collector";
import { loadExp036Config, storeRoot036 } from "@/domain/eval/prospective-036/config";
import { resolveLiveAdapters } from "@/domain/eval/prospective-036/sources";
import { loadStore036 } from "@/domain/eval/prospective-036/store";

config({ path: ".env.local" });
config({ path: ".env" });

async function cycle(): Promise<void> {
  const store = loadStore036(storeRoot036());
  const adapters = resolveLiveAdapters();
  const result = await collectOnce036({ store, adapters });
  console.log(
    JSON.stringify({
      at: new Date().toISOString(),
      configured: adapters.filter((a) => a.configured()).map((a) => a.id),
      ...result,
    }),
  );
}

async function main() {
  const cfg = loadExp036Config();
  const interval = cfg.poll_interval_ms;
  console.log(JSON.stringify({ loop: true, poll_interval_ms: interval, store: storeRoot036() }));
  await cycle();
  const timer = setInterval(() => {
    cycle().catch((err) => console.error(err));
  }, interval);
  const stop = () => {
    clearInterval(timer);
    process.exit(0);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
