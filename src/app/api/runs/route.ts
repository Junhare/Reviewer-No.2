import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { ChatHistoryMessage, createRunAndWait } from "@/lib/agent-harness";
import { getOrCreateInboxProject, getProject, upsertRunSnapshot } from "@/lib/product-store";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  const body = (await request.json().catch(() => null)) as {
    history?: ChatHistoryMessage[];
    projectId?: string;
    sessionId?: string;
    topic?: string;
  } | null;
  const topic = body?.topic?.trim();

  if (!topic) {
    return NextResponse.json({ error: "Missing topic" }, { status: 400 });
  }

  const inboxProject = getOrCreateInboxProject(user.id, topic);
  const targetProject = body?.projectId ? getProject(user.id, body.projectId) ?? inboxProject : inboxProject;
  const run = await createRunAndWait(topic, body?.history ?? [], body?.sessionId);
  upsertRunSnapshot(user.id, targetProject.id, topic, run);

  return NextResponse.json(run);
}
