"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { useConvex, useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api, type Id } from "@/lib/convex";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { COUPLE, WEDDING } from "@/lib/site-config";
import { cn } from "@/lib/utils";

type Candidate = {
  id: Id<"guests">;
  firstName: string;
  lastName: string;
  postalSuffix?: string;
  rsvpStatus: "pending" | "yes" | "no";
};

/* The flow is a small state machine. Sub-steps live in their own components
   below to keep render branches narrow. */
type Step =
  | { kind: "lookup" }
  | { kind: "invitation"; candidates: Candidate[] }
  | { kind: "many"; candidates: Candidate[] }
  | { kind: "form"; guestId: Id<"guests"> }
  | { kind: "success"; firstName: string; rsvpStatus: "yes" | "no" };

interface Props {
  initialInvitationId?: string;
}

export function RsvpFlow({ initialInvitationId }: Props) {
  const settings = useQuery(api.settings.publicSettings, {});
  const lockedAt =
    settings && typeof settings.lockedAt === "number" ? settings.lockedAt : null;
  const isClosed = useIsClosed(lockedAt);

  // If we landed with an invitation token, kick off the chooser flow.
  const [step, setStep] = useState<Step>(() =>
    initialInvitationId
      ? { kind: "invitation", candidates: [] }
      : { kind: "lookup" },
  );

  if (settings === undefined) {
    return <FlowSkeleton />;
  }

  if (isClosed) {
    return <ClosedCard />;
  }

  switch (step.kind) {
    case "lookup":
      return (
        <LookupForm
          onMatch={(result) => {
            if (result.kind === "none") {
              toast.error(
                "We couldn't find that name. Double-check the spelling and try again.",
                { duration: 7000 },
              );
              return;
            }
            if (result.kind === "one") {
              setStep({ kind: "form", guestId: result.candidate.id });
              return;
            }
            setStep({ kind: "many", candidates: result.candidates });
          }}
        />
      );
    case "invitation":
      return (
        <InvitationChooser
          invitationId={initialInvitationId!}
          onPick={(candidate) =>
            setStep({ kind: "form", guestId: candidate.id })
          }
        />
      );
    case "many":
      return (
        <ManyChooser
          candidates={step.candidates}
          onPick={(candidate) =>
            setStep({ kind: "form", guestId: candidate.id })
          }
        />
      );
    case "form":
      return (
        <RsvpForm
          guestId={step.guestId}
          onSuccess={(firstName, rsvpStatus) =>
            setStep({ kind: "success", firstName, rsvpStatus })
          }
        />
      );
    case "success":
      return (
        <SuccessCard
          firstName={step.firstName}
          rsvpStatus={step.rsvpStatus}
          // When the guest came in via a household invitation link, offer a
          // loop-back so a parent can RSVP the next family member without
          // re-scanning the QR or typing the URL.
          onAnotherHouseholdMember={
            initialInvitationId
              ? () => setStep({ kind: "invitation", candidates: [] })
              : undefined
          }
        />
      );
  }
}

/* ----------------------------------------------------------------------
   Helpers
   -------------------------------------------------------------------- */

/**
 * Drives the "RSVPs are closed" banner. Reading `Date.now()` directly during
 * render is technically impure (and React's purity lint flags it), so we
 * stash it in state and refresh once a minute — also gives a free upgrade for
 * anyone who happens to be on the page when the cutoff fires.
 */
function useIsClosed(lockedAt: number | null): boolean {
  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => {
    if (lockedAt === null) return;
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, [lockedAt]);
  return lockedAt !== null && now > lockedAt;
}

/* ----------------------------------------------------------------------
   Step components
   -------------------------------------------------------------------- */

function FlowSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-10" />
      <Skeleton className="h-10" />
      <Skeleton className="h-10" />
      <Skeleton className="h-12" />
    </div>
  );
}

