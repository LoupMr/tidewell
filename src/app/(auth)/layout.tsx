import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  // Only bounce to the app if the session's user still exists (avoids a
  // redirect loop with a stale cookie after account deletion).
  const id = (await auth())?.user?.id;
  if (id && (await prisma.user.findUnique({ where: { id }, select: { id: true } }))) redirect("/dashboard");
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-8 flex items-center justify-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/favicon.svg" alt="" className="h-8 w-8" />
          <span className="font-display text-2xl font-semibold">Tidewell</span>
        </Link>
        {children}
      </div>
    </main>
  );
}
