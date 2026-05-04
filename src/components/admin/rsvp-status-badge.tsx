import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Status = "pending" | "yes" | "no";

interface Props {
  status: Status;
  offline?: boolean;
}

const COPY: Record<Status, string> = {
  pending: "Pending",
  yes: "Yes",
  no: "No",
};

export function RsvpStatusBadge({ status, offline }: Props) {
  if (offline) {
    return (
      <Badge
        variant="outline"
        className={cn(
          "border-[var(--status-offline)] text-[var(--status-offline)] bg-[var(--status-offline)]/10",
        )}
      >
        Offline
      </Badge>
    );
  }
  if (status === "yes") {
    return (
      <Badge className="bg-[var(--status-yes)] text-white hover:bg-[var(--status-yes)]/90">
        {COPY[status]}
      </Badge>
    );
  }
  if (status === "no") {
    return (
      <Badge
        variant="outline"
        className="border-[var(--status-no)] text-[var(--status-no)] bg-[var(--status-no)]/10"
      >
        {COPY[status]}
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="bg-muted text-muted-foreground">
      {COPY[status]}
    </Badge>
  );
}
