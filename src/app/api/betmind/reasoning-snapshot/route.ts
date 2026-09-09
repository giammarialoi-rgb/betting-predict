import { NextRequest, NextResponse } from "next/server";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { permanentRoot044 } from "@/domain/eval/permanent-044/config";
import { piRoot } from "@/domain/eval/predictive-intelligence/config";

export const dynamic = "force-dynamic";

/**
 * Read-only reasoning snapshots from disk jsonl.
 * Query: ?event_id=...&limit=20
 */
export async function GET(req: NextRequest) {
  const root = permanentRoot044();
  const path = join(piRoot(root), "reasoning", "snapshots.jsonl");
  if (!existsSync(path)) {
    return NextResponse.json(
      {
        ok: false,
        error: "reasoning/snapshots.jsonl missing",
        real_money: false,
        snapshots: [],
      },
      { status: 404 },
    );
  }

  const eventId = req.nextUrl.searchParams.get("event_id");
  const limit = Math.min(100, Math.max(1, Number(req.nextUrl.searchParams.get("limit") ?? 20)));

  const lines = readFileSync(path, "utf8")
    .split(/\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const parsed: unknown[] = [];
  for (let i = lines.length - 1; i >= 0 && parsed.length < limit * 4; i -= 1) {
    try {
      const row = JSON.parse(lines[i]!) as { event_id?: string };
      if (eventId && row.event_id !== eventId) continue;
      parsed.push(row);
      if (parsed.length >= limit) break;
    } catch {
      /* skip bad line */
    }
  }

  return NextResponse.json({
    ok: true,
    real_money: false,
    event_id: eventId,
    count: parsed.length,
    snapshots: parsed,
  });
}
