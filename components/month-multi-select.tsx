"use client";

import { useState } from "react";
import { Check, ChevronsUpDown, CalendarDays } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

function formatMonth(dateStr: string) {
  const date = new Date(dateStr);
  return date.toLocaleDateString("pt-BR", { month: "short", year: "numeric", timeZone: "UTC" });
}

interface MonthMultiSelectProps {
  months: string[];
  selected: string[];
  onSelectionChange: (months: string[]) => void;
  disabled?: boolean;
}

export function MonthMultiSelect({
  months,
  selected,
  onSelectionChange,
  disabled,
}: MonthMultiSelectProps) {
  const [open, setOpen] = useState(false);

  const allSelected = selected.length === months.length && months.length > 0;

  function toggleMonth(month: string) {
    if (selected.includes(month)) {
      onSelectionChange(selected.filter((s) => s !== month));
    } else {
      onSelectionChange([...selected, month]);
    }
  }

  function toggleAll() {
    if (allSelected) {
      onSelectionChange([]);
    } else {
      onSelectionChange([...months]);
    }
  }

  const label =
    selected.length === 0 || allSelected
      ? "Todos os meses"
      : selected.length === 1
        ? formatMonth(selected[0])
        : `${selected.length} meses`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-[200px] justify-between"
          disabled={disabled}
        >
          <CalendarDays className="mr-2 h-4 w-4 shrink-0 opacity-50" />
          <span className="truncate">{label}</span>
          <ChevronsUpDown className="ml-auto h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0">
        <Command>
          <CommandInput placeholder="Buscar mês..." />
          <CommandList>
            <CommandEmpty>Nenhum mês encontrado.</CommandEmpty>
            <CommandGroup>
              <CommandItem onSelect={toggleAll}>
                <Check
                  className={cn(
                    "mr-2 h-4 w-4",
                    allSelected ? "opacity-100" : "opacity-0",
                  )}
                />
                Selecionar todos
              </CommandItem>
              {months.map((month) => (
                <CommandItem
                  key={month}
                  value={formatMonth(month)}
                  onSelect={() => toggleMonth(month)}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      selected.includes(month) ? "opacity-100" : "opacity-0",
                    )}
                  />
                  {formatMonth(month)}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
