import Link from "next/link";
import { VendorForm } from "@/components/admin/vendor-form";

export default function NewVendorPage() {
  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/vendors"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Back to vendors
        </Link>
        <h1 className="font-heading text-3xl mt-2">Add vendor</h1>
      </div>
      <VendorForm />
    </div>
  );
}
