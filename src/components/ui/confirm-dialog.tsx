"use client";

import { useCallback, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export interface ConfirmOptions {
  /** Heading — usually the question, e.g. "Delete Jane Smith?" */
  title: string;
  /** Optional supporting line (reversibility note, side effects, etc.). */
  description?: string;
  /** Label for the confirming action. Defaults to "Confirm". */
  confirmLabel?: string;
  /** Label for the dismissing action. Defaults to "Cancel". */
  cancelLabel?: string;
  /** Render the confirm button in the destructive style. */
  destructive?: boolean;
}

/**
 * In-app replacement for `window.confirm()`.
 *
 * The native `confirm()` dialog is silently suppressed on iOS — in
 * home-screen (standalone PWA) mode and in several in-app browsers it
 * returns `false` immediately without ever showing a prompt, so any
 * action gated behind it (e.g. delete) appears to do nothing. This hook
 * renders a real in-DOM dialog that works on every platform.
 *
 * Usage:
 *   const { confirm, confirmDialog } = useConfirm();
 *   // in JSX: {confirmDialog}
 *   if (!(await confirm({ title: "Delete?", destructive: true }))) return;
 */
export function useConfirm() {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolverRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback((opts: ConfirmOptions) => {
    setOptions(opts);
    setOpen(true);
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  const resolve = useCallback((value: boolean) => {
    setOpen(false);
    resolverRef.current?.(value);
    resolverRef.current = null;
  }, []);

  const confirmDialog = (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // Closing by overlay/Esc counts as a cancel — never strand the promise.
        if (!next) resolve(false);
      }}
    >
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{options?.title ?? "Are you sure?"}</DialogTitle>
          {options?.description && (
            <DialogDescription>{options.description}</DialogDescription>
          )}
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => resolve(false)}>
            {options?.cancelLabel ?? "Cancel"}
          </Button>
          <Button
            variant={options?.destructive ? "destructive" : "default"}
            onClick={() => resolve(true)}
          >
            {options?.confirmLabel ?? "Confirm"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return { confirm, confirmDialog };
}
