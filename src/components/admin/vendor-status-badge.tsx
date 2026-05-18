import { Badge } from "@/components/ui/badge";
import { STATUS_LABELS, type VendorStatus } from "@/lib/vendor-categories";

export function VendorStatusBadge({ status }: { status: VendorStatus }) {
  if (status === "chosen") {
    return (
      <Badge className="bg-[var(--status-yes)] text-white hover:bg-[var(--status-yes)]/90">
        {STATUS_LABELS[status]}
      </Badge>
    );
  }
  if (status === "passed") {
    return (
      <Badge variant="secondary" className="bg-muted text-muted-foreground">
        {STATUS_LABELS[status]}
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      className="border-[var(--status-pending)] text-[var(--status-pending)] bg-[var(--status-pending)]/10"
    >
      {STATUS_LABELS[status]}
    </Badge>
  );
}
