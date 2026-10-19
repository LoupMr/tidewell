import { requireUser } from "@/lib/session";
import { Nav } from "./nav";
import { signOut } from "@/auth";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  async function logout() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="border-b border-line bg-surface md:sticky md:top-0 md:h-screen md:w-56 md:shrink-0 md:border-b-0 md:border-r">
        <div className="flex h-full flex-col gap-2 p-3 md:p-4">
          <div className="flex items-center gap-2 px-2 py-1 md:mb-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/favicon.svg" alt="" className="h-7 w-7" />
            <span className="font-display text-lg font-semibold">Tidewell</span>
          </div>
          <Nav />
          <div className="mt-auto hidden border-t border-line pt-3 md:block">
            <p className="truncate px-2 text-sm font-medium">{user.name}</p>
            <p className="truncate px-2 text-xs text-muted">{user.email}</p>
            <form action={logout}>
              <button className="mt-2 w-full rounded-lg px-2 py-1.5 text-left text-sm text-muted hover:bg-surface-2">Sign out</button>
            </form>
          </div>
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-8 sm:py-8">
        <div className="mx-auto max-w-6xl">{children}</div>
        <form action={logout} className="mt-10 md:hidden">
          <button className="text-sm text-muted underline">Sign out</button>
        </form>
      </main>
    </div>
  );
}
