"use server";

import { AuthError } from "next-auth";
import bcrypt from "bcryptjs";
import { headers } from "next/headers";
import { z } from "zod";
import { signIn } from "@/auth";
import { prisma } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { registrationAllowlist, registrationMode } from "@/lib/env";
import type { ActionState } from "@/components/action-form";

export async function loginAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo: "/dashboard",
    });
    return { ok: true };
  } catch (err) {
    if (err instanceof AuthError) {
      const code = (err as AuthError & { code?: string }).code;
      if (code === "rate_limited") return { error: "Too many attempts. Try again in 15 minutes." };
      return { error: "Wrong email or password." };
    }
    throw err; // NEXT_REDIRECT on success must propagate
  }
}

const registerSchema = z.object({
  name: z.string().trim().min(1, "Tell us your name").max(80),
  email: z.string().trim().toLowerCase().email("That email doesn't look right"),
  password: z.string().min(10, "Use at least 10 characters").max(200),
  timezone: z.string().max(64).optional(),
});

export async function registerAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const ip = (await headers()).get("cf-connecting-ip") || (await headers()).get("x-forwarded-for") || "local";
  if (!rateLimit(`register:${ip}`, 5, 60 * 60 * 1000)) return { error: "Too many sign-ups from here. Try later." };

  const parsed = registerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid form" };
  const { name, email, password } = parsed.data;

  const userCount = await prisma.user.count();
  const mode = registrationMode();
  if (userCount > 0) {
    if (mode === "closed") return { error: "Registration is closed on this instance." };
    if (mode === "invite" && !registrationAllowlist().includes(email)) {
      return { error: "This instance is invite-only and that email isn't on the list." };
    }
  }
  if (await prisma.user.findUnique({ where: { email } })) {
    return { error: "An account with that email already exists." };
  }

  let timezone = parsed.data.timezone || "Europe/Paris";
  try {
    new Intl.DateTimeFormat("en", { timeZone: timezone });
  } catch {
    timezone = "Europe/Paris";
  }

  const user = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash: await bcrypt.hash(password, 12),
      timezone,
      role: userCount === 0 ? "ADMIN" : "USER", // first account owns the instance
    },
  });
  await seedDefaultCategories(user.id);

  await signIn("credentials", { email, password, redirectTo: "/settings?welcome=1" });
  return { ok: true };
}

async function seedDefaultCategories(userId: string) {
  const expense = ["Housing", "Utilities", "Groceries", "Transport", "Subscriptions", "Health", "Leisure", "Other"];
  const income = ["Salary", "Freelance", "Refund", "Other"];
  await prisma.category.createMany({
    data: [
      ...expense.map((name) => ({ userId, name, type: "EXPENSE" as const })),
      ...income.map((name) => ({ userId, name, type: "INCOME" as const, color: "#0f766e" })),
    ],
    skipDuplicates: true,
  });
}
