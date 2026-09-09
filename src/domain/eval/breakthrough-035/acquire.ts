import { createHash } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { catalog035 } from "@/domain/eval/breakthrough-035/catalog";
import type { Probe035 } from "@/domain/eval/breakthrough-035/types";

const DEST = join(process.cwd(), "audit", "external", "task-035");

type Spec = {
  id: string;
  url: string;
  inspect: (body: string, status: number) => Pick<Probe035, "classification" | "note" | "acquired">;
};

const SPECS: Spec[] = [
  {
    id: "betfair-historic",
    url: "https://historicdata.betfair.com/",
    inspect: (_b, status) => ({
      acquired: false,
      classification: status === 200 ? "LOGIN_HTML" : `HTTP_${status}`,
      note: "Official Betfair Historic. Login wall. No credentials used.",
    }),
  },
  {
    id: "football-data-e0-live",
    url: "https://www.football-data.co.uk/mmz4281/2526/E0.csv",
    inspect: (body, status) => ({
      acquired: status === 200 && /Div,/.test(body),
      classification: status === 503 ? "HTTP_503" : status === 200 ? "DATE_ONLY_CSV" : `HTTP_${status}`,
      note: "Live football-data.co.uk. Even on 200 this is OPEN/CLOSE + kickoff Time, not a quote clock.",
    }),
  },
  {
    id: "football-data-e0-ia",
    url: "https://web.archive.org/web/20200801120516id_/https://www.football-data.co.uk/mmz4281/1920/E0.csv",
    inspect: (body, status) => ({
      acquired: status === 200 && /Div,/.test(body),
      classification: status === 200 && /Div,/.test(body) ? "DATE_ONLY_IA_COPY" : `HTTP_${status}`,
      note: "Internet Archive copy of E0 2019/20 saved to audit/external/task-035/ia-e0-1920.csv. Kickoff Time present; odds lack publish timestamp.",
    }),
  },
  {
    id: "odds-api-no-key",
    url: "https://api.the-odds-api.com/v4/sports?apiKey=none",
    inspect: (_b, status) => ({
      acquired: false,
      classification: status === 401 ? "BLOCKED_API_KEY" : `HTTP_${status}`,
      note: "Historical endpoint is paid. No user key. No public dump of /v4/historical found.",
    }),
  },
  {
    id: "kaggle-obiguy",
    url: "https://www.kaggle.com/api/v1/datasets/download/obiguy/soccer-odds-data",
    inspect: (_b, status) => ({
      acquired: false,
      classification: status === 302 || status === 401 || status === 403 ? "BLOCKED_LOGIN" : `HTTP_${status}`,
      note: "Best remaining clocked-looking Pinnacle archive. No GitHub/HF/DOI/IA mirror.",
    }),
  },
  {
    id: "kaggle-wc-ts",
    url: "https://www.kaggle.com/api/v1/datasets/download/oliviersportsdata/worldcup-fulltimestamp-sample",
    inspect: (_b, status) => ({
      acquired: false,
      classification: status === 302 || status === 401 || status === 403 ? "BLOCKED_LOGIN" : `HTTP_${status}`,
      note: "Naive Snapshot_TS + date-only kickoff. No public copy.",
    }),
  },
  {
    id: "hf-olivier-card",
    url: "https://huggingface.co/api/datasets/oliviersportsdata/Sample-Historical-Football-Odds",
    inspect: (body, status) => ({
      acquired: status >= 200 && status < 300,
      classification: /closing/i.test(body) ? "DATE_ONLY_CLOSING_SAMPLE" : `HTTP_${status}`,
      note: "Public 1% closing sample already on disk. Master is paid.",
    }),
  },
  {
    id: "hf-soccer-stats",
    url: "https://huggingface.co/api/datasets/JulienDelavande/soccer_stats",
    inspect: (_b, httpStatus) => ({
      acquired: httpStatus >= 200 && httpStatus < 300,
      classification: "PUBLIC_CARD",
      note: "soccer_odds.csv is 18KB / one match. SQL dump is the same naive table.",
    }),
  },
  {
    id: "sharpapi-github",
    url: "https://api.github.com/repos/Sharp-API/sports-odds-sample-data/contents",
    inspect: (body, status) => ({
      acquired: status === 200,
      classification: status === 200 ? "PUBLIC_SNAPSHOT" : `HTTP_${status}`,
      note: `CC BY 4.0 snapshot listing: ${body.slice(0, 160).replace(/\s+/g, " ")}`,
    }),
  },
  {
    id: "ia-betfair-search",
    url: "https://archive.org/advancedsearch.php?q=betfair+soccer+BASIC+historical+prices&fl[]=identifier&output=json&rows=5",
    inspect: (body, _status) => {
      let n = 0;
      try {
        n = (JSON.parse(body) as { response?: { numFound?: number } }).response?.numFound ?? 0;
      } catch {
        n = 0;
      }
      return {
        acquired: false,
        classification: n === 0 ? "NOT_FOUND" : "IA_HITS_NEED_INSPECT",
        note: `Internet Archive numFound=${n}. No soccer BASIC price dump downloaded.`,
      };
    },
  },
  {
    id: "zenodo-12673394",
    url: "https://zenodo.org/api/records/12673394",
    inspect: (_b, status) => ({
      acquired: status === 200,
      classification: "DATE_ONLY_MIRROR",
      note: "Already on disk as TASK 026. football-data.co.uk lineage.",
    }),
  },
  {
    id: "figshare-news",
    url: "https://api.figshare.com/v2/articles/16884688",
    inspect: (_b, status) => ({
      acquired: status === 200,
      classification: "NEWS_NOT_ODDS",
      note: "Sports news metadata. No quote clock.",
    }),
  },
  {
    id: "github-betfairutil",
    url: "https://api.github.com/repos/mberk/betfairutil",
    inspect: (_b, status) => ({
      acquired: status === 200,
      classification: "PARSER_NO_DATA",
      note: "Parser for official Betfair bz2. Not an archive.",
    }),
  },
  {
    id: "petermclagan-samples",
    url: "https://api.github.com/repos/petermclagan/betfair-historical/contents/tests/sample_data",
    inspect: (_b, status) => ({
      acquired: status === 200,
      classification: "MIRROR_SAMPLE",
      note: "Already on disk TASK 023. n=1 football BASIC.",
    }),
  },
];