function ClosedCard() {
  return (
    <Card>
      <h2 className="font-heading text-2xl mb-3">RSVPs are closed</h2>
      <p className="text-muted-foreground">
        {`Thank you so much! If you still need to update your response, please reach out to ${COUPLE.groom} or ${COUPLE.bride} directly and we'll take care of it.`}
      </p>
    </Card>
  );
}

/* --- Step: Name lookup --- */

function LookupForm({
  onMatch,
}: {
  onMatch: (
    result:
      | { kind: "none" }
      | { kind: "one"; candidate: Candidate }
      | { kind: "many"; candidates: Candidate[] },
  ) => void;
}) {
  const convex = useConvex();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) {
      toast.error("First name and last name are both required.");
      return;
    }
    startTransition(async () => {
      try {
        const result = await convex.query(api.rsvp.findGuestForRsvp, {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
        });
        onMatch(result);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Lookup failed");
      }
    });
  }

  return (
    <Card>
      <p className="font-heading italic text-xl sm:text-2xl text-charcoal/80 text-center mb-2">
        So glad you&apos;re here.
      </p>
      <p className="text-center text-xs text-muted-foreground mb-6 leading-relaxed">
        Enter your name to find your invitation.
      </p>
      <form onSubmit={onSubmit} className="space-y-4">
        <FieldStack>
          <Label htmlFor="firstName">First name</Label>
          <Input
            id="firstName"
            value={firstName}
            autoComplete="given-name"
            onChange={(e) => setFirstName(e.target.value)}
            required
            autoFocus
          />
        </FieldStack>
        <FieldStack>
          <Label htmlFor="lastName">Last name</Label>
          <Input
            id="lastName"
            value={lastName}
            autoComplete="family-name"
            onChange={(e) => setLastName(e.target.value)}
            required
          />
        </FieldStack>
        <Button
          type="submit"
          disabled={pending}
          className="w-full h-12 text-base"
        >
          {pending ? "Looking…" : "Find my invitation"}
        </Button>
      </form>
    </Card>
  );
}

/* --- Step: Invitation chooser (QR-linked household) --- */

