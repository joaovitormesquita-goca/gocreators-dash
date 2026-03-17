"use client";

import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import type { DateRange } from "react-day-picker";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export type DatePreset = {
  label: string;
  getRange: () => { from: Date; to: Date };
};

interface DatePeriodSelectorProps {
  presets: DatePreset[];
  value: { from: Date; to: Date };
  onChange: (range: { from: Date; to: Date }) => void;
  disabled?: boolean;
}

export function DatePeriodSelector({
  presets,
  value,
  onChange,
  disabled,
}: DatePeriodSelectorProps) {
  const [activePreset, setActivePreset] = useState<string | null>(
    presets[0]?.label ?? null,
  );
  const [customOpen, setCustomOpen] = useState(false);

  function handlePresetClick(preset: DatePreset) {
    setActivePreset(preset.label);
    onChange(preset.getRange());
  }

  function handleCustomRange(range: DateRange | undefined) {
    if (range?.from && range?.to) {
      setActivePreset(null);
      onChange({ from: range.from, to: range.to });
    }
  }

  const isCustomActive = activePreset === null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {presets.map((preset) => (
        <Button
          key={preset.label}
          variant={activePreset === preset.label ? "default" : "outline"}
          size="sm"
          onClick={() => handlePresetClick(preset)}
          disabled={disabled}
        >
          {preset.label}
        </Button>
      ))}
      <Popover open={customOpen} onOpenChange={setCustomOpen}>
        <PopoverTrigger asChild>
          <Button
            variant={isCustomActive ? "default" : "outline"}
            size="sm"
            disabled={disabled}
            className={cn("gap-1.5")}
          >
            <CalendarIcon className="h-4 w-4" />
            {isCustomActive
              ? `${format(value.from, "dd/MM/yy")} - ${format(value.to, "dd/MM/yy")}`
              : "Personalizado"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="range"
            selected={{ from: value.from, to: value.to }}
            onSelect={handleCustomRange}
            numberOfMonths={2}
            locale={ptBR}
            disabled={{ after: new Date() }}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
