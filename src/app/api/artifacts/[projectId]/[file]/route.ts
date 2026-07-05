import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getStoredRun } from "@/lib/product-store";

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

  let content = await readFile(artifactPath, "utf8").catch(() => null);

  if (!content && projectId.startsWith("run-")) {
    const user = await getCurrentUser();
    const storedRun = getStoredRun(user.id, projectId);
    content = (storedRun?.snapshot.resumeState?.artifacts as Record<string, string> | undefined)?.[file] ?? null;
  }

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
