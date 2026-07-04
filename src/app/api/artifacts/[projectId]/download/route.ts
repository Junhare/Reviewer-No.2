import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getArtifact } from "@/lib/product-store";

export async function GET(
  _request: Request,
  {
    params,
  }: {
    params: Promise<{ projectId: string }>;
  },
) {
  const user = await getCurrentUser();
  const { projectId: artifactId } = await params;
  const artifact = getArtifact(user.id, artifactId);

  if (!artifact) {
    return NextResponse.json({ error: "Artifact not found." }, { status: 404 });
  }

  return new Response(artifact.content, {
    headers: {
      "content-type": artifact.fileName.endsWith(".md") ? "text/markdown; charset=utf-8" : "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="${artifact.fileName}"`,
    },
  });
}
