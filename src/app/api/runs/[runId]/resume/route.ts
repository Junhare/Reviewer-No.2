import { NextResponse } from "next/server";
import { resumeRunAndWait } from "@/lib/agent-harness";
import { getCurrentUser } from "@/lib/auth";
import { getRunOwnerContext, upsertRunSnapshot } from "@/lib/product-store";

export async function POST(
  request: Request,
  {
    params,
  }: {
    params: Promise<{ runId: string }>;
  },
) {
  const user = await getCurrentUser();
  const { runId } = await params;
  const body = (await request.json().catch(() => null)) as {
    answer?: string;
  } | null;
  const answer = body?.answer?.trim();

  if (!answer) {
    return NextResponse.json({ error: "Missing answer" }, { status: 400 });
  }

  try {
    const run = await resumeRunAndWait(runId, answer);
    if (!run) {
      return NextResponse.json({ error: "Run not found" }, { status: 404 });
    }

    const context = getRunOwnerContext(runId);
    if (context && context.ownerId === user.id) {
      upsertRunSnapshot(user.id, context.projectId, context.topic, run);
    }

    return NextResponse.json(run);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to resume run" },
      { status: 409 },
    );
  }
}
