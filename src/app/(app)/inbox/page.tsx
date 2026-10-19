import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { Card, Empty, PageHeader, Stat } from "@/components/ui";
import { MailRow } from "@/components/rows";
import { AutoRefresh } from "@/components/auto-refresh";

export const metadata = { title: "Inbox" };
export const dynamic = "force-dynamic";

export default async function InboxPage() {
  const user = await requireUser();
  const [accounts, messages] = await Promise.all([
    prisma.connection.findMany({
      where: { userId: user.id, provider: { in: ["MICROSOFT", "GOOGLE"] } },
      select: { id: true, label: true, provider: true, mailUnreadCount: true },
      orderBy: { label: "asc" },
    }),
    prisma.mailMessage.findMany({
      where: { userId: user.id },
      include: { connection: { select: { label: true, provider: true } } },
      orderBy: { receivedAt: "desc" },
      take: 100,
    }),
  ]);
  const flagged = messages.filter((m) => m.isFlagged);

  return (
    <>
      <AutoRefresh seconds={90} />
      <PageHeader eyebrow="Unread across every account" title="Inbox" />
      {accounts.length === 0 ? (
        <Empty href="/settings" cta="Connect Outlook or Gmail">No mail accounts connected.</Empty>
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
            {accounts.map((a) => (
              <Stat key={a.id} label={a.label} value={a.mailUnreadCount ?? "—"} />
            ))}
          </div>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <Card title="Latest unread" className="lg:col-span-2">
              {messages.length ? <ul className="divide-y divide-line">{messages.map((m) => <MailRow key={m.id} m={m} v={user} />)}</ul> : <Empty>Nothing unread. Enjoy it.</Empty>}
            </Card>
            <Card title="Flagged / starred">
              {flagged.length ? <ul className="divide-y divide-line">{flagged.map((m) => <MailRow key={m.id} m={m} v={user} />)}</ul> : <Empty>No flagged unread mail.</Empty>}
            </Card>
          </div>
          <p className="mt-4 text-xs text-muted">Tidewell shows the latest 25 unread messages per account and never changes anything in your mailbox.</p>
        </>
      )}
    </>
  );
}
