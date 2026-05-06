import { Badge } from "@/components/ui/badge";

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

function statusBadge(status: Status) {
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

export function RsvpStatusBadge({ status, offline }: Props) {
  if (offline) {
    return (
      <span className="inline-flex items-center gap-1.5">
        {statusBadge(status)}
        <Badge
          variant="outline"
          className="border-[var(--status-offline)] text-[var(--status-offline)] bg-[var(--status-offline)]/10 text-[10px]"
        >
          offline
        </Badge>
      </span>
    );
  }
  return statusBadge(status);
}
