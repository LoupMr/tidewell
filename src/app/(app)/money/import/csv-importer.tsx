"use client";

import Papa from "papaparse";
import { useMemo, useState, useTransition } from "react";
import { importTransactions } from "../actions";
import { parseAmountToCents } from "@/lib/format";

type DateFormat = "auto" | "ymd" | "dmy" | "mdy";

function parseDate(raw: string, fmt: DateFormat): string | null {
  const s = raw.trim();
  const iso = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (iso && (fmt === "auto" || fmt === "ymd")) return pad(iso[1], iso[2], iso[3]);
  const m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
  if (!m) return null;
  const year = m[3].length === 2 ? `20${m[3]}` : m[3];
  // Auto prefers day-first (European banks); switch to MM/DD if your bank is US-style.
  if (fmt === "mdy") return pad(year, m[1], m[2]);
  return pad(year, m[2], m[1]);
}

function pad(y: string, mo: string, d: string): string | null {
  const month = Number(mo);
  const day = Number(d);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${y}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function CsvImporter({ locale, currency }: { locale: string; currency: string }) {
  const [text, setText] = useState<string>("");
  const [fileName, setFileName] = useState("");
  const [skip, setSkip] = useState(0);
  const [dateCol, setDateCol] = useState(-1);
  const [descCol, setDescCol] = useState(-1);
  const [amountMode, setAmountMode] = useState<"single" | "split">("single");
  const [amountCol, setAmountCol] = useState(-1);
  const [debitCol, setDebitCol] = useState(-1);
  const [creditCol, setCreditCol] = useState(-1);
  const [dateFmt, setDateFmt] = useState<DateFormat>("auto");
  const [invert, setInvert] = useState(false);
  const [result, setResult] = useState<string>("");
  const [pending, start] = useTransition();

  const table = useMemo(() => {
    if (!text) return { header: [] as string[], rows: [] as string[][] };
    const lines = text.split(/\r?\n/).slice(skip).join("\n");
    const parsed = Papa.parse<string[]>(lines, { skipEmptyLines: true });
    const [header = [], ...rows] = parsed.data;
    return { header: header.map((h) => h.trim()), rows };
  }, [text, skip]);

  // Guess columns once a header is available.
  const guess = (re: RegExp) => table.header.findIndex((h) => re.test(h.toLowerCase()));
  const col = (v: number, re: RegExp) => (v >= 0 ? v : guess(re));
  const dC = col(dateCol, /date|datum|fecha/);
  const sC = col(descCol, /libell|descr|label|payee|merchant|détail|detail|memo|name/);
  const aC = col(amountCol, /montant|amount|betrag|importe|value|valeur/);
  const debC = col(debitCol, /débit|debit|out|withdraw/);
  const creC = col(creditCol, /crédit|credit|in|deposit/);

  const mapped = useMemo(() => {
    const out: { date: string; description: string; amountCents: number }[] = [];
    let bad = 0;
    for (const r of table.rows) {
      const date = dC >= 0 ? parseDate(r[dC] ?? "", dateFmt) : null;
      const description = sC >= 0 ? (r[sC] ?? "").trim().replace(/\s+/g, " ").slice(0, 200) : "";
      let cents: number | null = null;
      if (amountMode === "single") cents = aC >= 0 ? parseAmountToCents(r[aC] ?? "") : null;
      else {
        const debit = debC >= 0 ? parseAmountToCents(r[debC] ?? "") : null;
        const credit = creC >= 0 ? parseAmountToCents(r[creC] ?? "") : null;
        if (debit || credit) cents = (credit ? Math.abs(credit) : 0) - (debit ? Math.abs(debit) : 0);
      }
      if (!date || !description || cents === null || cents === 0) {
        bad++;
        continue;
      }
      out.push({ date, description, amountCents: invert ? -cents : cents });
    }
    return { rows: out, bad };
  }, [table.rows, dC, sC, aC, debC, creC, amountMode, dateFmt, invert]);

  const fmt = (c: number) => new Intl.NumberFormat(locale, { style: "currency", currency, signDisplay: "exceptZero" }).format(c / 100);

  async function onFile(f: File | undefined) {
    if (!f) return;
    setResult("");
    setFileName(f.name);
    const buf = await f.arrayBuffer();
    // Many French banks still export Windows-1252; fall back if UTF-8 looks broken.
    let t = new TextDecoder("utf-8").decode(buf);
    if (t.includes("�")) t = new TextDecoder("windows-1252").decode(buf);
    setText(t);
  }

  const Select = ({ value, onChange, label }: { value: number; onChange: (n: number) => void; label: string }) => (
    <div>
      <label className="label">{label}</label>
      <select className="input" value={value} onChange={(e) => onChange(Number(e.target.value))}>
        <option value={-1}>—</option>
        {table.header.map((h, i) => (
          <option key={i} value={i}>{h || `Column ${i + 1}`}</option>
        ))}
      </select>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="card p-5">
        <label className="label" htmlFor="csv">CSV file</label>
        <input id="csv" type="file" accept=".csv,text/csv" onChange={(e) => onFile(e.target.files?.[0])} className="block text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-accent-soft file:px-3 file:py-2 file:font-semibold file:text-accent" />
        {fileName && <p className="mt-2 text-xs text-muted">{fileName} · {table.rows.length} rows</p>}
      </div>

      {table.header.length > 0 && (
        <div className="card grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="label">Skip first lines</label>
            <input type="number" min={0} max={50} className="input num" value={skip} onChange={(e) => setSkip(Number(e.target.value) || 0)} />
          </div>
          <Select label="Date column" value={dC} onChange={setDateCol} />
          <div>
            <label className="label">Date format</label>
            <select className="input" value={dateFmt} onChange={(e) => setDateFmt(e.target.value as DateFormat)}>
              <option value="auto">Auto (DD/MM or ISO)</option>
              <option value="ymd">YYYY-MM-DD</option>
              <option value="dmy">DD/MM/YYYY</option>
              <option value="mdy">MM/DD/YYYY</option>
            </select>
          </div>
          <Select label="Description column" value={sC} onChange={setDescCol} />
          <div>
            <label className="label">Amounts</label>
            <select className="input" value={amountMode} onChange={(e) => setAmountMode(e.target.value as "single" | "split")}>
              <option value="single">One signed column</option>
              <option value="split">Separate debit / credit</option>
            </select>
          </div>
          {amountMode === "single" ? (
            <Select label="Amount column" value={aC} onChange={setAmountCol} />
          ) : (
            <>
              <Select label="Debit column" value={debC} onChange={setDebitCol} />
              <Select label="Credit column" value={creC} onChange={setCreditCol} />
            </>
          )}
          <label className="flex items-center gap-2 self-end pb-2 text-sm">
            <input type="checkbox" checked={invert} onChange={(e) => setInvert(e.target.checked)} />
            Flip signs (expenses shown positive)
          </label>
        </div>
      )}

      {mapped.rows.length > 0 && (
        <div className="card p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm">
              <span className="num font-semibold">{mapped.rows.length}</span> rows ready
              {mapped.bad > 0 && <span className="text-warn"> · {mapped.bad} skipped (missing date/amount)</span>}
            </p>
            <button
              className="btn-primary"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const r = await importTransactions(mapped.rows);
                  setResult(r.error ?? `Imported ${r.imported} transactions${r.duplicates ? ` · ${r.duplicates} already existed` : ""}.`);
                })
              }
            >
              {pending ? "Importing…" : "Import"}
            </button>
          </div>
          {result && <p className="mb-3 text-sm text-ok">{result}</p>}
          <div className="max-h-96 overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-surface text-left">
                <tr><th className="eyebrow py-2">Date</th><th className="eyebrow">Description</th><th className="eyebrow text-right">Amount</th></tr>
              </thead>
              <tbody className="divide-y divide-line">
                {mapped.rows.slice(0, 200).map((r, i) => (
                  <tr key={i}>
                    <td className="num py-1.5 pr-3 text-muted">{r.date}</td>
                    <td className="max-w-xs truncate pr-3">{r.description}</td>
                    <td className={`num text-right ${r.amountCents > 0 ? "text-ok" : ""}`}>{fmt(r.amountCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {mapped.rows.length > 200 && <p className="mt-2 text-xs text-muted">Showing the first 200 rows.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
