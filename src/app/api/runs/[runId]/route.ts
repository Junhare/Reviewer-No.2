import { NextResponse } from "next/server";
import { getRun } from "@/lib/agent-harness";
import { getCurrentUser } from "@/lib/auth";
import { getRunOwnerContext, getStoredRun, upsertRunSnapshot } from "@/lib/product-store";

export async function GET(
  _request: Request,
  {
    params,
  }: {
    params: Promise<{ runId: string }>;
  },
) {
  const user = await getCurrentUser();
  const { runId } = await params;
  const run = getRun(runId);

  if (!run) {
    const storedRun = getStoredRun(user.id, runId);
    return storedRun ? NextResponse.json(storedRun.snapshot) : NextResponse.json({ error: "Run not found" }, { status: 404 });
  }

  const context = getRunOwnerContext(runId);
  if (context && context.ownerId === user.id) {
    upsertRunSnapshot(user.id, context.projectId, context.topic, run);
  }

  return NextResponse.json(run);
}
