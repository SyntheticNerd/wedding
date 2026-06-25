import { ChecklistView } from "@/components/admin/checklist-view";

export default function ChecklistPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-3xl">Checklist</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Everything left to plan and finalize — tied to your vendor list.
        </p>
      </div>

      <ChecklistView />
    </div>
  );
}
