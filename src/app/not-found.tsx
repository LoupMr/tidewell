import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 px-4 text-center">
      <p className="eyebrow">404</p>
      <h1 className="font-display text-3xl font-semibold">Nothing washed up here.</h1>
      <Link href="/" className="font-semibold text-accent hover:underline">Back to Tidewell</Link>
    </main>
  );
}
