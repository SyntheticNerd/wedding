import { VendorDetail } from "@/components/admin/vendor-detail";
import type { Id } from "@/lib/convex";

export default async function VendorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <VendorDetail id={id as Id<"vendors">} />;
}
