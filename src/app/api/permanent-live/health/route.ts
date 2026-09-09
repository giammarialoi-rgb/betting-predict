import { NextResponse } from "next/server";
import { buildHealthPayload053 } from "@/domain/eval/bankroll-053/system";
import { permanentRoot044 } from "@/domain/eval/permanent-044/config";
import { loadSourceHealth053 } from "@/domain/eval/bankroll-053/source-health";
import { loadChallengerRegistry053 } from "@/domain/eval/bankroll-053/challenger";
import { loadAutostartStatus055 } from "@/domain/eval/catalog-055/autostart";
import { assessConsolidation055 } from "@/domain/eval/catalog-055/consolidation";
import { buildApiSportsHealth057 } from "@/domain/data-sources/api-sports/health";
import { loadBudget057 } from "@/domain/data-sources/api-sports/budget";

export const dynamic = "force-dynamic";

/** Disk-only health. Zero Odds API from browser. */
export async function GET() {
  const root = permanentRoot044();
  const base = buildHealthPayload053(root);
  return NextResponse.json({
    ...base,
    source_health: loadSourceHealth053(root),
    challengers: loadChallengerRegistry053(root),
    autostart: loadAutostartStatus055(root),
    consolidation: assessConsolidation055({ leakagePass: true, reproducibilityPass: true }),
    api_sports_057: {
      health: buildApiSportsHealth057(),
      budget: loadBudget057(),
      key_exposed: false as const,
    },
  });
}
