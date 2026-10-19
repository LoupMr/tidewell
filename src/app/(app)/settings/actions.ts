"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { signOut } from "@/auth";
import { syncUser } from "@/lib/sync";
import type { ActionState } from "@/components/action-form";

export async function syncNow(): Promise<void> {
  const user = await requireUser();
  await syncUser(user.id);
  revalidatePath("/", "layout");
}

export async function disconnect(id: string): Promise<void> {
  const user = await requireUser();
  // Deleting the row cascades to its calendars, events, mail and GitHub items.
  // Revoke access on the provider side too (links in the UI) for a clean break.
  await prisma.connection.deleteMany({ where: { id, userId: user.id } });
  revalidatePath("/", "layout");
}

export async function toggleCalendar(id: string): Promise<void> {
  const user = await requireUser();
  const s = await prisma.calendarSource.findFirst({ where: { id, userId: user.id } });
  if (!s) return;
  await prisma.calendarSource.update({ where: { id }, data: { muted: !s.muted } });
  revalidatePath("/", "layout");
}

const profileSchema = z.object({
  name: z.string().trim().min(1).max(80),
  timezone: z.string().refine((tz) => {
    try {
      new Intl.DateTimeFormat("en", { timeZone: tz });
      return true;
    } catch {
      return false;
    }
  }, "Unknown timezone"),
  locale: z.string().refine((l) => {
    try {
      new Intl.NumberFormat(l);
      return true;
    } catch {
      return false;
    }
  }, "Unknown locale"),
  currency: z.string().regex(/^[A-Z]{3}$/, "Use a 3-letter currency code (EUR, USD…)"),
});

export async function updateProfile(_p: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = profileSchema.safeParse({ ...Object.fromEntries(fd), currency: String(fd.get("currency") ?? "").toUpperCase() });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  await prisma.user.update({ where: { id: user.id }, data: parsed.data });
  revalidatePath("/", "layout");
  return { ok: true, message: "Saved." };
}

export async function changePassword(_p: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  const current = String(fd.get("current") ?? "");
  const next = String(fd.get("next") ?? "");
  if (next.length < 10) return { error: "New password needs at least 10 characters." };
  if (!(await bcrypt.compare(current, user.passwordHash))) return { error: "Current password is wrong." };
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(next, 12) } });
  return { ok: true, message: "Password changed." };
}

export async function deleteAccount(_p: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  if (String(fd.get("confirm") ?? "").trim().toLowerCase() !== user.email) {
    return { error: "Type your email exactly to confirm." };
  }
  await prisma.user.delete({ where: { id: user.id } }); // cascades everything
  await signOut({ redirectTo: "/" });
  return { ok: true };
}
