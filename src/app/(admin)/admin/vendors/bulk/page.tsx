import Link from "next/link";
import { VendorBulkForm } from "@/components/admin/vendor-bulk-form";

export default function VendorBulkPage() {
  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/vendors"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Back to vendors
        </Link>
        <h1 className="font-heading text-3xl mt-2">Bulk add vendors</h1>
      </div>
      <VendorBulkForm />
    </div>
  );
}
