import { NextResponse } from "next/server";

import { replayProofCapsule } from "@/lib/prooflab/verifier.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_CAPSULE_BYTES = 250_000;

export async function POST(request) {
  const declaredLength = Number(request.headers.get("content-length") || 0);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_CAPSULE_BYTES) {
    return NextResponse.json(
      { ok: false, error: "Proof capsule exceeds the 250 KB verification limit." },
      { status: 413 },
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Request body must be valid JSON." }, { status: 400 });
  }
  if (JSON.stringify(body).length > MAX_CAPSULE_BYTES) {
    return NextResponse.json(
      { ok: false, error: "Proof capsule exceeds the 250 KB verification limit." },
      { status: 413 },
    );
  }

  const replay = replayProofCapsule(body?.capsule);
  return NextResponse.json(
    { ok: replay.valid, replay, error: replay.valid ? undefined : replay.reason },
    { status: replay.valid ? 200 : 422 },
  );
}
