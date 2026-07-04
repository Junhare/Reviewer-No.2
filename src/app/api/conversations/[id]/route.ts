import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { deleteConversation, getConversation, updateConversation, type StoredChatMessage } from "@/lib/product-store";

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
  const conversation = getConversation(user.id, id);

  if (!conversation) {
    return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
  }

  return NextResponse.json({ conversation });
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
    projectId?: string | null;
    title?: string;
    messages?: StoredChatMessage[];
  } | null;

  const conversation = updateConversation(user.id, id, {
    projectId: body?.projectId,
    title: body?.title,
    messages: body?.messages,
  });

  if (!conversation) {
    return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
  }

  return NextResponse.json({ conversation });
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

  if (!deleteConversation(user.id, id)) {
    return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
  }

  return new NextResponse(null, { status: 204 });
}
