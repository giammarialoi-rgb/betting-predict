import { NextResponse } from "next/server";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { permanentRoot044 } from "@/domain/eval/permanent-044/config";
import { dataIntelligenceRoot } from "@/domain/eval/data-intelligence/audit";
import { buildSourceRegistry, clubEloCachePresent } from "@/domain/eval/data-intelligence/registry";
import { isTestScrapeEnabled } from "@/domain/sources/scraping-policy";
import { buildOperationalSourceEngine } from "@/domain/eval/data-intelligence/research/source-engine";
import { loadStore044 } from "@/domain/eval/permanent-044/store";
import { loadRuntimeStatus } from "@/domain/eval/betmind-runtime/remote-status";
import {
  localLabStorePresent,
  operationalHasNeonSignal,
  overlayRegistryWithOperational,
  type OperationalOverlay,
  type OverlaySourceCard,
} from "@/domain/eval/betmind-runtime/production-mirror";
import type { SourceEntry } from "@/domain/eval/data-intelligence/types";
import {
  overlayRegistryWithAcquisitionCycle,
  readLastAcquisitionCycle,
} from "@/domain/eval/acquisition-engine/coverage-overlay";
import { isActiveFontiSource, isPrunedFontiSource } from "@/domain/eval/acquisition-engine/active-fonti";
import { listSourceRuntimeFromNeon } from "@/domain/eval/mega-pipeline/neon-runtime";

export const dynamic = "force-dynamic";

/** Source registry — disk if present, else Neon operational overlay, else in-memory catalog. */
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

  let operationalSource: "disk" | "neon" | "none" = "none";
  let operational = localLabStorePresent(root)
    ? buildOperationalSourceEngine({ labBRoot: root, eventLabels })
    : [];
  if (operational.length > 0) operationalSource = "disk";

  let remote: Awaited<ReturnType<typeof loadRuntimeStatus>> = null;
  if (operational.length === 0) {
    try {
      remote = await loadRuntimeStatus();
      const fromNeon = (remote?.payload?.observatory as { source_engine?: unknown } | undefined)
        ?.source_engine;
      if (Array.isArray(fromNeon) && fromNeon.length > 0) {
        operational = fromNeon as typeof operational;
        operationalSource = "neon";
      }
    } catch {
      /* Neon mirror optional */
    }
  }

  const registryFromDisk = existsSync(path)
    ? (() => {
        try {
          return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, "")) as {
            sources?: SourceEntry[];
            note?: string;
            at?: string;
          };
        } catch {
          return null;
        }
      })()
    : null;

  const registry: SourceEntry[] = Array.isArray(registryFromDisk?.sources)
    ? registryFromDisk!.sources!
    : buildSourceRegistry({
        clubeloCachePresent: clubEloCachePresent(process.cwd()),
        testScrapeEnabled: testScrape,
      });

  let sources: OverlaySourceCard[] = overlayRegistryWithAcquisitionCycle(
    overlayRegistryWithOperational(
      registry,
      operational as OperationalOverlay[],
    ),
    readLastAcquisitionCycle(process.cwd()),
  );

  /** Observed HTTP / yield from mega source_runtime (truth over catalog ACTIVE). */
  let source_runtime: Array<Record<string, unknown>> = [];
  try {
    source_runtime = await listSourceRuntimeFromNeon();
    if (source_runtime.length) {
      const byId = new Map(source_runtime.map((r) => [String(r.source_id), r]));
      sources = sources.map((s) => {
        const hit = byId.get(s.id);
        if (!hit) return s;
        return {
          ...s,
          status: String(hit.status ?? s.status),
          reason: String(hit.note_it ?? hit.note ?? s.reason ?? ""),
          last_attempt: hit.observed_at ? String(hit.observed_at) : s.last_attempt,
          last_success: hit.last_success_at ? String(hit.last_success_at) : s.last_success,
          http_status: hit.http_status != null ? Number(hit.http_status) : undefined,
          events_found: hit.events_found != null ? Number(hit.events_found) : undefined,
          fields_extracted: Array.isArray(hit.fields_extracted)
            ? (hit.fields_extracted as string[])
            : undefined,
          method: hit.method ? String(hit.method) : undefined,
          role_observed: hit.role ? String(hit.role) : undefined,
        } as OverlaySourceCard;
      });
    }
  } catch {
    source_runtime = [];
  }

  const neonSignal = operationalSource === "neon" && operationalHasNeonSignal(operational);
  const source =
    registryFromDisk && localLabStorePresent(root)
      ? "disk"
      : neonSignal || source_runtime.length > 0
        ? "neon"
        : registryFromDisk
          ? "disk"
          : "memory";

  const note = source_runtime.length
    ? "Stato fonti da probe runtime Neon (HTTP reale + yield). HTTP 200 senza dati = NO_DATA, non SUCCESS."
    : neonSignal
      ? "Stato fonti dallo specchio Neon (rendimento reale). Il catalogo nomi è di registro; i numeri non sono inventati."
      : registryFromDisk
        ? registryFromDisk.note
        : "Lab B source-registry.json assente su questo host — registro in memoria. Overlay Neon assente o senza dati.";

  const fontiOperational = operational.filter((s) => {
    const id = String((s as { source_id?: string; id?: string }).source_id ?? (s as { id?: string }).id ?? "");
    if (!id || isPrunedFontiSource(id) || !isActiveFontiSource(id)) return false;
    if ((s as { missing_adapter?: boolean }).missing_adapter) return false;
    if (String((s as { status?: string }).status ?? "") === "MISSING_ADAPTER") return false;
    return true;
  });

  return NextResponse.json({
    ok: true,
    source,
    operational_source: operationalSource,
    at: registryFromDisk?.at ?? new Date().toISOString(),
    real_money: false,
    test_scrape_enabled: testScrape,
    scrape_enters_model: false,
    note,
    sources,
    operational: fontiOperational,
    source_runtime,
  });
}
