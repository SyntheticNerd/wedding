import { TravelEditor } from "@/components/admin/travel-editor";

export default function TravelPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-3xl">Travel &amp; info</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Hotels, how to get here, and practical info for out-of-town guests.
          Shown on the home page between the hero and the contact form.
        </p>
      </div>
      <TravelEditor />
    </div>
  );
}
