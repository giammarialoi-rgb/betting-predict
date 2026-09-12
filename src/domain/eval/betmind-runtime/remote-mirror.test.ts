import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, it } from "node:test";
import { POST } from "@/app/api/betmind/runtime/ingest/route";
import {
  acceptRuntimeIngest,
  authorizeRuntimeIngest,
  createMemoryRemoteMirrorStore,
  findDossierInRemoteMirror,
  isRealAnalysisDossier,
  isRemoteMirrorSource,
  pushRuntimeToRemoteIngest,
  remoteFreshness,
  setRemoteMirrorStoreOverride,
} from "@/domain/eval/betmind-runtime/remote-mirror";
import { honestyLayersIt } from "@/domain/eval/betmind-runtime/status-copy";
import { publishRuntimeStatus, RUNTIME_STALE_MS } from "@/domain/eval/betmind-runtime/remote-status";
import { staleMirrorComponents } from "@/domain/eval/betmind-runtime/production-mirror";
import { getStorage, NEON_IN_USE } from "@/domain/storage";
import type { BetMindRuntimePayload } from "@/domain/eval/betmind-runtime/remote-status";

function samplePayload(publishedAt: string, brain: "ONLINE" | "OFFLINE" = "ONLINE"): BetMindRuntimePayload {
  return {
    schema_version: 2,
    published_at: publishedAt,
    host: "test-pc",
    real_money: false,
    store_present_local: true,
    components: {
      supervisor: "ONLINE",
      worker: "ONLINE",
      brain,
      predictive_engine: "UNKNOWN",
      data_pipeline: "ONLINE",
      settlement: "UNKNOWN",
      learning: "UNKNOWN",
    },
    detail: { brain_status: brain === "ONLINE" ? "RUNNING" : "STOPPED", mirror: "filesystem" },
    health053: {},
    analysis: {
      cycle_number: 1,
      last_cycle_at: publishedAt,
      last_successful_cycle_at: publishedAt,
      priority: "research",
      idle: false,
      reason: null,
      events_in_store: 1,
      events_discovered: 1,
      events_analyzed: 0,
      predictions_produced: 0,
      decisions_on_board: 1,
      skipped: 0,
      no_bet: 0,
      model_version: "test",
      data_coverage: null,
      buckets: {
        DISCOVERED: 1,
        ELIGIBLE_FOR_MODEL: 0,
        ANALYZED: 0,
        SKIPPED: 0,
        UNAVAILABLE: 0,
      },
      no_events_available: false,
      no_events_reason: null,
      events_with_research: 0,
      events_eligible: 0,
      model_inferences: 0,
      predictions_persisted_events: 0,
      insufficient_data: 0,
      no_independent_features: 0,
      no_independent_model: 0,
      events_queued: 0,
      events_researched: 0,
      sources_attempted_today: 0,
      data_acquired_today: 0,
      sources_blocked_today: 0,
      sources_missing_adapter_today: 0,
    },
    observatory: {
      next_events: [
        {
          event_id: "ev-1",
          sport: "FOOTBALL",
          calendar_day: "2026-09-12",
          kickoff_utc: "2026-09-12T18:00:00Z",
          bucket: "DISCOVERED",
        },
      ],
    },
    predictive: {
      final_verdict: null,
      validation: null,
      model_manifest: null,
      learning_report: null,
      paper_bankroll_report: null,
    },
    learning_cases: [],
    recent_settlements: [],
    recent_autopsies: [],
  };
}

