import type { Connection } from "@prisma/client";
import { apiGet } from "./oauth";
import { replaceCalendars, replaceMail, type SyncedCalendar, type SyncedMail } from "@/lib/sync/store";

const CAL = "https://www.googleapis.com/calendar/v3";
const GMAIL = "https://gmail.googleapis.com/gmail/v1/users/me";

export async function identity(token: string) {
  const me = await apiGet<{ sub: string; email: string }>("https://openidconnect.googleapis.com/v1/userinfo", token);
  return { externalId: me.sub, label: me.email };
}

type GCalendar = { id: string; summary: string; summaryOverride?: string; backgroundColor?: string; hidden?: boolean };
type GTime = { date?: string; dateTime?: string };
type GEvent = {
  id: string;
  status?: string;
  summary?: string;
  location?: string;
  htmlLink?: string;
  start: GTime;
  end: GTime;
  attendees?: { self?: boolean; responseStatus?: string }[];
  organizer?: { self?: boolean };
};

const toDate = (t: GTime) => (t.dateTime ? new Date(t.dateTime) : new Date(`${t.date}T00:00:00.000Z`));

export async function syncGoogle(conn: Connection, token: string, start: Date, end: Date) {
  // --- calendars -----------------------------------------------------------
  const list = await apiGet<{ items: GCalendar[] }>(`${CAL}/users/me/calendarList?maxResults=250`, token);
  const synced: SyncedCalendar[] = [];
  for (const cal of list.items.filter((c) => !c.hidden)) {
    const events: GEvent[] = [];
    let pageToken: string | undefined;
    for (let i = 0; i < 5; i++) {
      const qs = new URLSearchParams({
        timeMin: start.toISOString(),
        timeMax: end.toISOString(),
        singleEvents: "true", // expand recurring events
        orderBy: "startTime",
        maxResults: "250",
      });
      if (pageToken) qs.set("pageToken", pageToken);
      try {
        const page = await apiGet<{ items: GEvent[]; nextPageToken?: string }>(
          `${CAL}/calendars/${encodeURIComponent(cal.id)}/events?${qs}`,
          token,
        );
        events.push(...page.items);
        pageToken = page.nextPageToken;
      } catch (err) {
        console.warn(`[sync] google calendar "${cal.summary}" skipped:`, (err as Error).message);
        pageToken = undefined;
      }
      if (!pageToken) break;
    }
    synced.push({
      externalId: cal.id,
      name: cal.summaryOverride || cal.summary,
      color: cal.backgroundColor ?? null,
      events: events
        .filter((e) => e.status !== "cancelled")
        .map((e) => {
          const me = e.attendees?.find((a) => a.self);
          return {
            externalId: e.id,
            title: e.summary || "(no title)",
            location: e.location ?? null,
            startAt: toDate(e.start),
            endAt: toDate(e.end),
            isAllDay: Boolean(e.start.date && !e.start.dateTime),
            url: e.htmlLink ?? null,
            responseStatus: e.organizer?.self ? "organizer" : (me?.responseStatus ?? null),
          };
        }),
    });
  }
  await replaceCalendars(conn, synced);

  // --- Gmail inbox snapshot -----------------------------------------------
  const inbox = await apiGet<{ messagesUnread?: number }>(`${GMAIL}/labels/INBOX`, token);
  const ids = await apiGet<{ messages?: { id: string; threadId: string }[] }>(
    `${GMAIL}/messages?${new URLSearchParams({ q: "is:unread in:inbox", maxResults: "25" })}`,
    token,
  );
  type GMessage = {
    id: string;
    threadId: string;
    snippet?: string;
    internalDate: string;
    labelIds?: string[];
    payload?: { headers?: { name: string; value: string }[] };
  };
  const messages: SyncedMail[] = [];
  for (const ref of ids.messages ?? []) {
    const qs = new URLSearchParams({ format: "metadata" });
    qs.append("metadataHeaders", "From");
    qs.append("metadataHeaders", "Subject");
    const m = await apiGet<GMessage>(`${GMAIL}/messages/${ref.id}?${qs}`, token);
    const header = (n: string) => m.payload?.headers?.find((h) => h.name.toLowerCase() === n.toLowerCase())?.value;
    const from = header("From") ?? "";
    const match = from.match(/^\s*"?([^"<]*)"?\s*<([^>]+)>/);
    messages.push({
      externalId: m.id,
      fromName: match ? match[1].trim() || null : null,
      fromAddress: match ? match[2] : from || null,
      subject: header("Subject") || "(no subject)",
      snippet: decodeEntities(m.snippet ?? "").slice(0, 240) || null,
      receivedAt: new Date(Number(m.internalDate)),
      isFlagged: Boolean(m.labelIds?.includes("STARRED")),
      url: `https://mail.google.com/mail/u/${encodeURIComponent(conn.label)}/#inbox/${m.threadId}`,
    });
  }
  await replaceMail(conn, inbox.messagesUnread ?? null, messages);
}

function decodeEntities(s: string): string {
  return s
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}
