import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { createUser, findUserByEmail, findUserById, getOrCreateDefaultUser } from "@/lib/product-store";

const sessionCookieName = "rf_user";

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const userId = cookieStore.get(sessionCookieName)?.value;
  if (userId) {
    const user = findUserById(userId);
    if (user) return user;
  }

  return getOrCreateDefaultUser();
}

export async function getAuthenticatedUser() {
  const cookieStore = await cookies();
  const userId = cookieStore.get(sessionCookieName)?.value;
  if (!userId) return null;
  return findUserById(userId);
}

export async function registerUser(input: { email: string; password: string; name?: string }) {
  const passwordHash = hashPassword(input.password);
  const user = createUser({
    email: input.email,
    name: input.name,
    passwordHash,
  });
  const cookieStore = await cookies();
  cookieStore.set(sessionCookieName, user.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
  return user;
}

export async function loginUser(input: { email: string; password: string }) {
  const user = findUserByEmail(input.email);
  if (!user?.passwordHash || !verifyPassword(input.password, user.passwordHash)) return null;

  const cookieStore = await cookies();
  cookieStore.set(sessionCookieName, user.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
  return user;
}

export async function logoutUser() {
  const cookieStore = await cookies();
  cookieStore.delete(sessionCookieName);
}

function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, passwordHash: string) {
  const [salt, hash] = passwordHash.split(":");
  if (!salt || !hash) return false;

  const expected = Buffer.from(hash, "hex");
  const actual = scryptSync(password, salt, 64);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
