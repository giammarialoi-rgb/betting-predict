import { NextResponse } from "next/server";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { permanentRoot044 } from "@/domain/eval/permanent-044/config";
import { dataIntelligenceRoot } from "@/domain/eval/data-intelligence/audit";
import { buildSourceRegistry, clubEloCachePresent } from "@/domain/eval/data-intelligence/registry";
import { isTestScrapeEnabled } from "@/domain/sources/scraping-policy";

export const dynamic = "force-dynamic";

/** Source registry — disk if present, else in-memory honest registry (Vercel-safe). */
export async function GET() {
  const root = permanentRoot044();
  const path = join(dataIntelligenceRoot(root), "source-registry.json");
  const testScrape = isTestScrapeEnabled();

  if (existsSync(path)) {
    try {
      const body = JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, "")) as Record<
        string,
        unknown
      >;
      return NextResponse.json({
        ok: true,
        source: "disk",
        test_scrape_enabled: testScrape,
        scrape_enters_model: false,
        ...body,
      });
    } catch {
      /* fall through to memory */
    }
  }

  const sources = buildSourceRegistry({
    clubeloCachePresent: clubEloCachePresent(process.cwd()),
    testScrapeEnabled: testScrape,
  });

  return NextResponse.json({
    ok: true,
    source: "memory",
    at: new Date().toISOString(),
    real_money: false,
    test_scrape_enabled: testScrape,
    scrape_enters_model: false,
    note: "Lab B source-registry.json absent on this host — live registry snapshot only",
    sources,
  });
}
