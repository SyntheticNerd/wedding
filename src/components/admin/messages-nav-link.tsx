"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/lib/convex";

export function MessagesNavLink() {
  const unread = useQuery(api.messages.unreadCount);

  return (
    <Link
      href="/admin/messages"
      className="text-foreground hover:text-foreground/70 py-2 -my-2 inline-flex items-center gap-1.5"
    >
      <span className="sm:hidden">Msgs</span>
      <span className="hidden sm:inline">Messages</span>
      {typeof unread === "number" && unread > 0 && (
        <span
          aria-label={`${unread} unread`}
          className="inline-flex items-center justify-center min-w-[1.1rem] h-[1.1rem] rounded-full bg-blush text-cream text-[10px] font-semibold px-1 tabular-nums"
        >
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </Link>
  );
}
