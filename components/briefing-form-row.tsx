import * as React from "react";
import { cn } from "@/lib/utils";

export function BriefingFormRow({
  label,
  children,
  className,
  isLast,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
  isLast?: boolean;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-[140px_1fr] divide-x divide-border",
        !isLast && "border-b",
        className,
      )}
    >
      <div className="bg-muted/40 px-4 py-3 text-sm font-medium text-muted-foreground">
        {label}
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
