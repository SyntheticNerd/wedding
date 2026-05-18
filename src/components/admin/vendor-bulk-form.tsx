"use client";

import { useState, useTransition } from "react";
import { useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { api } from "@/lib/convex";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  CATEGORIES,
  CATEGORIES_WITH_INCLUDES,
  INCLUDES,
  STATUSES,
  PRICE_UNITS,
} from "@/lib/vendor-categories";

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

// Built from the same const arrays the schema uses, so the prompt and the
// validator can't drift out of sync.
const LLM_PROMPT = `You are helping plan a wedding. Output a JSON array of vendor objects to paste into a wedding-planning admin tool.

TASK: Find {N} {category} vendors in {location} matching: {criteria}

Output ONLY a JSON array. No markdown fence, no commentary.

Each vendor object accepts these fields:
- name (string, REQUIRED)
- category (string, REQUIRED) — one of: ${CATEGORIES.join(", ")}
- status (string, optional, defaults to "considering") — one of: ${STATUSES.join(", ")}
- priceTotal (integer USD, optional)
- priceUnit (string, optional) — one of: ${PRICE_UNITS.join(", ")}
- includes (string[], optional, only meaningful for: ${Array.from(CATEGORIES_WITH_INCLUDES).join(", ")}) — any of: ${INCLUDES.join(", ")}
- contactName (string, optional)
- phone (string, optional)
- email (string, optional)
- website (string, optional)
- location (string, optional) — e.g. "Carmel, CA"
- notes (string, optional, markdown) — anything relevant: style, reviews, what's notable
- rating (integer 1-5, optional)
- pros (string, optional)
- cons (string, optional)

EXAMPLE:
[
  {
    "name": "Sunset Manor",
    "category": "venue",
    "status": "considering",
    "priceTotal": 20000,
    "priceUnit": "flat",
    "includes": ["catering", "bar", "linens"],
    "location": "Carmel, CA",
    "website": "https://example.com",
    "notes": "Coastal venue, all-inclusive. Bundle covers catering + bar + linens."
  }
]

Now produce the array.`;

export function VendorBulkForm() {
  const router = useRouter();
  const bulkAdd = useMutation(api.vendors.bulkAdd);
  const [text, setText] = useState("");
  const [pending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);
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

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(LLM_PROMPT);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy — your browser blocked clipboard access");
    }
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <p className="text-sm text-muted-foreground">
        Paste a JSON array of vendor objects. Each object accepts the same
        fields as a single add. Validation runs per-row; partial successes
        are kept.
      </p>

      <details className="rounded-lg border border-border bg-card overflow-hidden group">
        <summary className="cursor-pointer select-none px-4 py-3 text-sm font-medium hover:bg-muted/40 transition-colors flex items-center gap-2">
          <span className="text-[var(--accent)] group-open:rotate-90 transition-transform inline-block">
            ▶
          </span>
          Need help generating JSON? Copy a prompt for ChatGPT or Claude
        </summary>
        <div className="border-t border-border p-4 space-y-3">
          <p className="text-xs text-muted-foreground">
            Replace <code>{"{N}"}</code>, <code>{"{category}"}</code>,{" "}
            <code>{"{location}"}</code>, and <code>{"{criteria}"}</code>{" "}
            inline, paste into your chat tool, then paste its JSON output
            below.
          </p>
          <pre className="bg-muted/40 rounded-md p-3 text-xs overflow-auto max-h-72 whitespace-pre-wrap font-mono">
            {LLM_PROMPT}
          </pre>
          <Button onClick={copyPrompt} variant="outline" size="sm">
            {copied ? "Copied ✓" : "Copy prompt"}
          </Button>
        </div>
      </details>

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
