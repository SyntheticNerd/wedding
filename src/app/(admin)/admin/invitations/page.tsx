import { InvitationsView } from "@/components/admin/invitations-view";

export const dynamic = "force-dynamic";

export default function InvitationsPage() {
  return (
    <div>
      <header className="flex items-center justify-between mb-6 print:hidden">
        <div>
          <h1 className="font-heading text-3xl">Invitations</h1>
          <p className="text-sm text-muted-foreground mt-1">
            One QR per household — link directly to /rsvp with the invitation
            pre-selected. Hand to print and tuck into the physical invitation.
          </p>
        </div>
      </header>
      <InvitationsView />
    </div>
  );
}
