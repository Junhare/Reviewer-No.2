import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { deleteProject, getProject, listProjectArtifacts, listProjectRuns, updateProject } from "@/lib/product-store";

export async function GET(
  _request: Request,
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

  return NextResponse.json({
    project,
    runs: listProjectRuns(user.id, id),
    artifacts: listProjectArtifacts(user.id, id),
  });
}

export async function PATCH(
  request: Request,
  {
    params,
  }: {
    params: Promise<{ id: string }>;
  },
) {
  const user = await getCurrentUser();
  const { id } = await params;
  const body = (await request.json().catch(() => null)) as {
    title?: string;
    topic?: string;
  } | null;

  const project = updateProject(user.id, id, {
    title: body?.title,
    topic: body?.topic,
  });

  if (!project) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }

  return NextResponse.json({ project });
}

export async function DELETE(
  _request: Request,
  {
    params,
  }: {
    params: Promise<{ id: string }>;
  },
) {
  const user = await getCurrentUser();
  const { id } = await params;

  if (!deleteProject(user.id, id)) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }

  return new NextResponse(null, { status: 204 });
}
