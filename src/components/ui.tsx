import clsx from "clsx";
import Link from "next/link";

export function PageHeader({ eyebrow, title, children }: { eyebrow?: string; title: string; children?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow && <p className="eyebrow mb-1">{eyebrow}</p>}
        <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

export function Card({
  title,
  action,
  children,
  className,
}: {
  title?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={clsx("card min-w-0 p-5", className)}>
      {(title || action) && (
        <div className="mb-4 flex items-center justify-between gap-3">
          {title && <h2 className="font-display text-lg font-semibold">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

/** Small source tag — the core pattern that makes merged lists legible. */
export function SourcePill({ name, color }: { name: string; color?: string | null }) {
  return (
    <span className="inline-flex max-w-[12rem] items-center gap-1.5 truncate rounded-full border border-line bg-surface-2 px-2 py-0.5 text-[11px] font-medium text-muted">
      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: color || "var(--muted)" }} />
      <span className="truncate">{name}</span>
    </span>
  );
}

export function Badge({ tone = "neutral", children }: { tone?: "neutral" | "accent" | "warn" | "danger" | "ok"; children: React.ReactNode }) {
  const tones = {
    neutral: "bg-surface-2 text-muted",
    accent: "bg-accent-soft text-accent",
    warn: "bg-warn-soft text-warn",
    danger: "bg-danger-soft text-danger",
    ok: "bg-ok-soft text-ok",
  };
  return <span className={clsx("inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold", tones[tone])}>{children}</span>;
}

export function Empty({ children, href, cta }: { children: React.ReactNode; href?: string; cta?: string }) {
  return (
    <div className="rounded-lg border border-dashed border-line px-4 py-8 text-center text-sm text-muted">
      <p>{children}</p>
      {href && cta && (
        <Link href={href} className="mt-3 inline-block font-semibold text-accent hover:underline">
          {cta}
        </Link>
      )}
    </div>
  );
}

export function Stat({ label, value, tone }: { label: string; value: React.ReactNode; tone?: "accent" | "warn" | "danger" | "ok" }) {
  const color = tone ? { accent: "text-accent", warn: "text-warn", danger: "text-danger", ok: "text-ok" }[tone] : "text-ink";
  return (
    <div className="card px-4 py-3">
      <p className="eyebrow">{label}</p>
      <p className={clsx("num mt-1 text-2xl font-semibold", color)}>{value}</p>
    </div>
  );
}
