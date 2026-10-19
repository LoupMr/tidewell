import type { Connection, GithubKind } from "@prisma/client";
import { prisma } from "@/lib/db";

// Cache writers shared by every provider: fetch → replace, no diffing.

export type SyncedCalendar = {
  externalId: string;
  name: string;
  color?: string | null;
  events: {
    externalId: string;
    title: string;
    location?: string | null;
    startAt: Date;
    endAt: Date;
    isAllDay: boolean;
    url?: string | null;
    responseStatus?: string | null;
  }[];
};

export async function replaceCalendars(conn: Connection, calendars: SyncedCalendar[]) {
  await prisma.$transaction(async (tx) => {
    // Drop calendars the account no longer exposes (cascades their events).
    await tx.calendarSource.deleteMany({
      where: { connectionId: conn.id, externalId: { notIn: calendars.map((c) => c.externalId) } },
    });
    for (const cal of calendars) {
      const source = await tx.calendarSource.upsert({
        where: { connectionId_externalId: { connectionId: conn.id, externalId: cal.externalId } },
        create: { userId: conn.userId, connectionId: conn.id, externalId: cal.externalId, name: cal.name, color: cal.color ?? null },
        // `muted` is a user preference — never overwritten by a sync.
        update: { name: cal.name, color: cal.color ?? null },
      });
      await tx.calendarEvent.deleteMany({ where: { sourceId: source.id } });
      if (cal.events.length) {
        await tx.calendarEvent.createMany({
          data: cal.events.map((e) => ({ ...e, userId: conn.userId, sourceId: source.id })),
        });
      }
    }
  }, { timeout: 30_000 });
}

export type SyncedMail = {
  externalId: string;
  fromName?: string | null;
  fromAddress?: string | null;
  subject: string;
  snippet?: string | null;
  receivedAt: Date;
  isFlagged: boolean;
  url?: string | null;
};

export async function replaceMail(conn: Connection, unreadCount: number | null, messages: SyncedMail[]) {
  await prisma.$transaction([
    prisma.mailMessage.deleteMany({ where: { connectionId: conn.id } }),
    prisma.mailMessage.createMany({ data: messages.map((m) => ({ ...m, userId: conn.userId, connectionId: conn.id })) }),
    prisma.connection.update({ where: { id: conn.id }, data: { mailUnreadCount: unreadCount } }),
  ]);
}

export type SyncedGithubItem = {
  kind: GithubKind;
  repo: string;
  number: number;
  title: string;
  url: string;
  author?: string | null;
  isDraft: boolean;
  updatedAt: Date;
};

export async function replaceGithub(conn: Connection, items: SyncedGithubItem[]) {
  await prisma.$transaction([
    prisma.githubItem.deleteMany({ where: { connectionId: conn.id } }),
    prisma.githubItem.createMany({ data: items.map((i) => ({ ...i, userId: conn.userId, connectionId: conn.id })) }),
  ]);
}
