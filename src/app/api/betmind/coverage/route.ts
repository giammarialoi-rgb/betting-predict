import { NextResponse } from "next/server";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { permanentRoot044 } from "@/domain/eval/permanent-044/config";
import { dataIntelligenceRoot } from "@/domain/eval/data-intelligence/audit";
import { isTestScrapeEnabled } from "@/domain/sources/scraping-policy";

export const dynamic = "force-dynamic";

function readJson(path: string): unknown | null {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
  } catch {
    return null;
  }
}

/** Read-only coverage + feature-availability — disk only. */
export async function GET() {
  const root = permanentRoot044();
  const di = dataIntelligenceRoot(root);
  const coverage = readJson(join(di, "coverage-report.json")) as Record<string, unknown> | null;
  const availability = readJson(join(di, "feature-availability.json"));
  if (!coverage && !availability) {
    return NextResponse.json(
      {
        ok: false,
        error: "coverage reports missing — run pnpm audit:data-intelligence",
        real_money: false,
        test_scrape_enabled: isTestScrapeEnabled(),
      },
      { status: 404 },
    );
  }
  return NextResponse.json({
    ok: true,
    real_money: false,
    test_scrape_enabled: isTestScrapeEnabled(),
    DATA_COVERAGE: coverage?.DATA_COVERAGE ?? coverage?.avg_feature_coverage ?? null,
    SOURCE_COUNT: coverage?.SOURCE_COUNT ?? null,
    SOURCE_AGREEMENT: coverage?.SOURCE_AGREEMENT ?? null,
    TIMESTAMP_QUALITY: coverage?.TIMESTAMP_QUALITY ?? null,
    coverage,
    feature_availability: availability,
  });
}
