import { NextResponse } from "next/server";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { permanentRoot044 } from "@/domain/eval/permanent-044/config";
import { dataIntelligenceRoot } from "@/domain/eval/data-intelligence/audit";
import { buildSourceRegistry, clubEloCachePresent } from "@/domain/eval/data-intelligence/registry";
import { isTestScrapeEnabled } from "@/domain/sources/scraping-policy";
import { buildOperationalSourceEngine } from "@/domain/eval/data-intelligence/research/source-engine";
import { loadStore044 } from "@/domain/eval/permanent-044/store";

export const dynamic = "force-dynamic";

/** Source registry — disk if present, else in-memory honest registry (Vercel-safe). */
export async function GET() {
  const root = permanentRoot044();
  const path = join(dataIntelligenceRoot(root), "source-registry.json");
  const testScrape = isTestScrapeEnabled();
  let eventLabels = new Map<string, string>();
  try {
    const store = loadStore044(root);
    for (const e of store.events) {
      eventLabels.set(e.event_id, `${e.home_or_a} vs ${e.away_or_b}`);
    }
  } catch {
    eventLabels = new Map();
  }
  const operational = existsSync(root)
    ? buildOperationalSourceEngine({ labBRoot: root, eventLabels })
    : [];

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
        operational,
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
    operational,
  });
}
