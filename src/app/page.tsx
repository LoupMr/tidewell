import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { CalendarDays, GitPullRequest, Inbox, Wallet } from "lucide-react";

export default async function Home() {
  if ((await auth())?.user?.id) redirect("/dashboard");
  const features = [
    { icon: CalendarDays, title: "One calendar", body: "Outlook and Google calendars — work, shared, delegated, subscribed — merged into a single timeline, each event tagged with where it came from." },
    { icon: Inbox, title: "Every inbox", body: "Unread counts and the latest unread mail from each connected account, without opening any of them." },
    { icon: GitPullRequest, title: "GitHub triage", body: "Issues assigned to you and pull requests waiting on your review, across every repo you can see." },
    { icon: Wallet, title: "Money in & out", body: "Track spending, see the bills coming up and the money about to land. Import your bank's CSV in seconds." },
  ];
  return (
    <main className="mx-auto max-w-5xl px-5 py-10 sm:py-16">
      <header className="mb-16 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/favicon.svg" alt="" className="h-8 w-8" />
          <span className="font-display text-xl font-semibold">Tidewell</span>
        </div>
        <nav className="flex gap-2">
          <Link href="/login" className="btn-ghost">Sign in</Link>
          <Link href="/register" className="btn-primary">Create account</Link>
        </nav>
      </header>
      <section className="mb-16 max-w-2xl">
        <p className="eyebrow mb-3">Self-hosted · open source</p>
        <h1 className="font-display mb-5 text-4xl font-semibold leading-tight tracking-tight sm:text-6xl">
          Everything that needs you, on one calm page.
        </h1>
        <p className="text-lg text-muted">
          Tidewell pulls your calendars, inboxes, GitHub queue and finances into a single read-only dashboard that
          refreshes itself. Your tokens and data never leave the server you run it on.
        </p>
      </section>
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {features.map((f) => (
          <div key={f.title} className="card p-5">
            <f.icon className="mb-3 h-5 w-5 text-accent" aria-hidden />
            <h2 className="font-display mb-1 text-lg font-semibold">{f.title}</h2>
            <p className="text-sm text-muted">{f.body}</p>
          </div>
        ))}
      </section>
      <footer className="mt-16 text-sm text-muted">
        <a className="hover:underline" href="https://github.com/LoupMr/tidewell" rel="noreferrer">Source on GitHub</a> · MIT licensed
      </footer>
    </main>
  );
}
