import { MessagesView } from "@/components/admin/messages-view";

export const dynamic = "force-dynamic";

export default function AdminMessagesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-3xl">Messages</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Notes from guests via the contact form on the landing page.
        </p>
      </div>
      <MessagesView />
    </div>
  );
}
