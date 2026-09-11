import { NextResponse } from "next/server";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { permanentRoot044 } from "@/domain/eval/permanent-044/config";
import { dataIntelligenceRoot } from "@/domain/eval/data-intelligence/audit";
import {
  FEATURE_MANIFEST_P0,
  featureManifestP0Summary,
} from "@/domain/eval/data-intelligence/feature-manifest";
import { isTestScrapeEnabled } from "@/domain/sources/scraping-policy";
import { loadRuntimeStatus } from "@/domain/eval/betmind-runtime/remote-status";
import { localLabStorePresent } from "@/domain/eval/betmind-runtime/production-mirror";

export const dynamic = "force-dynamic";

function readJson(path: string): unknown | null {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
  } catch {
    return null;
  }
}

/** Coverage + feature-availability — disk if present, else P0 manifest fallback. */
export async function GET() {
  const root = permanentRoot044();
  const di = dataIntelligenceRoot(root);
  const coverage = readJson(join(di, "coverage-report.json")) as Record<string, unknown> | null;
  const availability = readJson(join(di, "feature-availability.json"));
  const testScrape = isTestScrapeEnabled();
  const summary = featureManifestP0Summary();

  if (!coverage && !availability) {
    const remote = localLabStorePresent(root) ? null : await loadRuntimeStatus();
    const analysis = remote?.payload?.analysis;
    return NextResponse.json({
      ok: true,
      source: analysis?.data_coverage != null ? "neon" : "memory",
      real_money: false,
      test_scrape_enabled: testScrape,
      DATA_COVERAGE: analysis?.data_coverage ?? null,
      SOURCE_COUNT: null,
      SOURCE_AGREEMENT: null,
      TIMESTAMP_QUALITY: null,
      FEATURES_ACTIVE: summary.by_readiness.ACTIVE,
      FEATURES_STUB: summary.by_readiness.STUB,
      FEATURES_MISSING: summary.by_readiness.MISSING,
      feature_manifest_p0: FEATURE_MANIFEST_P0,
      note:
        analysis?.data_coverage != null
          ? "Copertura dallo specchio Neon (analysis.data_coverage). Report Lab B assente su questo host."
          : "Nessun report di copertura Lab B su questo host — solo manifesto P0",
      coverage: analysis ? { DATA_COVERAGE: analysis.data_coverage } : null,
      feature_availability: null,
    });
  }

  return NextResponse.json({
    ok: true,
    source: "disk",
    real_money: false,
    test_scrape_enabled: testScrape,
    DATA_COVERAGE: coverage?.DATA_COVERAGE ?? coverage?.avg_feature_coverage ?? null,
    SOURCE_COUNT: coverage?.SOURCE_COUNT ?? null,
    SOURCE_AGREEMENT: coverage?.SOURCE_AGREEMENT ?? null,
    TIMESTAMP_QUALITY: coverage?.TIMESTAMP_QUALITY ?? null,
    coverage,
    feature_availability: availability,
  });
}
