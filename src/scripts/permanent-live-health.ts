import { config } from "dotenv";
import { buildHealthPayload053 } from "@/domain/eval/bankroll-053/system";
import { loadSourceHealth053 } from "@/domain/eval/bankroll-053/source-health";
import { loadChallengerRegistry053 } from "@/domain/eval/bankroll-053/challenger";
import { permanentRoot044 } from "@/domain/eval/permanent-044/config";

config({ path: ".env.local" });
config({ path: ".env" });

const root = permanentRoot044();
console.log(
  JSON.stringify(
    {
      ...buildHealthPayload053(root),
      source_health: loadSourceHealth053(root),
      challengers: loadChallengerRegistry053(root),
    },
    null,
    2,
  ),
);
