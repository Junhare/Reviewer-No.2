import { NextResponse } from "next/server";
import { registerUser } from "@/lib/auth";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    email?: string;
    password?: string;
    name?: string;
  } | null;

  const email = body?.email?.trim();
  const password = body?.password?.trim();
  if (!email || !password || password.length < 8) {
    return NextResponse.json({ error: "Email and an 8+ character password are required." }, { status: 400 });
  }

  const user = await registerUser({ email, password, name: body?.name });
  return NextResponse.json({ user: { id: user.id, email: user.email, name: user.name } }, { status: 201 });
}
