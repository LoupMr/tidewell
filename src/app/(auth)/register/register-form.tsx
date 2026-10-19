"use client";

import { useEffect, useState } from "react";
import { ActionForm } from "@/components/action-form";
import { registerAction } from "../actions";

export function RegisterForm() {
  const [tz, setTz] = useState("");
  useEffect(() => setTz(Intl.DateTimeFormat().resolvedOptions().timeZone), []);
  return (
    <ActionForm action={registerAction} className="space-y-4" resetOnSuccess={false}>
      <input type="hidden" name="timezone" value={tz} />
      <div>
        <label className="label" htmlFor="name">Name</label>
        <input className="input" id="name" name="name" autoComplete="name" required maxLength={80} />
      </div>
      <div>
        <label className="label" htmlFor="email">Email</label>
        <input className="input" id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <div>
        <label className="label" htmlFor="password">Password</label>
        <input className="input" id="password" name="password" type="password" autoComplete="new-password" minLength={10} required />
        <p className="mt-1 text-xs text-muted">At least 10 characters.</p>
      </div>
      <button className="btn-primary w-full" type="submit">Create account</button>
    </ActionForm>
  );
}
