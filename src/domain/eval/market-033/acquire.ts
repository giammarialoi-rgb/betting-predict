import { createHash } from "node:crypto";
import type { Probe033, SourceKind033 } from "@/domain/eval/market-033/types";

const SKIP_BLOCKED = [
  "ClubElo",
  "football-data.co.uk",
  "OddsPapi",
  "5DollarFootballAPI",
  "historicdata.betfair.com",
  "Football Charts",
] as const;

type Spec = { id: string; url: string; cluster: SourceKind033; inspect: (body: string, status: number) => Pick<Probe033, "classification" | "note" | "acquired"> };

const SPECS: Spec[] = [
  {
    id: "hf-olivier-closing-sample",
    url: "https://huggingface.co/api/datasets/oliviersportsdata/Sample-Historical-Football-Odds",
    cluster: "UNKNOWN",
    inspect: (body, status) => {
      if (status < 200 || status >= 300) {
        return { acquired: false, classification: "UNREACHABLE", note: `HTTP ${status}` };
      }
      const closing = /closing/i.test(body);
      return {
        acquired: true,
        classification: closing ? "DATE_ONLY_OR_CLOSING_SAMPLE" : "INSPECTED_NO_CLOCK",
        note: "HuggingFace 1% sample advertised as closing odds 1998–2026. Not a quote clock. Paid master set not acquired.",
      };
    },
  },
  {
    id: "hf-olivier-parquet",
    url: "https://huggingface.co/api/datasets/oliviersportsdata/Sample-Historical-Football-Odds/parquet/default/train",
    cluster: "UNKNOWN",
    inspect: (body, status) => {
      if (status === 401 || status === 403) {
        return { acquired: false, classification: "ACCESS_BLOCKED", note: "parquet listing gated" };
      }
      if (status < 200 || status >= 300) {
        return { acquired: false, classification: "UNREACHABLE", note: `HTTP ${status}` };
      }
      return {
        acquired: /parquet|url/i.test(body),
        classification: "CLOSING_SAMPLE_LISTING",
        note: body.slice(0, 180).replace(/\s+/g, " "),
      };
    },
  },
  {
    id: "petermclagan-sample-listing",
    url: "https://api.github.com/repos/petermclagan/betfair-historical/contents/tests/sample_data",
    cluster: "MIRROR",
    inspect: (body, status) => {
      if (status < 200 || status >= 300) {
        return { acquired: false, classification: "UNREACHABLE", note: `HTTP ${status}` };
      }
      const names = (body.match(/"name":\s*"[^"]+"/g) ?? []).join(",");
      return {
        acquired: true,
        classification: "MIRROR_SAMPLE_LISTING",
        note: `Already on disk as TASK 023 football BASIC. Listing: ${names.slice(0, 240)}`,
      };
    },
  },
];

export function blockedSources033(): readonly string[] {
  return SKIP_BLOCKED;
}

export async function probePublic033(input: { timeoutMs?: number } = {}): Promise<Probe033[]> {
  const timeoutMs = input.timeoutMs ?? 8000;
  const out: Probe033[] = [];
  for (const spec of SPECS) {
    try {
      const ac = new AbortController();
      const t = setTimeout(() => ac.abort(), timeoutMs);
      const res = await fetch(spec.url, {
        signal: ac.signal,
        headers: { "user-agent": "task-033-scientific-inventory" },
      });
      clearTimeout(t);
      const body = await res.text();
      const ins = spec.inspect(body, res.status);
      const sha = ins.acquired ? createHash("sha256").update(body).digest("hex") : null;
      out.push({
        id: spec.id,
        url: spec.url,
        cluster: spec.cluster,
        attempted: true,
        acquired: ins.acquired,
        http_status: res.status,
        sha256: sha,
        classification: ins.classification,
        note: ins.note,
      });
    } catch (err) {
      out.push({
        id: spec.id,
        url: spec.url,
        cluster: spec.cluster,
        attempted: true,
        acquired: false,
        http_status: null,
        sha256: null,
        classification: "UNREACHABLE",
        note: err instanceof Error ? err.message : "fetch failed",
      });
    }
  }
  out.push({
    id: "skipped-already-blocked",
    url: SKIP_BLOCKED.join(" | "),
    cluster: "UNKNOWN",
    attempted: false,
    acquired: false,
    http_status: null,
    sha256: null,
    classification: "SKIP_BLOCKED",
    note: "Not re-probed: ClubElo, football-data.co.uk 503, OddsPapi, 5Dollar, Betfair Historic login, Football Charts paid.",
  });
  return out;
}
