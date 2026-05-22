"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu } from "lucide-react";
import { UserButton } from "@clerk/nextjs";
import {
  Drawer,
  DrawerContent,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { MessagesNavLink } from "./messages-nav-link";

const DESKTOP_LINK =
  "text-foreground hover:text-foreground/70 py-2 -my-2";

export function AdminNav() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Desktop (md+): inline nav, unchanged from previous header */}
      <nav className="hidden md:flex items-center gap-6 text-sm">
        <Link href="/admin" className={DESKTOP_LINK}>
          Guests
        </Link>
        <Link href="/admin/invitations" className={DESKTOP_LINK}>
          Invitations
        </Link>
        <Link href="/admin/import" className={DESKTOP_LINK}>
          Import
        </Link>
        <MessagesNavLink />
        <Link href="/admin/vendors" className={DESKTOP_LINK}>
          Vendors
        </Link>
        <Link href="/admin/registries" className={DESKTOP_LINK}>
          Registry
        </Link>
        <Link href="/admin/settings" className={DESKTOP_LINK}>
          Settings
        </Link>
        <UserButton />
      </nav>

      {/* Mobile (below md): user button stays visible, hamburger opens drawer */}
      <div className="flex md:hidden items-center gap-2">
        <UserButton />
        <Drawer open={open} onOpenChange={setOpen} direction="right">
          <DrawerTrigger
            aria-label="Open navigation menu"
            className="inline-flex items-center justify-center size-10 rounded-md text-foreground hover:bg-muted active:bg-muted/70 transition-colors"
          >
            <Menu className="size-5" />
          </DrawerTrigger>
          <DrawerContent className="p-6 pt-8">
            <DrawerTitle className="text-xs uppercase tracking-widest text-muted-foreground font-medium mb-4">
              Admin
            </DrawerTitle>
            <nav className="flex flex-col text-base">
              <Link
                href="/admin"
                onClick={() => setOpen(false)}
                className="py-3 border-b border-border text-foreground"
              >
                Guests
              </Link>
              <Link
                href="/admin/invitations"
                onClick={() => setOpen(false)}
                className="py-3 border-b border-border text-foreground"
              >
                Invitations
              </Link>
              <Link
                href="/admin/import"
                onClick={() => setOpen(false)}
                className="py-3 border-b border-border text-foreground"
              >
                Import
              </Link>
              <MessagesNavLink
                variant="drawer"
                onClick={() => setOpen(false)}
              />
              <Link
                href="/admin/vendors"
                onClick={() => setOpen(false)}
                className="py-3 border-b border-border text-foreground"
              >
                Vendors
              </Link>
              <Link
                href="/admin/registries"
                onClick={() => setOpen(false)}
                className="py-3 border-b border-border text-foreground"
              >
                Registry
              </Link>
              <Link
                href="/admin/settings"
                onClick={() => setOpen(false)}
                className="py-3 text-foreground"
              >
                Settings
              </Link>
            </nav>
          </DrawerContent>
        </Drawer>
      </div>
    </>
  );
}
