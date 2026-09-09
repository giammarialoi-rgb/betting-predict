import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });
import { loadStore039 } from "@/domain/eval/live-039/store";
import { storeRoot039 } from "@/domain/eval/live-039/config";
import { settledVerified039, liveHealth039 } from "@/domain/eval/live-039/health";

const s = loadStore039(storeRoot039());
const now = Date.now();
const kicks = s.events.map((e) => e.commence_time).filter(Boolean).sort() as string[];
const past = s.events.filter((e) => e.commence_time && Date.parse(e.commence_time) < now).length;
const future = s.events.filter((e) => e.commence_time && Date.parse(e.commence_time) >= now).length;
console.log(
  JSON.stringify(
    {
      root: storeRoot039(),
      events: s.events.length,
      quotes: s.quotes.length,
      decisions: s.decisions.length,
      settlements: s.settlements.length,
      settled: settledVerified039(s),
      pastKickoffs: past,
      futureKickoffs: future,
      earliest: kicks[0] ?? null,
      latest: kicks.at(-1) ?? null,
      missingTo100: Math.max(0, 100 - settledVerified039(s)),
      apiKey: Boolean(process.env.THE_ODDS_API_KEY),
      health: liveHealth039(s),
    },
    null,
    2,
  ),
);
