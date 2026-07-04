import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createProject, listProjects } from "@/lib/product-store";

export async function GET() {
  const user = await getCurrentUser();
  return NextResponse.json({ projects: listProjects(user.id) });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  const body = (await request.json().catch(() => null)) as {
    title?: string;
    topic?: string;
  } | null;

  const topic = body?.topic?.trim();
  if (!topic) {
    return NextResponse.json({ error: "Project topic is required." }, { status: 400 });
  }

  const project = createProject(user.id, { title: body?.title, topic });
  return NextResponse.json({ project }, { status: 201 });
}
