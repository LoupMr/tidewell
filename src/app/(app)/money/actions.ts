"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { sha256 } from "@/lib/crypto";
import { advance } from "@/lib/recurrence";
import { dateOnly, parseAmountToCents } from "@/lib/format";
import type { ActionState } from "@/components/action-form";

const isoDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date");
const flow = z.enum(["INCOME", "EXPENSE"]);

function refresh() {
  revalidatePath("/money");
  revalidatePath("/dashboard");
}

async function ownedCategoryId(userId: string, id: FormDataEntryValue | null): Promise<string | null> {
  if (!id || typeof id !== "string") return null;
  const c = await prisma.category.findFirst({ where: { id, userId }, select: { id: true } });
  return c?.id ?? null;
}

function cents(raw: FormDataEntryValue | null): number | null {
  const c = parseAmountToCents(String(raw ?? ""));
  return c === null ? null : Math.abs(c);
}

// ---------------------------------------------------------------- transactions

const txSchema = z.object({
  type: flow,
  description: z.string().trim().min(1, "Add a description").max(200),
  date: isoDay,
  note: z.string().trim().max(500).optional(),
});

export async function addTransaction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = txSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const amountCents = cents(fd.get("amount"));
  if (!amountCents) return { error: "Enter an amount" };
  await prisma.transaction.create({
    data: {
      userId: user.id,
      type: parsed.data.type,
      amountCents,
      date: dateOnly(parsed.data.date),
      description: parsed.data.description,
      note: parsed.data.note || null,
      categoryId: await ownedCategoryId(user.id, fd.get("categoryId")),
    },
  });
  refresh();
  return { ok: true, message: "Saved." };
}

export async function deleteTransaction(id: string) {
  const user = await requireUser();
  await prisma.transaction.deleteMany({ where: { id, userId: user.id } });
  refresh();
}

// ---------------------------------------------------------------- recurring

const recSchema = z.object({
  type: flow,
  name: z.string().trim().min(1, "Give it a name").max(120),
  frequency: z.enum(["WEEKLY", "MONTHLY", "YEARLY"]),
  interval: z.coerce.number().int().min(1).max(52).default(1),
  nextDate: isoDay,
  endDate: z.union([isoDay, z.literal("")]).optional(),
});

export async function addRecurring(_p: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = recSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const amountCents = cents(fd.get("amount"));
  if (!amountCents) return { error: "Enter an amount" };
  const next = dateOnly(parsed.data.nextDate);
  await prisma.recurring.create({
    data: {
      userId: user.id,
      type: parsed.data.type,
      name: parsed.data.name,
      amountCents,
      frequency: parsed.data.frequency,
      interval: parsed.data.interval,
      anchorDay: next.getUTCDate(),
      nextDate: next,
      endDate: parsed.data.endDate ? dateOnly(parsed.data.endDate) : null,
      categoryId: await ownedCategoryId(user.id, fd.get("categoryId")),
    },
  });
  refresh();
  return { ok: true, message: "Added." };
}

async function step(id: string, record: boolean) {
  const user = await requireUser();
  const r = await prisma.recurring.findFirst({ where: { id, userId: user.id, active: true } });
  if (!r) return;
  const next = advance(r.nextDate, r.frequency, r.interval, r.anchorDay);
  const ended = r.endDate !== null && next > r.endDate;
  await prisma.$transaction([
    ...(record
      ? [
          prisma.transaction.create({
            data: {
              userId: user.id,
              type: r.type,
              amountCents: r.amountCents,
              date: r.nextDate,
              description: r.name,
              categoryId: r.categoryId,
              recurringId: r.id,
            },
          }),
        ]
      : []),
    prisma.recurring.update({ where: { id: r.id }, data: { nextDate: next, active: !ended } }),
  ]);
  refresh();
}

/** Record the next occurrence as paid (expense) / received (income) and move on. */
export async function markRecurringDone(id: string) {
  await step(id, true);
}

/** Skip the next occurrence without recording a transaction. */
export async function skipRecurring(id: string) {
  await step(id, false);
}

export async function toggleRecurring(id: string) {
  const user = await requireUser();
  const r = await prisma.recurring.findFirst({ where: { id, userId: user.id } });
  if (!r) return;
  await prisma.recurring.update({ where: { id }, data: { active: !r.active } });
  refresh();
}

export async function deleteRecurring(id: string) {
  const user = await requireUser();
  await prisma.recurring.deleteMany({ where: { id, userId: user.id } });
  refresh();
}

// ---------------------------------------------------------------- categories

export async function addCategory(_p: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = z
    .object({
      name: z.string().trim().min(1, "Name it").max(40),
      type: flow,
      color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#64748b"),
    })
    .safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  try {
    await prisma.category.create({ data: { userId: user.id, ...parsed.data } });
  } catch {
    return { error: "That category already exists." };
  }
  refresh();
  return { ok: true };
}

export async function deleteCategory(id: string) {
  const user = await requireUser();
  await prisma.category.deleteMany({ where: { id, userId: user.id } });
  refresh();
}

// ---------------------------------------------------------------- CSV import

const importRow = z.object({
  date: isoDay,
  description: z.string().trim().min(1).max(200),
  amountCents: z.number().int(), // signed: negative = expense
});

export async function importTransactions(rows: unknown): Promise<{ imported: number; duplicates: number; error?: string }> {
  const user = await requireUser();
  const parsed = z.array(importRow).max(5000).safeParse(rows);
  if (!parsed.success) return { imported: 0, duplicates: 0, error: "Some rows are invalid — check the column mapping." };

  // Same date + amount + description on the same day can legitimately repeat
  // (two coffees), so the hash includes the row's occurrence index.
  const seen = new Map<string, number>();
  const data = parsed.data
    .filter((r) => r.amountCents !== 0)
    .map((r) => {
      const base = `${r.date}|${r.amountCents}|${r.description.toLowerCase()}`;
      const n = (seen.get(base) ?? 0) + 1;
      seen.set(base, n);
      return {
        userId: user.id,
        type: r.amountCents < 0 ? ("EXPENSE" as const) : ("INCOME" as const),
        amountCents: Math.abs(r.amountCents),
        date: dateOnly(r.date),
        description: r.description,
        importHash: sha256(`${user.id}|${base}|${n}`),
      };
    });
  const res = await prisma.transaction.createMany({ data, skipDuplicates: true });
  refresh();
  return { imported: res.count, duplicates: data.length - res.count };
}
