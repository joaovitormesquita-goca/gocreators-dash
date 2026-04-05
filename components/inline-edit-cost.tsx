"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { upsertCreatorCost } from "@/app/dashboard/costs/actions";
import { toast } from "sonner";

function formatCurrency(value: number | null) {
  if (value == null) return "R$ 0,00";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export function InlineEditCost({
  value,
  creatorBrandId,
  month,
  onSaved,
}: {
  value: number | null;
  creatorBrandId: number;
  month: string;
  onSaved: (newCost: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [isSaving, startSaving] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  function handleStartEdit() {
    setInputValue(value != null ? String(value) : "");
    setEditing(true);
  }

  function handleSave() {
    const parsed = parseFloat(inputValue.replace(",", "."));
    if (isNaN(parsed) || parsed <= 0) {
      toast.error("Custo deve ser um valor positivo");
      return;
    }

    const monthDate = new Date(month);
    const monthStr = `${monthDate.getUTCFullYear()}-${String(monthDate.getUTCMonth() + 1).padStart(2, "0")}-01`;

    startSaving(async () => {
      const result = await upsertCreatorCost({
        creatorBrandId,
        month: monthStr,
        cost: parsed,
      });
      if (result.success) {
        toast.success("Custo atualizado");
        onSaved(parsed);
        setEditing(false);
      } else {
        toast.error(result.error);
      }
    });
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") handleSave();
    if (e.key === "Escape") setEditing(false);
  }

  if (editing) {
    return (
      <Input
        ref={inputRef}
        type="text"
        inputMode="decimal"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        disabled={isSaving}
        className="h-7 w-28 text-sm"
      />
    );
  }

  return (
    <span
      className="cursor-pointer hover:underline decoration-dashed underline-offset-4"
      onClick={handleStartEdit}
      title="Clique para editar"
    >
      {value != null ? formatCurrency(value) : "—"}
    </span>
  );
}
