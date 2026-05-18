"use client";

import Link from "next/link";
import { Authenticated, useQuery } from "convex/react";
import { api } from "@/lib/convex";
import { cn } from "@/lib/utils";

/**
 * Renders the Messages link with a live unread-count badge.
 *
 * Two variants:
 * - Default (desktop nav inline): label "Messages" with subtle padding.
 * - `variant="drawer"`: label "Messages", block row with bottom border to
 *   match the mobile hamburger drawer's stacked layout.
 *
 * `onClick` is forwarded so the drawer can close on tap.
 */
export function MessagesNavLink({
  variant = "inline",
  onClick,
}: {
  variant?: "inline" | "drawer";
  onClick?: () => void;
} = {}) {
  return (
    <Link
      href="/admin/messages"
      onClick={onClick}
      className={cn(
        "text-foreground inline-flex items-center gap-1.5",
        variant === "inline"
          ? "hover:text-foreground/70 py-2 -my-2"
          : "py-3 border-b border-border w-full",
      )}
    >
      Messages
      {/* The badge query is admin-gated. The nav header sits outside
          AdminShell, so during the brief Clerk → Convex auth handshake
          the query would otherwise throw "Not authenticated". Defer
          the fetch until Convex sees a valid session. */}
      <Authenticated>
        <UnreadBadge />
      </Authenticated>
    </Link>
  );
}

function UnreadBadge() {
  const unread = useQuery(api.messages.unreadCount);
  if (typeof unread !== "number" || unread === 0) return null;
  return (
    <span
      aria-label={`${unread} unread`}
      className="inline-flex items-center justify-center min-w-[1.1rem] h-[1.1rem] rounded-full bg-blush text-cream text-[10px] font-semibold px-1 tabular-nums"
    >
      {unread > 99 ? "99+" : unread}
    </span>
  );
}
