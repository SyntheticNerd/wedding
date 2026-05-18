"use client";

import { useState, useTransition } from "react";
import { useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { api } from "@/lib/convex";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

const SAMPLE = `[
  {
    "name": "Iris & Oak Studio",
    "category": "photographer",
    "status": "considering",
    "priceTotal": 4800,
    "priceUnit": "flat",
    "website": "https://example.com",
    "notes": "8hr, 2 shooters, prints, online gallery"
  }
]`;

export function VendorBulkForm() {
  const router = useRouter();
  const bulkAdd = useMutation(api.vendors.bulkAdd);
  const [text, setText] = useState("");
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{
    inserted: number;
    errors: Array<{ index: number; message: string }>;
  } | null>(null);

  function submit() {
    setResult(null);
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch (err) {
      toast.error(
        `JSON parse error: ${err instanceof Error ? err.message : err}`,
      );
      return;
    }
    if (!Array.isArray(parsed)) {
      toast.error("Expected a JSON array of vendor objects");
      return;
    }

    startTransition(async () => {
      try {
        const res = await bulkAdd({ rows: parsed as never });
        setResult(res);
        if (res.errors.length === 0) {
          toast.success(`Added ${res.inserted} vendor(s)`);
          router.push("/admin/vendors");
        } else {
          toast.message(
            `Added ${res.inserted}, ${res.errors.length} failed — see details below`,
          );
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Bulk add failed");
      }
    });
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <p className="text-sm text-muted-foreground">
        Paste a JSON array of vendor objects. Each object accepts the same
        fields as a single add. Validation runs per-row; partial successes
        are kept.
      </p>

      <Textarea
        rows={18}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={SAMPLE}
        className="font-mono text-xs"
      />

      <div className="flex gap-2">
        <Button onClick={submit} disabled={pending || !text.trim()}>
          Add all
        </Button>
        <Button
          variant="outline"
          onClick={() => setText(SAMPLE)}
          disabled={pending}
        >
          Insert sample
        </Button>
      </div>

      {result && result.errors.length > 0 && (
        <div className="rounded-lg border border-[var(--status-no)]/50 bg-[var(--status-no)]/5 p-4 text-sm">
          <h3 className="font-medium mb-2">
            {result.inserted} inserted · {result.errors.length} failed
          </h3>
          <ul className="space-y-1">
            {result.errors.map((e) => (
              <li key={e.index} className="font-mono text-xs">
                row {e.index}: {e.message}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
