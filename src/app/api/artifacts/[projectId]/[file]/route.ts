import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

const allowedProject = "tod-station-area";
const allowedFiles = new Set(["paper-blueprint.md"]);

export async function GET(
  _request: Request,
  {
    params,
  }: {
    params: Promise<{ projectId: string; file: string }>;
  },
) {
  const { projectId, file } = await params;

  if (!allowedFiles.has(file) || (projectId !== allowedProject && !projectId.startsWith("run-"))) {
    return NextResponse.json({ error: "Artifact not found" }, { status: 404 });
  }

  const artifactPath =
    projectId === allowedProject
      ? path.join(process.cwd(), "sample-project", file)
      : path.join(process.env.VERCEL ? path.join("/tmp", "researchflow-agent") : process.cwd(), "sample-project", "runs", projectId, file);

  const content = await readFile(artifactPath, "utf8").catch(() => null);

  if (!content) {
    return NextResponse.json({ error: "Artifact not found" }, { status: 404 });
  }

  return new Response(content, {
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      "content-disposition": `attachment; filename="${file}"`,
    },
  });
}
