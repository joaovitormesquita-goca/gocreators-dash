"use client";

import { useState } from "react";
import { Check, ChevronsUpDown, Package } from "lucide-react";

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

interface ProductMultiSelectProps {
  products: string[];
  selected: string[];
  onSelectionChange: (names: string[]) => void;
  disabled?: boolean;
  className?: string;
}

export function ProductMultiSelect({
  products,
  selected,
  onSelectionChange,
  disabled,
  className,
}: ProductMultiSelectProps) {
  const [open, setOpen] = useState(false);

  const allSelected = selected.length === products.length && products.length > 0;

  function toggleProduct(name: string) {
    if (selected.includes(name)) {
      onSelectionChange(selected.filter((s) => s !== name));
    } else {
      onSelectionChange([...selected, name]);
    }
  }

  function toggleAll() {
    if (allSelected || selected.length === 0) {
      onSelectionChange(allSelected ? [] : products);
    } else {
      onSelectionChange(products);
    }
  }

  const label =
    selected.length === 0 || allSelected
      ? "Todos os produtos"
      : selected.length === 1
        ? selected[0]
        : `${selected.length} produtos`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-[240px] justify-between", className)}
          disabled={disabled}
        >
          <Package className="mr-2 h-4 w-4 shrink-0 opacity-50" />
          <span className="truncate">{label}</span>
          <ChevronsUpDown className="ml-auto h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar produto..." />
          <CommandList>
            <CommandEmpty>Nenhum produto encontrado.</CommandEmpty>
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
              {products.map((name) => (
                <CommandItem
                  key={name}
                  value={name}
                  onSelect={() => toggleProduct(name)}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      selected.includes(name) ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <span className="truncate">{name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
