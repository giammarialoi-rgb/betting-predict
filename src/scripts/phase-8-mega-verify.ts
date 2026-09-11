/**
 * Phase 8 real verification cycle — ≥20 upcoming when sources return them.
 * No mocks. No invented xG. HTTP 200 without events is not success.
 * NEON NON UTILIZZATO
 */
import { config } from "dotenv";
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ESPN_SCOREBOARDS, espnScoreboardUrl } from "@/domain/eval/acquisition-engine/catalog";
import { parseEspnScoreboard } from "@/domain/eval/acquisition-engine/sources/espn";
import { loadStore044 } from "@/domain/eval/permanent-044/store";
import { permanentRoot044 } from "@/domain/eval/permanent-044/config";
import { runEventResearchBatch } from "@/domain/eval/data-intelligence/research/run-event-research";
import { loadResearchObservationsForEvent } from "@/domain/eval/data-intelligence/research/observations-store";
import { enqueueUpcomingEvents } from "@/domain/eval/data-intelligence/research/queue";
import { storageBanner } from "@/domain/storage";
import type { PermanentEvent044 } from "@/domain/eval/permanent-044/types";

function fp(s: string): string {
  return createHash("sha256").update(s).digest("hex").slice(0, 24);
}

async function fetchText(url: string): Promise<{ status: number; text: string }> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 12_000);
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json,text/plain,*/*",
        "User-Agent": "betmind-phase8-verify/1.0 (ordinary GET; no WAF bypass)",
      },
      signal: ctrl.signal,
    });
    return { status: res.status, text: await res.text() };
  } finally {
    clearTimeout(t);
  }
}

async function discoverEspn(): Promise<{
  events: PermanentEvent044[];
  probes: Array<{ url: string; status: number; parsed: number }>;
}> {
  const nowIso = new Date().toISOString();
  const events: PermanentEvent044[] = [];
  const probes: Array<{ url: string; status: number; parsed: number }> = [];
  const boards = ESPN_SCOREBOARDS.filter((b) =>
    ["eng.1", "ita.1", "ger.1", "esp.1", "fra.1", "uefa.champions"].includes(b.slug),
  );
  for (const board of boards) {
    const url = espnScoreboardUrl(board);
    try {
      const { status, text } = await fetchText(url);
      const parsed = status === 200 ? parseEspnScoreboard(text, board.slug) : [];
      probes.push({ url, status, parsed: parsed.length });
      if (status !== 200 || parsed.length === 0) continue;
      for (const e of parsed) {
        if (!e.home || !e.away || !e.date) continue;
        const ko = Date.parse(e.date);
        if (!Number.isFinite(ko) || ko < Date.now()) continue;
        const event_id = fp(`espn|${e.id ?? `${e.home}|${e.away}|${e.date}`}`);
        events.push({
          event_id,
          canonical_event_id: event_id,
          source: "espn",
          source_event_id: String(e.id ?? event_id),
          sport: "soccer",
          competition: e.league ?? board.slug,
          country: null,
          home_or_a: e.home,
          away_or_b: e.away,
          kickoff_utc: e.date,
          collected_at_utc: nowIso,
          available_at_utc: nowIso,
          semantic_level: "RESEARCH",
          data_quality: 0.4,
          fingerprint: event_id,
          status: "UPCOMING",
        });
      }
    } catch (err) {
      probes.push({ url, status: 0, parsed: 0 });
      void err;
    }
  }
  return { events, probes };
}

async function main() {
  config({ path: ".env.local" });
  config({ path: ".env" });
  const nowIso = new Date().toISOString();
  const nowMs = Date.now();
  const root = permanentRoot044();
  const banner = storageBanner();

  let storeEvents: PermanentEvent044[] = [];
  try {
    storeEvents = loadStore044(root).events.filter((e) => {
      const ko = e.kickoff_utc ? Date.parse(e.kickoff_utc) : NaN;
      return Number.isFinite(ko) && ko >= nowMs;
    });
  } catch {
    storeEvents = [];
  }

  const espn = await discoverEspn();
  const byId = new Map<string, PermanentEvent044>();
  for (const e of [...storeEvents, ...espn.events]) byId.set(e.event_id, e);
  const upcoming = [...byId.values()].sort(
    (a, b) => Date.parse(a.kickoff_utc ?? "") - Date.parse(b.kickoff_utc ?? ""),
  );
  const queue = enqueueUpcomingEvents({ events: upcoming, nowMs, nowIso, root });
  const picked = upcoming.slice(0, 20);

  let research: Awaited<ReturnType<typeof runEventResearchBatch>> | null = null;
  if (picked.length) {
    research = await runEventResearchBatch({
      events: picked,
      cycleNumber: null,
      nowIso,
      labBRoot: root,
      maxEvents: 20,
    });
  }

  let observations = 0;
  for (const e of picked) {
    observations += loadResearchObservationsForEvent(e.event_id, root).length;
  }

  const report = {
    at: nowIso,
    commit_hint: "phase-8-mega",
    storage: banner,
    neon_in_use: false,
    neon_status_it: "NEON NON UTILIZZATO",
    store_upcoming: storeEvents.length,
    espn_probes: espn.probes,
    espn_upcoming: espn.events.length,
    queued: queue.items.length,
    events_researched: picked.length,
    research,
    observations_for_researched: observations,
    sample: picked.slice(0, 5).map((e) => ({
      event_id: e.event_id,
      home: e.home_or_a,
      away: e.away_or_b,
      kickoff_utc: e.kickoff_utc,
      competition: e.competition,
      source: e.source,
    })),
    honest_note:
      picked.length < 20
        ? `Only ${picked.length} upcoming events were available from store+ESPN. Not padded.`
        : "Researched 20 upcoming events from real sources.",
  };

  const outDir = join(process.cwd(), "artifacts", "phase-8");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "mega-verification.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
