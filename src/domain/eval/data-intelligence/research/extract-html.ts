/**
 * Generic HTML/JSON extraction for event research.
 * Homepage HTTP 200 is never SUCCESS. Typed numbers require EVENT_MATCHED.
 * No WAF/CAPTCHA bypass. Odds keys are never extracted into model fields.
 */
export type EventMatchKind =
  | "EVENT_MATCHED"
  | "NO_EVENT"
  | "WRONG_EVENT"
  | "AMBIGUOUS_EVENT";

export type ExtractStatus =
  | "SUCCESS"
  | "PARTIAL"
  | "NO_EVENT"
  | "WRONG_EVENT"
  | "AMBIGUOUS_EVENT"
  | "NO_DATA"
  | "DYNAMIC_CONTENT_UNAVAILABLE"
  | "PARSE_ERROR";

export type ExtractedField = {
  key: string;
  value: number | string;
  evidence: string;
};

export type HtmlExtractResult = {
  match: EventMatchKind;
  status: ExtractStatus;
  fields: ExtractedField[];
  json_blocks: number;
  content_hash: string;
  reason: string;
};

const ODDS_KEY = /^(odd|odds|price|implied|handicap|over25|under25|maxhome|maxdraw|maxaway)/i;

function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function teamTokens(name: string): string[] {
  const n = norm(name)
    .replace(/\b(fc|afc|cf|sc|united|city|club|de|the)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const parts = n.split(" ").filter((p) => p.length >= 3);
  return parts.length ? parts : n.split(" ").filter(Boolean);
}

function mentionsTeam(hay: string, name: string): boolean {
  const h = norm(hay);
  if (h.includes(norm(name)) && norm(name).length >= 4) return true;
  const toks = teamTokens(name);
  if (toks.length === 0) return false;
  return toks.every((t) => h.includes(t));
}

export function matchEventInText(text: string, home: string, away: string): EventMatchKind {
  const homeOk = mentionsTeam(text, home);
  const awayOk = mentionsTeam(text, away);
  if (homeOk && awayOk) return "EVENT_MATCHED";
  if (homeOk || awayOk) return "AMBIGUOUS_EVENT";
  return "NO_EVENT";
}

function looksDynamicShell(html: string): boolean {
  const t = html.toLowerCase();
  const textLen = html.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<[^>]+>/g, "").trim().length;
  if (textLen < 80 && (t.includes("__next") || t.includes('id="root"') || t.includes("id='root'") || t.includes("ng-app"))) {
    return true;
  }
  return false;
}

function extractJsonBlocks(html: string): unknown[] {
  const out: unknown[] = [];
  const ld = [...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  for (const m of ld) {
    try {
      out.push(JSON.parse(m[1]!.trim()));
    } catch {
      /* skip */
    }
  }
  const scripts = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)];
  for (const m of scripts) {
    const body = m[1] ?? "";
    const objs = body.match(/\{[^{}]{20,4000}\}/g) ?? [];
    for (const raw of objs.slice(0, 40)) {
      if (!/"xg"|expectedGoals|"shots"|possession|sportsEvent/i.test(raw)) continue;
      try {
        out.push(JSON.parse(raw));
      } catch {
        /* skip */
      }
    }
  }
  return out;
}

function walkJson(v: unknown, acc: ExtractedField[], depth = 0): void {
  if (depth > 8 || v == null) return;
  if (Array.isArray(v)) {
    for (const x of v.slice(0, 80)) walkJson(x, acc, depth + 1);
    return;
  }
  if (typeof v !== "object") return;
  const rec = v as Record<string, unknown>;
  for (const [k, val] of Object.entries(rec)) {
    if (ODDS_KEY.test(k)) continue;
    if (typeof val === "number" && Number.isFinite(val)) {
      const key = mapStatKey(k);
      if (key) acc.push({ key, value: val, evidence: `${k}=${val}` });
    }
    if (typeof val === "string" && /^(xg|xga|possession|shots)$/i.test(k)) {
      const n = Number(val.replace(",", "."));
      if (Number.isFinite(n)) {
        const key = mapStatKey(k);
        if (key) acc.push({ key, value: n, evidence: `${k}=${val}` });
      }
    }
    if (typeof val === "object") walkJson(val, acc, depth + 1);
  }
}

