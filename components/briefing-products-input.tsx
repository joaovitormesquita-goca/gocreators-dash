"use client";

import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export function BriefingProductsInput({
  value,
  onChange,
  placeholder = "Digite e pressione Enter...",
  className,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  className?: string;
}) {
  const [draft, setDraft] = React.useState("");

  function commitDraft() {
    const trimmed = draft.trim();
    if (!trimmed) return;
    if (value.includes(trimmed)) {
      setDraft("");
      return;
    }
    onChange([...value, trimmed]);
    setDraft("");
  }

  function removeAt(index: number) {
    const next = [...value];
    next.splice(index, 1);
    onChange(next);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      commitDraft();
      return;
    }
    if (e.key === "Backspace" && draft === "" && value.length > 0) {
      e.preventDefault();
      removeAt(value.length - 1);
    }
  }

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-1.5 px-3 py-2",
        className,
      )}
    >
      {value.map((tag, i) => (
        <span
          key={`${tag}-${i}`}
          className="inline-flex items-center gap-1 rounded-md border bg-secondary px-2 py-0.5 text-xs"
        >
          {tag}
          <button
            type="button"
            onClick={() => removeAt(i)}
            className="rounded hover:bg-muted"
            aria-label={`Remover ${tag}`}
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <input
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={commitDraft}
        placeholder={value.length === 0 ? placeholder : ""}
        className="flex-1 min-w-[120px] bg-transparent text-sm focus:outline-none"
      />
    </div>
  );
}
