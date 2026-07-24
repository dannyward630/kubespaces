import { Boxes, CircleCheck, LoaderCircle, CircleAlert } from "lucide-react";
import { StatCard } from "@/components/ui/StatCard";
import { isTransitional } from "@/lib/types";
import type { Tenant } from "@/lib/types";

/** A row of stat cards summarizing tenants by phase. */
export function TenantStats({ tenants }: { tenants: Tenant[] }) {
  const total = tenants.length;
  const ready = tenants.filter((t) => t.phase === "Ready").length;
  const inProgress = tenants.filter((t) => isTransitional(t.phase)).length;
  const failed = tenants.filter((t) => t.phase === "Failed").length;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <StatCard label="Total tenants" value={total} icon={Boxes} />
      <StatCard label="Ready" value={ready} icon={CircleCheck} tone="green" />
      <StatCard label="In progress" value={inProgress} icon={LoaderCircle} tone="amber" />
      <StatCard label="Failed" value={failed} icon={CircleAlert} tone="red" />
    </div>
  );
}