function mapStatKey(raw: string): string | null {
  const k = raw.toLowerCase().replace(/[^a-z0-9]+/g, "_");
  if (ODDS_KEY.test(k)) return null;
  const map: Record<string, string> = {
    xg: "xg",
    expectedgoals: "xg",
    expected_goals: "xg",
    xga: "xga",
    shots: "shots",
    shotstotal: "shots",
    shotsontarget: "shots_on_target",
    sot: "shots_on_target",
    corners: "corners",
    possession: "possession",
    yellowcards: "yellow_cards",
    redcards: "red_cards",
    fouls: "fouls",
    formation: "formation",
    referee: "referee",
  };
  return map[k] ?? null;
}

function extractLabeledHtmlStats(html: string): ExtractedField[] {
  const text = html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ");
  const fields: ExtractedField[] = [];
  const patterns: Array<{ re: RegExp; key: string }> = [
    { re: /\bxG\b[^0-9]{0,24}(\d+(?:[.,]\d+)?)/i, key: "xg" },
    { re: /expected goals[^0-9]{0,24}(\d+(?:[.,]\d+)?)/i, key: "xg" },
    { re: /\bshots on target\b[^0-9]{0,24}(\d+(?:[.,]\d+)?)/i, key: "shots_on_target" },
    { re: /\bshots\b[^0-9]{0,24}(\d{1,3})\b/i, key: "shots" },
    { re: /\bcorners\b[^0-9]{0,24}(\d{1,3})\b/i, key: "corners" },
    { re: /\bpossession\b[^0-9]{0,24}(\d{1,3})\s*%/i, key: "possession" },
  ];
  for (const p of patterns) {
    const m = text.match(p.re);
    if (!m) continue;
    const n = Number(String(m[1]).replace(",", "."));
    if (!Number.isFinite(n)) continue;
    fields.push({ key: p.key, value: n, evidence: m[0].slice(0, 80) });
  }
  return fields;
}

function simpleHash(s: string): string {
  let h = 0;
  for (let i = 0; i < Math.min(s.length, 200_000); i += 1) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return `h${(h >>> 0).toString(16)}`;
}

export function extractEventHtml(input: {
  html: string;
  home: string;
  away: string;
}): HtmlExtractResult {
  const html = input.html ?? "";
  const content_hash = simpleHash(html);
  if (html.trim().length < 40) {
    return {
      match: "NO_EVENT",
      status: "NO_DATA",
      fields: [],
      json_blocks: 0,
      content_hash,
      reason: "Empty or tiny HTML body.",
    };
  }
  if (looksDynamicShell(html)) {
    return {
      match: matchEventInText(html, input.home, input.away),
      status: "DYNAMIC_CONTENT_UNAVAILABLE",
      fields: [],
      json_blocks: 0,
      content_hash,
      reason: "Page looks like a JS shell without extractable match data. No invented SUCCESS.",
    };
  }

  const match = matchEventInText(html, input.home, input.away);
  const jsonBlocks = extractJsonBlocks(html);
  const fromJson: ExtractedField[] = [];
  for (const b of jsonBlocks) walkJson(b, fromJson);
  const fromHtml = extractLabeledHtmlStats(html);
  const merged = [...fromJson, ...fromHtml].filter((f) => !ODDS_KEY.test(f.key));
  const uniq = new Map<string, ExtractedField>();
  for (const f of merged) {
    if (!uniq.has(f.key)) uniq.set(f.key, f);
  }
  const fields = [...uniq.values()];

  if (match === "NO_EVENT") {
    return {
      match,
      status: "NO_EVENT",
      fields: [],
      json_blocks: jsonBlocks.length,
      content_hash,
      reason: "HTTP body does not contain both team names. Not event data.",
    };
  }
  if (match === "AMBIGUOUS_EVENT") {
    return {
      match,
      status: "AMBIGUOUS_EVENT",
      fields: [],
      json_blocks: jsonBlocks.length,
      content_hash,
      reason: "Only one team name found. Not treated as this fixture.",
    };
  }
  if (fields.length === 0) {
    return {
      match: "EVENT_MATCHED",
      status: "PARTIAL",
      fields: [],
      json_blocks: jsonBlocks.length,
      content_hash,
      reason: "Both teams mentioned; no typed match statistics extracted.",
    };
  }
  return {
    match: "EVENT_MATCHED",
    status: "SUCCESS",
    fields,
    json_blocks: jsonBlocks.length,
    content_hash,
    reason: `Event matched; extracted ${fields.map((f) => f.key).join(", ")}.`,
  };
}
