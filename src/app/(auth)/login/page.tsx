import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { loginAction } from "../actions";
import { registrationMode } from "@/lib/env";

export const metadata = { title: "Sign in" };
export const dynamic = "force-dynamic";

export default function LoginPage() {
  const canRegister = registrationMode() !== "closed";
  return (
    <div className="card p-6">
      <h1 className="font-display mb-5 text-2xl font-semibold">Sign in</h1>
      <ActionForm action={loginAction} className="space-y-4" resetOnSuccess={false}>
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input className="input" id="email" name="email" type="email" autoComplete="email" required />
        </div>
        <div>
          <label className="label" htmlFor="password">Password</label>
          <input className="input" id="password" name="password" type="password" autoComplete="current-password" required />
        </div>
        <button className="btn-primary w-full" type="submit">Sign in</button>
      </ActionForm>
      {canRegister && (
        <p className="mt-5 text-center text-sm text-muted">
          No account yet?{" "}
          <Link href="/register" className="font-semibold text-accent hover:underline">Create one</Link>
        </p>
      )}
    </div>
  );
}
