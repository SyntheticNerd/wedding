import { GuestTable } from "@/components/admin/guest-table";
import { RollupChips } from "@/components/admin/rollup-chips";
import { CapacityBar } from "@/components/admin/capacity-bar";

export default function AdminGuestsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-3xl">Guest list</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Track who&apos;s coming, who hasn&apos;t replied, and update RSVPs on
          behalf of guests who responded by phone.
        </p>
      </div>
      <RollupChips />
      <CapacityBar />
      <GuestTable />
    </div>
  );
}
