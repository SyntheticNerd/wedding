"use client";

import { useEffect, useState, useTransition } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api, type Doc, type Id } from "@/lib/convex";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { cn } from "@/lib/utils";

export function MessagesView() {
  const messages = useQuery(api.messages.list, {});
  const [selectedId, setSelectedId] = useState<Id<"messages"> | null>(null);

  if (messages === undefined) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20" />
        ))}
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card px-6 py-12 text-center text-muted-foreground">
        <p className="text-sm">No messages yet.</p>
      </div>
    );
  }

  const selected = selectedId
    ? messages.find((m) => m._id === selectedId) ?? null
    : null;

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
      <ul className="rounded-lg border border-border bg-card divide-y divide-border max-h-[70vh] overflow-y-auto">
        {messages.map((m) => (
          <li key={m._id}>
            <button
              type="button"
              onClick={() => setSelectedId(m._id)}
              className={cn(
                "w-full text-left px-4 py-3 transition-colors",
                "hover:bg-muted/50",
                selectedId === m._id && "bg-muted/60",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {!m.readAt && (
                      <span
                        aria-label="Unread"
                        className="size-1.5 rounded-full bg-blush shrink-0"
                      />
                    )}
                    <span
                      className={cn(
                        "truncate text-sm",
                        !m.readAt ? "font-semibold" : "font-medium",
                      )}
                    >
                      {m.name}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-sm text-charcoal/80">
                    {m.subject}
                  </p>
                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    {m.message}
                  </p>
                </div>
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground shrink-0">
                  {formatRelative(m.createdAt)}
                </span>
              </div>
            </button>
          </li>
        ))}
      </ul>
      <div className="rounded-lg border border-border bg-card p-5 lg:p-6 min-h-[18rem]">
        {selected ? (
          <MessageDetail
            message={selected}
            onClose={() => setSelectedId(null)}
          />
        ) : (
          <div className="text-sm text-muted-foreground">
            Select a message to read it.
          </div>
        )}
      </div>
    </div>
  );
}

function MessageDetail({
  message,
  onClose,
}: {
  message: Doc<"messages">;
  onClose: () => void;
}) {
  const markRead = useMutation(api.messages.markRead);
  const markUnread = useMutation(api.messages.markUnread);
  const markReplied = useMutation(api.messages.markReplied);
  const softDelete = useMutation(api.messages.softDelete);
  const [pending, startTransition] = useTransition();
  const { confirm, confirmDialog } = useConfirm();

  const id = message._id;

  // Auto-mark read when the detail view mounts for an unread message.
  // Idempotent server-side, so strict-mode double-fire is harmless.
  useEffect(() => {
    if (!message.readAt) {
      void markRead({ id });
    }
  }, [id, message.readAt, markRead]);

  const replyHref =
    `mailto:${encodeURIComponent(message.email)}` +
    `?subject=${encodeURIComponent(`Re: ${message.subject}`)}`;

  function onMarkUnread() {
    startTransition(async () => {
      try {
        await markUnread({ id });
        toast.success("Marked as unread.");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed.");
      }
    });
  }

  function onMarkReplied() {
    startTransition(async () => {
      try {
        await markReplied({ id });
        toast.success("Marked as replied.");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed.");
      }
    });
  }

  async function onDelete() {
    const ok = await confirm({
      title: `Delete the message from ${message.name}?`,
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!ok) return;
    startTransition(async () => {
      try {
        await softDelete({ id });
        toast.success("Deleted.");
        onClose();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed.");
      }
    });
  }

  return (
    <article className="space-y-4">
      {confirmDialog}
      <header className="space-y-1.5">
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
          {formatFullDate(message.createdAt)}
        </p>
        <h2 className="font-heading text-2xl leading-tight">
          {message.subject}
        </h2>
        <div className="text-sm text-muted-foreground">
          From{" "}
          <span className="text-charcoal font-medium">{message.name}</span> ·{" "}
          <a
            href={`mailto:${message.email}`}
            className="text-blush hover:underline"
          >
            {message.email}
          </a>
          {message.phoneRaw && (
            <>
              {" "}
              ·{" "}
              <a
                href={`tel:${message.phoneE164 ?? message.phoneRaw}`}
                className="text-blush hover:underline"
              >
                {message.phoneRaw}
              </a>
            </>
          )}
        </div>
      </header>
      <div className="rounded-md border border-border bg-cream/40 p-4 whitespace-pre-wrap text-sm leading-relaxed">
        {message.message}
      </div>
      {message.repliedAt && (
        <p className="text-xs text-[var(--status-yes)]">
          Marked replied {formatFullDate(message.repliedAt)}
        </p>
      )}
      <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
        <a
          href={replyHref}
          className={cn(
            "inline-flex items-center justify-center rounded-md border border-input bg-primary text-primary-foreground hover:bg-primary/90 h-9 px-4 text-sm font-medium",
          )}
        >
          Reply by email
        </a>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onMarkReplied}
          disabled={pending}
        >
          Mark replied
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onMarkUnread}
          disabled={pending}
        >
          Mark unread
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onDelete}
          disabled={pending}
          className="text-[var(--status-no)] border-[var(--status-no)]/40 hover:bg-[var(--status-no)]/10 ml-auto"
        >
          Delete
        </Button>
      </div>
    </article>
  );
}

/* ---------------- formatting helpers ---------------- */

function formatRelative(ts: number): string {
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "now";
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d`;
  return new Date(ts).toLocaleDateString();
}

function formatFullDate(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}