function ingestRequest(secret: string | null, body: unknown): Request {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (secret) headers.authorization = `Bearer ${secret}`;
  return new Request("http://localhost/api/betmind/runtime/ingest", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

const envKeys = [
  "BETMIND_RUNTIME_PUBLISH_SECRET",
  "BETMIND_RUNTIME_INGEST_URL",
  "BLOB_READ_WRITE_TOKEN",
  "DATABASE_URL",
] as const;

const envSnapshot = new Map<string, string | undefined>();
for (const key of envKeys) envSnapshot.set(key, process.env[key]);

afterEach(() => {
  setRemoteMirrorStoreOverride(null);
  for (const key of envKeys) {
    const prev = envSnapshot.get(key);
    if (prev === undefined) delete process.env[key];
    else process.env[key] = prev;
  }
});

describe("runtime ingest auth", () => {
  it("rejects missing and wrong secret — never writes", async () => {
    process.env.BETMIND_RUNTIME_PUBLISH_SECRET = "correct-secret-value";
    const mem = createMemoryRemoteMirrorStore();
    setRemoteMirrorStoreOverride(mem);

    const denied = authorizeRuntimeIngest(ingestRequest(null, {}));
    assert.equal(denied.ok, false);
    if (!denied.ok) assert.equal(denied.status, 401);

    const wrong = authorizeRuntimeIngest(ingestRequest("nope", {}));
    assert.equal(wrong.ok, false);
    if (!wrong.ok) assert.equal(wrong.status, 401);

    const res = await POST(ingestRequest("wrong-secret", { payload: samplePayload("2026-09-12T10:00:00.000Z") }));
    assert.equal(res.status, 401);
    const json = (await res.json()) as { ok: boolean; neon_in_use: boolean };
    assert.equal(json.ok, false);
    assert.equal(json.neon_in_use, false);
    assert.equal(await mem.read(), null);
  });

  it("returns 503 when the ingest secret is not configured on Vercel", () => {
    delete process.env.BETMIND_RUNTIME_PUBLISH_SECRET;
    const denied = authorizeRuntimeIngest(ingestRequest("anything", {}));
    assert.equal(denied.ok, false);
    if (!denied.ok) {
      assert.equal(denied.status, 503);
      assert.match(denied.error_it, /OFFLINE/);
    }
  });
});

describe("stale remote mirror stays OFFLINE", () => {
  it("marks a heartbeat older than RUNTIME_STALE_MS as not fresh and forces OFFLINE", () => {
    const published = "2026-09-12T10:00:00.000Z";
    const now = Date.parse(published) + RUNTIME_STALE_MS + 1;
    const { fresh, age_ms } = remoteFreshness(published, now, RUNTIME_STALE_MS);
    assert.equal(fresh, false);
    assert.ok(age_ms > RUNTIME_STALE_MS);
    const components = fresh ? samplePayload(published).components : staleMirrorComponents();
    assert.equal(components.brain, "OFFLINE");
    assert.equal(components.worker, "OFFLINE");
    assert.equal(components.data_pipeline, "OFFLINE");
  });

  it("keeps a fresh heartbeat eligible for ONLINE components", () => {
    const published = "2026-09-12T10:00:00.000Z";
    const now = Date.parse(published) + 30_000;
    const { fresh } = remoteFreshness(published, now, RUNTIME_STALE_MS);
    assert.equal(fresh, true);
    const payload = samplePayload(published, "ONLINE");
    const components = fresh ? payload.components : staleMirrorComponents();
    assert.equal(components.brain, "ONLINE");
  });
});

describe("remote mirror never uses Neon", () => {
  it("ignores DATABASE_URL and records neon_in_use=false", async () => {
    process.env.DATABASE_URL = "postgresql://user:pass@unused.neon.tech/neondb";
    process.env.BETMIND_RUNTIME_PUBLISH_SECRET = "s3cret";
    const mem = createMemoryRemoteMirrorStore();
    setRemoteMirrorStoreOverride(mem);
    const payload = samplePayload("2026-09-12T11:00:00.000Z");
    const result = await acceptRuntimeIngest({ payload });
    assert.equal(result.ok, true);
    assert.equal(result.neon_in_use, false);
    assert.equal(NEON_IN_USE, false);
    const art = await mem.read();
    assert.equal(art?.neon_in_use, false);
    assert.notEqual(art?.backend, "none");
    const store = getStorage(mkdtempSync(join(tmpdir(), "bm-no-neon-")));
    assert.equal(store.backend, "filesystem");
    assert.equal(store.neon_in_use, false);
  });

  it("stays local-only with clear OFFLINE when Blob is not configured", async () => {
    delete process.env.BLOB_READ_WRITE_TOKEN;
    delete process.env.VERCEL_OIDC_TOKEN;
    delete process.env.BLOB_STORE_ID;
    setRemoteMirrorStoreOverride(null);
    const result = await acceptRuntimeIngest({ payload: samplePayload("2026-09-12T11:00:00.000Z") });
    assert.equal(result.ok, false);
    assert.equal(result.status, 503);
    assert.equal(result.error, "blob_token_missing");
    assert.match(String(result.error_it), /OFFLINE/);
  });
});

describe("local filesystem remains SoT on the PC", () => {
  it("publishRuntimeStatus writes Lab B FS even without ingest URL", async () => {
    delete process.env.BETMIND_RUNTIME_INGEST_URL;
    delete process.env.BETMIND_RUNTIME_PUBLISH_SECRET;
    const cwd = mkdtempSync(join(tmpdir(), "bm-fs-sot-"));
    const root = join(cwd, "audit", "external", "task-044");
    mkdirSync(root, { recursive: true });
    writeFileSync(join(root, "events.jsonl"), "{}\n", "utf8");
    const prevCwd = process.cwd();
    process.chdir(cwd);
    try {
      const payload = samplePayload("2026-09-12T12:00:00.000Z");
      const result = await publishRuntimeStatus(payload);
      assert.equal(result.ok, true);
      if (result.ok) {
        assert.equal(result.remote.pushed, false);
        assert.equal(result.remote.reason, "local_only");
      }
      const store = getStorage(root);
      const loaded = store.loadRuntime();
      assert.equal(loaded?.published_at, "2026-09-12T12:00:00.000Z");
      assert.equal((loaded?.payload as BetMindRuntimePayload).host, "test-pc");
    } finally {
      process.chdir(prevCwd);
    }
  });

  it("pushes to the ingest URL when secret + URL are configured", async () => {
    const calls: { url: string; auth: string | null }[] = [];
    const payload = samplePayload("2026-09-12T12:30:00.000Z");
    const remote = await pushRuntimeToRemoteIngest(payload, undefined, {
      url: "https://example.vercel.app/api/betmind/runtime/ingest",
      secret: "shared",
      fetchImpl: (async (url, init) => {
        calls.push({
          url: String(url),
          auth: new Headers(init?.headers).get("authorization"),
        });
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }) as typeof fetch,
    });
    assert.equal(remote.pushed, true);
    assert.equal(calls.length, 1);
    assert.match(calls[0]!.url, /runtime\/ingest/);
    assert.equal(calls[0]!.auth, "Bearer shared");
  });
});

describe("remote dossiers survive board-only publish", () => {
  it("merges analysis_dossier rows and does not treat board as dossier", async () => {
    process.env.BETMIND_RUNTIME_PUBLISH_SECRET = "s3cret";
    const mem = createMemoryRemoteMirrorStore();
    setRemoteMirrorStoreOverride(mem);
    const dossier = {
      event: { event_id: "ev-1", home: "A", away: "B", competition: "BL", kickoff_utc: null, sport: "soccer", status: "UPCOMING" },
      independent_model: { probability: null },
      features: [],
      research: [],
      real_money: false,
    };
    assert.equal(isRealAnalysisDossier(dossier), true);
    const first = await acceptRuntimeIngest({
      payload: samplePayload("2026-09-12T13:00:00.000Z"),
      dossiers: [{ event_id: "ev-1", published_at: "2026-09-12T13:00:00.000Z", dossier, dossier_version: null }],
    });
    assert.equal(first.ok, true);
    assert.equal(first.dossiers, 1);

    const second = await acceptRuntimeIngest({ payload: samplePayload("2026-09-12T13:05:00.000Z") });
    assert.equal(second.ok, true);
    const art = await mem.read();
    assert.equal(findDossierInRemoteMirror(art, "ev-1") != null, true);
    assert.equal(isRealAnalysisDossier({ event_id: "ev-1", bucket: "DISCOVERED" }), false);
  });
});

describe("Italian honesty layers", () => {
  it("distinguishes App online vs Runtime offline vs Specchio scaduto", () => {
    assert.equal(
      honestyLayersIt({ webOnline: true, runtimeState: "ONLINE" }),
      "App online · Runtime online",
    );
    assert.equal(
      honestyLayersIt({ webOnline: true, runtimeState: "OFFLINE" }),
      "App online · Runtime offline",
    );
    assert.equal(
      honestyLayersIt({ webOnline: true, runtimeState: "ONLINE", mirrorStale: true }),
      "App online · Specchio scaduto",
    );
    assert.equal(isRemoteMirrorSource("remote"), true);
    assert.equal(isRemoteMirrorSource("local_disk"), false);
  });
});
