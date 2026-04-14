import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonTable } from "@/components/skeleton-table";

export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-48" />
      </div>
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-[240px]" />
        <Skeleton className="h-10 w-[180px]" />
      </div>
      <SkeletonTable rows={5} cols={5} />
    </div>
  );
}
