"use client";

import { useActionState, useEffect, useRef } from "react";

export type ActionState = { ok?: boolean; error?: string; message?: string } | null;
export type FormAction = (prev: ActionState, formData: FormData) => Promise<ActionState>;

/** A form bound to a server action, showing its error/success message inline. */
export function ActionForm({
  action,
  children,
  className,
  resetOnSuccess = true,
}: {
  action: FormAction;
  children: React.ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok && resetOnSuccess) ref.current?.reset();
  }, [state, resetOnSuccess]);
  return (
    <form
      ref={ref}
      action={formAction}
      className={[className, pending ? "pointer-events-none opacity-60" : ""].filter(Boolean).join(" ")}
      aria-busy={pending}
    >
      {children}
      {state?.error && (
        <p role="alert" className="mt-2 text-sm text-danger">
          {state.error}
        </p>
      )}
      {state?.ok && state.message && <p className="mt-2 text-sm text-ok">{state.message}</p>}
    </form>
  );
}
