import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createConversation, listConversations, type StoredChatMessage } from "@/lib/product-store";

export async function GET() {
  const user = await getCurrentUser();
  return NextResponse.json({ conversations: listConversations(user.id) });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  const body = (await request.json().catch(() => null)) as {
    projectId?: string;
    title?: string;
    messages?: StoredChatMessage[];
  } | null;

  const conversation = createConversation(user.id, {
    projectId: body?.projectId,
    title: body?.title,
    messages: body?.messages,
  });

  return NextResponse.json({ conversation }, { status: 201 });
}
