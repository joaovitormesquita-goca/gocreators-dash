"use client";

import { useState } from "react";
import { Check, ChevronsUpDown, Users } from "lucide-react";

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

export type CreatorOption = {
  id: number;
  full_name: string;
};

interface CreatorMultiSelectProps {
  creators: CreatorOption[];
  selected: number[];
  onSelectionChange: (ids: number[]) => void;
  disabled?: boolean;
}

export function CreatorMultiSelect({
  creators,
  selected,
  onSelectionChange,
  disabled,
}: CreatorMultiSelectProps) {
  const [open, setOpen] = useState(false);

  const allSelected = selected.length === creators.length;

  function toggleCreator(id: number) {
    if (selected.includes(id)) {
      const next = selected.filter((s) => s !== id);
      onSelectionChange(next);
    } else {
      onSelectionChange([...selected, id]);
    }
  }

  function toggleAll() {
    if (allSelected) {
      onSelectionChange([]);
    } else {
      onSelectionChange(creators.map((c) => c.id));
    }
  }

  const label =
    selected.length === 0 || allSelected
      ? "Todos os creators"
      : selected.length === 1
        ? creators.find((c) => c.id === selected[0])?.full_name ?? "1 creator"
        : `${selected.length} creators`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-[240px] justify-between"
          disabled={disabled}
        >
          <Users className="mr-2 h-4 w-4 shrink-0 opacity-50" />
          <span className="truncate">{label}</span>
          <ChevronsUpDown className="ml-auto h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[240px] p-0">
        <Command>
          <CommandInput placeholder="Buscar creator..." />
          <CommandList>
            <CommandEmpty>Nenhum creator encontrado.</CommandEmpty>
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
              {creators.map((creator) => (
                <CommandItem
                  key={creator.id}
                  value={creator.full_name}
                  onSelect={() => toggleCreator(creator.id)}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      selected.includes(creator.id)
                        ? "opacity-100"
                        : "opacity-0",
                    )}
                  />
                  {creator.full_name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
