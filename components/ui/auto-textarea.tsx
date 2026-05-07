"use client";

import * as React from "react";
import TextareaAutosize, {
  type TextareaAutosizeProps,
} from "react-textarea-autosize";
import { cn } from "@/lib/utils";

export type AutoTextareaProps = TextareaAutosizeProps;

export const AutoTextarea = React.forwardRef<
  HTMLTextAreaElement,
  AutoTextareaProps
>(({ className, minRows = 2, ...props }, ref) => {
  return (
    <TextareaAutosize
      ref={ref}
      minRows={minRows}
      className={cn(
        "flex w-full resize-none bg-transparent px-3 py-2 text-sm",
        "placeholder:text-muted-foreground",
        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
});
AutoTextarea.displayName = "AutoTextarea";
