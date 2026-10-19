import Link from "next/link";
import { requireUser } from "@/lib/session";
import { PageHeader } from "@/components/ui";
import { CsvImporter } from "./csv-importer";

export const metadata = { title: "Import CSV" };

export default async function ImportPage() {
  const user = await requireUser();
  return (
    <>
      <PageHeader eyebrow="Money" title="Import bank CSV">
        <Link href="/money" className="btn-ghost">Back to Money</Link>
      </PageHeader>
      <p className="mb-6 max-w-2xl text-sm text-muted">
        Export your account history as CSV from your bank&apos;s website, then drop it here. The file is parsed in your
        browser; only the rows you confirm are sent to the server. Re-importing the same file never creates duplicates.
      </p>
      <CsvImporter locale={user.locale} currency={user.currency} />
    </>
  );
}