export async function probePublic035(input: { timeoutMs?: number } = {}): Promise<Probe035[]> {
  const timeoutMs = input.timeoutMs ?? 12_000;
  const out: Probe035[] = [];
  for (const spec of SPECS) {
    try {
      const ac = new AbortController();
      const t = setTimeout(() => ac.abort(), timeoutMs);
      const redirect: RequestRedirect = spec.id.startsWith("kaggle-") ? "manual" : "follow";
      const res = await fetch(spec.url, {
        signal: ac.signal,
        headers: { "user-agent": "task-035-scientific-inventory" },
        redirect,
      });
      clearTimeout(t);
      const body = await res.text();
      const ins = spec.inspect(body, res.status);
      out.push({
        id: spec.id,
        url: spec.url,
        attempted: true,
        acquired: ins.acquired,
        http_status: res.status,
        sha256: ins.acquired ? createHash("sha256").update(body.slice(0, 200_000)).digest("hex") : null,
        classification: ins.classification,
        note: ins.note,
      });
    } catch (err) {
      out.push({
        id: spec.id,
        url: spec.url,
        attempted: true,
        acquired: false,
        http_status: null,
        sha256: null,
        classification: "UNREACHABLE",
        note: err instanceof Error ? err.message : "fetch failed",
      });
    }
  }
  return out;
}

export function blockedSources035(): string[] {
  return catalog035()
    .filter((s) => s.access.startsWith("BLOCKED") || s.access === "UNREACHABLE" || s.access === "NOT_FOUND")
    .map((s) => s.id);
}

export function writeProbes035(probes: readonly Probe035[]): string {
  mkdirSync(DEST, { recursive: true });
  const artifacts = join(process.cwd(), "artifacts", "task-035");
  mkdirSync(artifacts, { recursive: true });
  const p = join(artifacts, "probes.json");
  writeFileSync(p, JSON.stringify(probes, null, 2));
  return p;
}

export function probesPath035(): string {
  return join(process.cwd(), "artifacts", "task-035", "probes.json");
}

export function probesExist035(): boolean {
  return existsSync(probesPath035());
}
