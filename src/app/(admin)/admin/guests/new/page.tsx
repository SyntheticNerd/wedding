import { GuestForm } from "@/components/admin/guest-form";
import Link from "next/link";

export default async function NewGuestPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const raw = params.invitation;
  // When invoked from a guest detail page's "Add household member" link, the
  // invitationId is passed through so the form lands pre-filled and the user
  // doesn't have to copy/paste a 16-char ID.
  const invitationId = Array.isArray(raw) ? raw[0] : raw;

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <Link
          href="/admin"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Back to guest list
        </Link>
        <h1 className="font-heading text-3xl mt-2">
          {invitationId ? "Add to household" : "Add a guest"}
        </h1>
        {invitationId && (
          <p className="text-sm text-muted-foreground mt-1">
            Joining invitation{" "}
            <span className="font-mono">{invitationId}</span>
          </p>
        )}
      </div>
      <GuestForm mode="create" defaultInvitationId={invitationId} />
    </div>
  );
}