function InvitationChooser({
  invitationId,
  onPick,
}: {
  invitationId: string;
  onPick: (c: Candidate) => void;
}) {
  const candidates = useQuery(api.rsvp.getInvitationCandidates, {
    invitationId,
  });

  if (candidates === undefined) {
    return <FlowSkeleton />;
  }
  if (candidates.length === 0) {
    return (
      <Card>
        <h2 className="font-heading text-2xl mb-3">
          Invitation not found
        </h2>
        <p className="text-muted-foreground mb-6">
          This invitation link doesn&apos;t look right — try searching by
          name instead.
        </p>
        <Link
          href="/rsvp"
          className={buttonVariants({ variant: "outline" }) + " w-full h-12"}
        >
          Look up by name
        </Link>
      </Card>
    );
  }

  const anyAnswered = candidates.some((c) => c.rsvpStatus !== "pending");
  return (
    <Card>
      <p className="font-heading italic text-xl sm:text-2xl text-charcoal/80 text-center mb-2">
        We&apos;re so glad you scanned in.
      </p>
      <p className="text-center text-xs text-muted-foreground mb-6 leading-relaxed">
        {anyAnswered
          ? "Tap your name to RSVP. Already replied? Tap again to update."
          : "Tap your name to RSVP."}
      </p>
      <ul className="space-y-2">
        {candidates.map((c) => (
          <li key={c.id}>
            <button
              type="button"
              onClick={() => onPick(c)}
              className={cn(
                "w-full flex items-center justify-between gap-3 px-5 py-4 rounded-lg border border-border bg-card",
                "hover:border-charcoal/40 hover:bg-card/70 transition-colors",
              )}
            >
              <span className="font-heading text-xl truncate">
                {c.firstName} {c.lastName}
              </span>
              <ChooserStatus status={c.rsvpStatus} />
            </button>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/* --- Step: Multi-match chooser (same first+last name, different households) --- */

function ManyChooser({
  candidates,
  onPick,
}: {
  candidates: Candidate[];
  onPick: (c: Candidate) => void;
}) {
  return (
    <Card>
      <p className="text-center text-sm text-muted-foreground mb-6 leading-relaxed">
        We found a few people with that name. Pick yours — the suffix is the
        last 2 digits of your postal code.
      </p>
      <ul className="space-y-2">
        {candidates.map((c) => (
          <li key={c.id}>
            <button
              type="button"
              onClick={() => onPick(c)}
              className={cn(
                "w-full flex items-center justify-between px-5 py-4 rounded-lg border border-border bg-card",
                "hover:border-charcoal/40 hover:bg-card/70 transition-colors",
              )}
            >
              <span className="font-heading text-xl">
                {c.firstName} {c.lastName}
              </span>
              <span className="text-sm text-muted-foreground">
                {c.postalSuffix ? `…${c.postalSuffix}` : "—"}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/* --- Step: The actual RSVP form --- */

type LoadedGuest = NonNullable<
  ReturnType<typeof useQuery<typeof api.rsvp.getGuestForRsvp>>
>;

function RsvpForm({
  guestId,
  onSuccess,
}: {
  guestId: Id<"guests">;
  onSuccess: (firstName: string, rsvpStatus: "yes" | "no") => void;
}) {
  const guest = useQuery(api.rsvp.getGuestForRsvp, { guestId });

  if (guest === undefined) return <FlowSkeleton />;
  if (guest === null) {
    return (
      <Card>
        <h2 className="font-heading text-2xl mb-3">Invitation not found</h2>
        <p className="text-muted-foreground mb-6">
          We couldn&apos;t load that invitation. Please try the lookup again.
        </p>
        <Link
          href="/rsvp"
          className={buttonVariants({ variant: "outline" }) + " w-full h-12"}
        >
          Start over
        </Link>
      </Card>
    );
  }
  // Mounted-once form so its `useState` initializers can read `guest`
  // synchronously — avoids the setState-in-effect hydration anti-pattern.
  return (
    <RsvpFormFields
      key={guest.id}
      guest={guest}
      guestId={guestId}
      onSuccess={onSuccess}
    />
  );
}

function RsvpFormFields({
  guest,
  guestId,
  onSuccess,
}: {
  guest: LoadedGuest;
  guestId: Id<"guests">;
  onSuccess: (firstName: string, rsvpStatus: "yes" | "no") => void;
}) {
  const submit = useMutation(api.rsvp.submitRsvp);
  const [rsvpStatus, setRsvpStatus] = useState<"yes" | "no" | null>(
    guest.rsvpStatus === "pending" ? null : guest.rsvpStatus,
  );
  const [plusOneRsvp, setPlusOneRsvp] = useState<"yes" | "no" | null>(
    guest.plusOneRsvp ?? null,
  );
  const [plusOneName, setPlusOneName] = useState(guest.plusOneName ?? "");
  const [dietaryNotes, setDietaryNotes] = useState(guest.dietaryNotes ?? "");
  const [noteToCouple, setNoteToCouple] = useState(guest.noteToCouple ?? "");
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (rsvpStatus === null) {
      toast.error("Please pick yes or no.");
      return;
    }
    startTransition(async () => {
      try {
        await submit({
          guestId,
          rsvpStatus,
          plusOneRsvp:
            guest.plusOneAllowed && rsvpStatus === "yes"
              ? plusOneRsvp ?? undefined
              : undefined,
          plusOneName:
            guest.plusOneAllowed && rsvpStatus === "yes" && plusOneRsvp === "yes"
              ? plusOneName.trim() || undefined
              : undefined,
          dietaryNotes: dietaryNotes.trim() || undefined,
          noteToCouple: noteToCouple.trim() || undefined,
        });
        onSuccess(guest.firstName, rsvpStatus);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Submit failed");
      }
    });
  }

  return (
    <Card>
      <div className="text-center mb-8">
        <p className="font-heading italic text-lg text-charcoal/70 mb-1">
          Hello,
        </p>
        <p className="font-heading text-3xl sm:text-4xl">
          {guest.firstName} {guest.lastName}
        </p>
      </div>
      <form onSubmit={onSubmit} className="space-y-7">
        <fieldset>
          <legend className="block font-heading italic text-xl sm:text-2xl text-charcoal mb-4 text-center">
            Will you be joining us?
          </legend>
          <div className="grid grid-cols-2 gap-3">
            <ChoiceTile
              selected={rsvpStatus === "yes"}
              onClick={() => setRsvpStatus("yes")}
              tone="yes"
              label="Joyfully accept"
            />
            <ChoiceTile
              selected={rsvpStatus === "no"}
              onClick={() => setRsvpStatus("no")}
              tone="no"
              label="Regretfully decline"
            />
          </div>
        </fieldset>

        {guest.plusOneAllowed && rsvpStatus === "yes" && (
          <fieldset className="space-y-3">
            <legend className="block font-heading italic text-lg text-charcoal mb-1 text-center">
              You&apos;re welcome to bring a plus-one.
            </legend>
            <div className="grid grid-cols-2 gap-3">
              <ChoiceTile
                selected={plusOneRsvp === "yes"}
                onClick={() => setPlusOneRsvp("yes")}
                label="Bringing one"
                tone="yes"
                small
              />
              <ChoiceTile
                selected={plusOneRsvp === "no"}
                onClick={() => setPlusOneRsvp("no")}
                label="Just me"
                tone="no"
                small
              />
            </div>
            {plusOneRsvp === "yes" && (
              <FieldStack>
                <Label htmlFor="plus-one-name">Plus-one name (optional)</Label>
                <Input
                  id="plus-one-name"
                  value={plusOneName}
                  onChange={(e) => setPlusOneName(e.target.value)}
                  placeholder="Their name"
                  maxLength={120}
                />
              </FieldStack>
            )}
          </fieldset>
        )}

        {rsvpStatus === "yes" && (
          <FieldStack>
            <Label htmlFor="dietary">Dietary needs or allergies</Label>
            <Textarea
              id="dietary"
              rows={2}
              value={dietaryNotes}
              onChange={(e) => setDietaryNotes(e.target.value)}
              placeholder="Vegetarian, gluten-free, allergic to…"
              maxLength={1000}
            />
          </FieldStack>
        )}

        <FieldStack>
          <Label htmlFor="note">Leave us a note (optional)</Label>
          <Textarea
            id="note"
            rows={3}
            value={noteToCouple}
            onChange={(e) => setNoteToCouple(e.target.value)}
            placeholder="Anything you'd like to share"
            maxLength={2000}
          />
        </FieldStack>

        <Button
          type="submit"
          disabled={pending || rsvpStatus === null}
          className="w-full h-12 text-base"
        >
          {pending ? "Sending…" : "Send my response"}
        </Button>
      </form>
    </Card>
  );
}

/* --- Step: Success card --- */

function SuccessCard({
  firstName,
  rsvpStatus,
  onAnotherHouseholdMember,
}: {
  firstName: string;
  rsvpStatus: "yes" | "no";
  onAnotherHouseholdMember?: () => void;
}) {
  return (
    <Card>
      <div className="text-center">
        <div
          className="mx-auto mb-6 flex items-center justify-center gap-3 text-blush"
          aria-hidden
        >
          <span className="block h-px w-10 bg-blush/40" />
          <span className="text-lg leading-none">♥</span>
          <span className="block h-px w-10 bg-blush/40" />
        </div>
        <p className="font-sans tracking-[0.4em] uppercase text-xs text-charcoal/60 mb-3">
          {rsvpStatus === "yes" ? "Wonderful" : "Thank you"}
        </p>
        <h2 className="font-heading text-3xl sm:text-4xl mb-4">
          {rsvpStatus === "yes"
            ? `You're set, ${firstName}.`
            : `We'll miss you, ${firstName}.`}
        </h2>
        <p className="text-muted-foreground leading-relaxed mb-8">
          {rsvpStatus === "yes"
            ? `We can't wait to celebrate with you${
                WEDDING.dateISO ? ` on ${WEDDING.dateISO}` : ""
              }. More details — schedule, venue, registry — coming soon.`
            : "Thank you for letting us know — we wish you could be there."}
        </p>
        {onAnotherHouseholdMember ? (
          <div className="flex flex-col gap-3 items-center">
            <Button
              type="button"
              onClick={onAnotherHouseholdMember}
              className="w-full h-12 text-sm tracking-[0.2em] uppercase"
            >
              RSVP for another in your household
            </Button>
            <Link
              href="/"
              className="text-xs tracking-[0.3em] uppercase text-muted-foreground hover:text-charcoal transition-colors"
            >
              All done — back to home
            </Link>
          </div>
        ) : (
          <Link
            href="/"
            className="inline-block text-xs tracking-[0.3em] uppercase text-muted-foreground hover:text-charcoal transition-colors"
          >
            Back to home
          </Link>
        )}
      </div>
    </Card>
  );
}

/* ----------------------------------------------------------------------
   Layout primitives — kept tiny so the public form has its own sense of
   place independent of the admin shell.
   -------------------------------------------------------------------- */

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card shadow-sm px-6 py-8 sm:px-10 sm:py-10">
      {children}
    </div>
  );
}

function FieldStack({ children }: { children: React.ReactNode }) {
  return <div className="space-y-1.5">{children}</div>;
}

function ChooserStatus({ status }: { status: "pending" | "yes" | "no" }) {
  // Compact status pill that lives inside chooser rows. Sage for yes, dusty
  // rose for no, muted for pending — matches the admin badge palette so
  // status reads consistently across surfaces.
  if (status === "yes") {
    return (
      <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-[var(--status-yes)]/15 text-[var(--status-yes)] px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-widest">
        <span aria-hidden>✓</span>
        Yes
      </span>
    );
  }
  if (status === "no") {
    return (
      <span className="shrink-0 inline-flex items-center rounded-full border border-[var(--status-no)]/40 text-[var(--status-no)] bg-[var(--status-no)]/10 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-widest">
        Declined
      </span>
    );
  }
  return (
    <span className="shrink-0 text-[10px] uppercase tracking-widest text-muted-foreground">
      Pending
    </span>
  );
}

function ChoiceTile({
  selected,
  onClick,
  label,
  tone,
  small,
}: {
  selected: boolean;
  onClick: () => void;
  label: string;
  tone: "yes" | "no";
  small?: boolean;
}) {
  // Hairline glyph above the label — yes gets a blush heart so the affirmative
  // tile carries a touch more warmth than the decline tile, even when
  // unselected. Selected states use charcoal text on a fuller bg tint so the
  // chosen state is more legible than the unchosen one.
  const glyph = tone === "yes" ? "♥" : "—";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "w-full rounded-xl border-2 px-3 sm:px-4 transition-all text-center",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-charcoal/70 focus-visible:ring-offset-2 focus-visible:ring-offset-cream",
        small ? "py-3" : "py-4 sm:py-5",
        selected
          ? tone === "yes"
            ? "border-[var(--status-yes)] bg-[var(--status-yes)]/20 ring-1 ring-[var(--status-yes)]/30"
            : "border-[var(--status-no)] bg-[var(--status-no)]/20 ring-1 ring-[var(--status-no)]/30"
          : "border-border bg-card hover:border-charcoal/30",
      )}
    >
      {!small && (
        <div
          className={cn(
            "text-2xl leading-none mb-1.5",
            tone === "yes" ? "text-blush" : "text-muted-foreground/60",
          )}
          aria-hidden
        >
          {glyph}
        </div>
      )}
      <div
        className={cn(
          "font-heading text-charcoal",
          small ? "text-base" : "text-base sm:text-xl",
        )}
      >
        {label}
      </div>
    </button>
  );
}
