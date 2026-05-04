import { GuestForm } from "@/components/admin/guest-form";
import Link from "next/link";

export default function NewGuestPage() {
  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <Link
          href="/admin"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Back to guest list
        </Link>
        <h1 className="font-heading text-3xl mt-2">Add a guest</h1>
      </div>
      <GuestForm mode="create" />
    </div>
  );
}
