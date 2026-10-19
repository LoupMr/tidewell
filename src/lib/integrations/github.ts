import type { Connection, GithubKind } from "@prisma/client";
import { apiGet } from "./oauth";
import { replaceGithub, type SyncedGithubItem } from "@/lib/sync/store";

const API = "https://api.github.com";
const headers = { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "tidewell" };

export async function identity(token: string) {
  const me = await apiGet<{ id: number; login: string }>(`${API}/user`, token, headers);
  return { externalId: String(me.id), label: me.login };
}

type SearchItem = {
  number: number;
  title: string;
  html_url: string;
  repository_url: string;
  updated_at: string;
  draft?: boolean;
  user?: { login: string };
};

const QUERIES: { kind: GithubKind; q: string }[] = [
  { kind: "ISSUE_ASSIGNED", q: "is:issue is:open archived:false assignee:@me" },
  { kind: "PR_REVIEW_REQUESTED", q: "is:pr is:open archived:false review-requested:@me" },
  { kind: "PR_AUTHORED", q: "is:pr is:open archived:false author:@me" },
];

export async function syncGithub(conn: Connection, token: string) {
  const items: SyncedGithubItem[] = [];
  // 3 search calls per sync — far below the 30 req/min authenticated search limit.
  for (const { kind, q } of QUERIES) {
    const qs = new URLSearchParams({ q, sort: "updated", order: "desc", per_page: "50" });
    const res = await apiGet<{ items: SearchItem[] }>(`${API}/search/issues?${qs}`, token, headers);
    for (const it of res.items) {
      items.push({
        kind,
        repo: it.repository_url.replace(`${API}/repos/`, ""),
        number: it.number,
        title: it.title,
        url: it.html_url,
        author: it.user?.login ?? null,
        isDraft: Boolean(it.draft),
        updatedAt: new Date(it.updated_at),
      });
    }
  }
  await replaceGithub(conn, items);
}
