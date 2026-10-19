import Link from "next/link";
import { RegisterForm } from "./register-form";
import { registrationMode } from "@/lib/env";
import { prisma } from "@/lib/db";

export const metadata = { title: "Create account" };
export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  const mode = registrationMode();
  const firstUser = (await prisma.user.count()) === 0;
  const closed = mode === "closed" && !firstUser;
  return (
    <div className="card p-6">
      <h1 className="font-display mb-1 text-2xl font-semibold">Create your account</h1>
      <p className="mb-5 text-sm text-muted">
        {firstUser
          ? "You're the first one here. Every account is private: nobody else can see your data."
          : mode === "invite"
            ? "This instance is invite-only."
            : "Your data stays on this server. Connected accounts are read-only."}
      </p>
      {closed ? (
        <p className="text-sm text-muted">Registration is closed on this instance.</p>
      ) : (
        <RegisterForm />
      )}
      <p className="mt-5 text-center text-sm text-muted">
        Already have one? <Link href="/login" className="font-semibold text-accent hover:underline">Sign in</Link>
      </p>
    </div>
  );
}
