import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { Card, Empty, PageHeader } from "@/components/ui";
import { GithubRow } from "@/components/rows";
import { AutoRefresh } from "@/components/auto-refresh";

export const metadata = { title: "GitHub" };
export const dynamic = "force-dynamic";

export default async function GithubPage() {
  const user = await requireUser();
  const [hasGithub, items] = await Promise.all([
    prisma.connection.count({ where: { userId: user.id, provider: "GITHUB" } }),
    prisma.githubItem.findMany({ where: { userId: user.id }, orderBy: { updatedAt: "desc" } }),
  ]);
  const by = (k: string) => items.filter((i) => i.kind === k);
  const columns = [
    { key: "PR_REVIEW_REQUESTED", title: "Awaiting your review", hint: "Someone is blocked on you." },
    { key: "ISSUE_ASSIGNED", title: "Assigned to you", hint: "Yours to act on." },
    { key: "PR_AUTHORED", title: "Your open PRs", hint: "Waiting on others." },
  ];
  return (
    <>
      <AutoRefresh seconds={120} />
      <PageHeader eyebrow="Across every repo you can see" title="GitHub" />
      {!hasGithub ? (
        <Empty href="/settings" cta="Connect GitHub">GitHub isn&apos;t connected yet.</Empty>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {columns.map((c) => {
            const list = by(c.key);
            return (
              <Card key={c.key} title={<>{c.title} <span className="num text-sm text-muted">{list.length}</span></>}>
                <p className="-mt-3 mb-3 text-xs text-muted">{c.hint}</p>
                {list.length ? <ul>{list.map((i) => <GithubRow key={i.id} i={i} v={user} />)}</ul> : <Empty>All clear.</Empty>}
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
