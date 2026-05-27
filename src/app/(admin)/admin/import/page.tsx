"use client";

import { useState, useTransition } from "react";
import Papa from "papaparse";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/convex";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
const SAMPLE = `firstName,lastName,aliases,phoneRaw,email,side,plusOneAllowed,plusOneName,invitationId,adminNotes
Jane,Doe,"Janie",(415) 555-1234,jane@example.com,bride,true,John Smith,,
John,Doe,,(415) 555-1234,john.d@example.com,groom,false,,,
Maria,Núñez,Mari,+34 600 000 000,maria@example.com,both,true,,,Coming from Spain
`;

interface Row {
  firstName: string;
  lastName: string;
  aliases?: string[];
  phoneRaw?: string;
  email?: string;
  side: "bride" | "groom" | "both";
  isChild?: boolean;
  plusOneAllowed?: boolean;
  plusOneName?: string;
  invitationId?: string;
  adminNotes?: string;
}

export default function ImportPage() {
  const router = useRouter();
  const [csvText, setCsvText] = useState("");
  const [parsed, setParsed] = useState<Row[] | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();
  const bulkImport = useMutation(api.guests.bulkImport);

  function parse() {
    const text = csvText.trim();
    if (!text) {
      setParsed(null);
      setErrors(["Paste CSV data first."]);
      return;
    }
    const result = Papa.parse(text, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim(),
    });
    const errs: string[] = [];
    const rows: Row[] = [];
    for (let i = 0; i < result.data.length; i++) {
      const r = result.data[i] as Record<string, string>;
      if (!r.firstName?.trim() || !r.lastName?.trim()) {
        errs.push(`Row ${i + 2}: missing firstName or lastName`);
        continue;
      }
      const side = (r.side ?? "both").trim().toLowerCase();
      if (!["bride", "groom", "both"].includes(side)) {
        errs.push(
          `Row ${i + 2}: side must be one of bride/groom/both (got "${side}")`,
        );
        continue;
      }
      rows.push({
        firstName: r.firstName.trim(),
        lastName: r.lastName.trim(),
        aliases: r.aliases
          ? r.aliases
              .split("|")
              .map((s) => s.trim())
              .filter(Boolean)
          : undefined,
        phoneRaw: r.phoneRaw?.trim() || undefined,
        email: r.email?.trim() || undefined,
        side: side as Row["side"],
        isChild: r.isChild ? r.isChild.toLowerCase() === "true" : undefined,
        plusOneAllowed: r.plusOneAllowed
          ? r.plusOneAllowed.toLowerCase() === "true"
          : undefined,
        plusOneName: r.plusOneName?.trim() || undefined,
        invitationId: r.invitationId?.trim() || undefined,
        adminNotes: r.adminNotes?.trim() || undefined,
      });
    }
    setErrors(errs);
    setParsed(rows);
  }

  function commit() {
    if (!parsed || parsed.length === 0) return;
    startTransition(async () => {
      try {
        const result = await bulkImport({ rows: parsed });
        toast.success(`Imported ${result.inserted} guests`);
        router.push("/admin/guests");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Import failed");
      }
    });
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <Link
          href="/admin/guests"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Back to guest list
        </Link>
        <h1 className="font-heading text-3xl mt-2">Bulk import</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Paste a CSV. Headers must include{" "}
          <code className="text-xs bg-muted px-1 rounded">firstName</code>,{" "}
          <code className="text-xs bg-muted px-1 rounded">lastName</code>, and{" "}
          <code className="text-xs bg-muted px-1 rounded">side</code>. All
          other columns are optional.
        </p>
      </div>

      <div className="space-y-2">
        <Textarea
          rows={10}
          value={csvText}
          onChange={(e) => setCsvText(e.target.value)}
          placeholder={SAMPLE}
          className="font-mono text-xs"
        />
        <div className="flex items-center gap-2">
          <Button onClick={parse} variant="outline">
            Parse preview
          </Button>
          <Button
            variant="ghost"
            onClick={() => setCsvText(SAMPLE)}
          >
            Load sample
          </Button>
        </div>
      </div>

      {errors.length > 0 && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3">
          <h2 className="text-sm font-medium text-destructive mb-1">
            {errors.length} row{errors.length === 1 ? "" : "s"} skipped
          </h2>
          <ul className="text-xs space-y-0.5 text-destructive">
            {errors.slice(0, 10).map((e, i) => (
              <li key={i}>{e}</li>
            ))}
            {errors.length > 10 && (
              <li>… and {errors.length - 10} more</li>
            )}
          </ul>
        </div>
      )}

      {parsed && parsed.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-heading text-xl">
            Preview — {parsed.length} guests
          </h2>
          <div className="rounded-md border border-border bg-card max-h-96 overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Side</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>+1?</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {parsed.slice(0, 200).map((r, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      {r.firstName} {r.lastName}
                    </TableCell>
                    <TableCell>{r.side}</TableCell>
                    <TableCell className="text-xs">
                      {r.phoneRaw ?? "—"}
                    </TableCell>
                    <TableCell className="text-xs">
                      {r.email ?? "—"}
                    </TableCell>
                    <TableCell>
                      {r.plusOneAllowed ? "yes" : "no"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <Button onClick={commit} disabled={pending}>
            Import {parsed.length} guests
          </Button>
        </div>
      )}
    </div>
  );
}
