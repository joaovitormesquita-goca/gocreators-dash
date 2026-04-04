import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonTable } from "@/components/skeleton-table";

export default function Loading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-48" />
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-[140px]" />
        <Skeleton className="h-10 w-[240px]" />
      </div>
      <SkeletonTable rows={6} cols={8} />
    </div>
  );
}
