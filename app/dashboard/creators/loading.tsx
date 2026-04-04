import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonTable } from "@/components/skeleton-table";

export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-24" />
      </div>
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-[200px]" />
        <Skeleton className="h-10 w-[200px]" />
      </div>
      <SkeletonTable rows={5} cols={8} />
    </div>
  );
}
