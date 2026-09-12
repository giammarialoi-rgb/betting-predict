import { NextResponse } from "next/server";
import {
  acceptRuntimeIngest,
  authorizeRuntimeIngest,
  blobCredentialsPresent,
  remoteMirrorDurableConfigured,
} from "@/domain/eval/betmind-runtime/remote-mirror";

export const dynamic = "force-dynamic";

/**
 * Authenticated PC → Vercel runtime ingest.
 * Writes one JSON artifact to Vercel Blob. NEON NON UTILIZZATO.
 */
export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "betmind-runtime-ingest",
    neon_in_use: false,
    ingest_secret_configured: Boolean(process.env.BETMIND_RUNTIME_PUBLISH_SECRET?.trim()),
    blob_configured: blobCredentialsPresent() || remoteMirrorDurableConfigured(),
    note_it:
      "POST con Bearer BETMIND_RUNTIME_PUBLISH_SECRET. Senza Blob, Vercel resta OFFLINE (solo locale sul PC).",
  });
}

export async function POST(req: Request) {
  const auth = authorizeRuntimeIngest(req);
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, neon_in_use: false, error: auth.error, error_it: auth.error_it },
      { status: auth.status },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      {
        ok: false,
        neon_in_use: false,
        error: "invalid_json",
        error_it: "JSON non valido.",
      },
      { status: 400 },
    );
  }

  const result = await acceptRuntimeIngest(body);
  return NextResponse.json(
    {
      ok: result.ok,
      neon_in_use: false,
      published_at: result.published_at,
      board: result.board,
      backend: result.backend,
      error: result.error,
      error_it: result.error_it,
    },
    { status: result.status },
  );
}
