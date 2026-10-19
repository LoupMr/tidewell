import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

/** Current signed-in user (fresh from the DB) or redirect to /login. */
export async function requireUser() {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) redirect("/login");
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) redirect("/login"); // account deleted while the cookie lived on
  return user;
}

/** Same as requireUser but for route handlers: returns null instead of redirecting. */
export async function currentUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}
