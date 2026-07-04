import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";

export async function GET() {
  const user = await getAuthenticatedUser();
  return NextResponse.json({
    user: user ? { id: user.id, email: user.email, name: user.name } : null,
  });
}
