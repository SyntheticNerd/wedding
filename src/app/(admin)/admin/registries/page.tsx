import { RegistryList } from "@/components/admin/registry-list";

export default function RegistriesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-3xl">Registries</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Where you&apos;re registered. Shown as a logo strip on the public
          Registry page.
        </p>
      </div>
      <RegistryList />
    </div>
  );
}
