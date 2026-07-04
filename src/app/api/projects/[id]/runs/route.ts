import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { ChatHistoryMessage, createRun } from "@/lib/agent-harness";
import { getProject, upsertRunSnapshot } from "@/lib/product-store";

export async function POST(
  request: Request,
  {
    params,
  }: {
    params: Promise<{ id: string }>;
  },
) {
  const user = await getCurrentUser();
  const { id } = await params;
  const project = getProject(user.id, id);
  if (!project) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }

  const body = (await request.json().catch(() => null)) as {
    history?: ChatHistoryMessage[];
    sessionId?: string;
    topic?: string;
  } | null;
  const topic = body?.topic?.trim();
  if (!topic) {
    return NextResponse.json({ error: "Missing topic." }, { status: 400 });
  }

  const run = createRun(topic, body?.history ?? [], body?.sessionId);
  upsertRunSnapshot(user.id, project.id, topic, run);

  return NextResponse.json(run, { status: 201 });
}
