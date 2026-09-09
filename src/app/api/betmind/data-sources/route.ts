import { NextResponse } from "next/server";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { permanentRoot044 } from "@/domain/eval/permanent-044/config";
import { dataIntelligenceRoot } from "@/domain/eval/data-intelligence/audit";
import { isTestScrapeEnabled } from "@/domain/sources/scraping-policy";

export const dynamic = "force-dynamic";

/** Read-only source registry — zero live vendor calls. */
export async function GET() {
  const root = permanentRoot044();
  const path = join(dataIntelligenceRoot(root), "source-registry.json");
  if (!existsSync(path)) {
    return NextResponse.json(
      {
        ok: false,
        error: "source-registry.json missing — run pnpm audit:data-intelligence",
        real_money: false,
        test_scrape_enabled: isTestScrapeEnabled(),
      },
      { status: 404 },
    );
  }
  const body = JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, "")) as Record<
    string,
    unknown
  >;
  return NextResponse.json({
    ok: true,
    test_scrape_enabled: isTestScrapeEnabled(),
    scrape_enters_model: false,
    ...body,
  });
}
