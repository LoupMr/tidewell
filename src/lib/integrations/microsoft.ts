import type { Connection } from "@prisma/client";
import { apiGet } from "./oauth";
import { replaceCalendars, replaceMail, type SyncedCalendar } from "@/lib/sync/store";

// Microsoft Graph. calendarView expands recurring events for us; we call it
// once per calendar so shared / delegated / subscribed calendars merge too.

const GRAPH = "https://graph.microsoft.com/v1.0";

type GraphList<T> = { value: T[]; "@odata.nextLink"?: string };

async function getAll<T>(url: string, token: string, headers?: Record<string, string>, maxPages = 10): Promise<T[]> {
  const out: T[] = [];
  let next: string | undefined = url;
  for (let i = 0; next && i < maxPages; i++) {
    const page: GraphList<T> = await apiGet<GraphList<T>>(next, token, headers);
    out.push(...page.value);
    next = page["@odata.nextLink"];
  }
  return out;
}

type GraphCalendar = { id: string; name: string; hexColor?: string; isRemovable?: boolean };
type GraphEvent = {
  id: string;
  subject?: string;
  isAllDay: boolean;
  isCancelled?: boolean;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
  location?: { displayName?: string };
  webLink?: string;
  responseStatus?: { response?: string };
};

// With Prefer: outlook.timezone="UTC" Graph returns naive UTC strings.
const utc = (s: string) => new Date(s.endsWith("Z") ? s : `${s}Z`);

export async function identity(token: string) {
  const me = await apiGet<{ id: string; mail?: string; userPrincipalName: string }>(`${GRAPH}/me?$select=id,mail,userPrincipalName`, token);
  return { externalId: me.id, label: me.mail || me.userPrincipalName };
}

export async function syncMicrosoft(conn: Connection, token: string, start: Date, end: Date) {
  const prefer = { Prefer: 'outlook.timezone="UTC"' };

  // --- calendars -----------------------------------------------------------
  const calendars = await getAll<GraphCalendar>(`${GRAPH}/me/calendars?$top=100&$select=id,name,hexColor`, token);
  const synced: SyncedCalendar[] = [];
  for (const cal of calendars) {
    const qs = new URLSearchParams({
      startDateTime: start.toISOString(),
      endDateTime: end.toISOString(),
      $top: "250",
      $select: "id,subject,isAllDay,isCancelled,start,end,location,webLink,responseStatus",
    });
    let events: GraphEvent[] = [];
    try {
      events = await getAll<GraphEvent>(`${GRAPH}/me/calendars/${encodeURIComponent(cal.id)}/calendarView?${qs}`, token, prefer);
    } catch (err) {
      // Some subscribed/birthday calendars refuse calendarView — skip them, keep the rest.
      console.warn(`[sync] microsoft calendar "${cal.name}" skipped:`, (err as Error).message);
      continue;
    }
    synced.push({
      externalId: cal.id,
      name: cal.name,
      color: cal.hexColor && cal.hexColor !== "" ? cal.hexColor : null,
      events: events
        .filter((e) => !e.isCancelled)
        .map((e) => ({
          externalId: e.id,
          title: e.subject || "(no title)",
          location: e.location?.displayName || null,
          startAt: utc(e.start.dateTime),
          endAt: utc(e.end.dateTime),
          isAllDay: e.isAllDay,
          url: e.webLink ?? null,
          responseStatus: e.responseStatus?.response ?? null,
        })),
    });
  }
  await replaceCalendars(conn, synced);

  // --- inbox snapshot ------------------------------------------------------
  const inbox = await apiGet<{ unreadItemCount: number }>(`${GRAPH}/me/mailFolders/inbox?$select=unreadItemCount`, token);
  // Graph requires $orderby properties to appear first in $filter.
  const qs = new URLSearchParams({
    $filter: "receivedDateTime ge 2000-01-01T00:00:00Z and isRead eq false",
    $orderby: "receivedDateTime desc",
    $top: "25",
    $select: "id,subject,from,receivedDateTime,bodyPreview,flag,webLink",
  });
  type GraphMessage = {
    id: string;
    subject?: string;
    from?: { emailAddress?: { name?: string; address?: string } };
    receivedDateTime: string;
    bodyPreview?: string;
    flag?: { flagStatus?: string };
    webLink?: string;
  };
  const msgs = await apiGet<GraphList<GraphMessage>>(`${GRAPH}/me/mailFolders/inbox/messages?${qs}`, token);
  await replaceMail(
    conn,
    inbox.unreadItemCount,
    msgs.value.map((m) => ({
      externalId: m.id,
      fromName: m.from?.emailAddress?.name ?? null,
      fromAddress: m.from?.emailAddress?.address ?? null,
      subject: m.subject || "(no subject)",
      snippet: m.bodyPreview?.slice(0, 240) ?? null,
      receivedAt: new Date(m.receivedDateTime),
      isFlagged: m.flag?.flagStatus === "flagged",
      url: m.webLink ?? null,
    })),
  );
}
