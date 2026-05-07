"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { assignCreatorsToBriefing } from "@/app/dashboard/alocacao/actions";

type CreatorOption = { creatorId: number; creatorName: string };

type Pending = { creatorId: number; creatorName: string; variante: string };

export function BriefingAllocationForm({
  briefingId,
  creators,
  alreadyAllocatedCreatorIds,
  onSuccess,
}: {
  briefingId: number;
  creators: CreatorOption[];
  alreadyAllocatedCreatorIds: Set<number>;
  onSuccess: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<Pending[]>([]);
  const [isPending, startTransition] = useTransition();

  const available = creators.filter(
    (c) =>
      !alreadyAllocatedCreatorIds.has(c.creatorId) &&
      !pending.some((p) => p.creatorId === c.creatorId),
  );

  function add(c: CreatorOption) {
    setPending([...pending, { ...c, variante: "" }]);
    setOpen(false);
  }

  function remove(creatorId: number) {
    setPending(pending.filter((p) => p.creatorId !== creatorId));
  }

  function updateVariante(creatorId: number, variante: string) {
    setPending(
      pending.map((p) =>
        p.creatorId === creatorId ? { ...p, variante } : p,
      ),
    );
  }

  function submit() {
    if (pending.length === 0) return;
    startTransition(async () => {
      const result = await assignCreatorsToBriefing({
        briefingId,
        creators: pending.map((p) => ({
          creatorId: p.creatorId,
          variante: p.variante.trim() || null,
        })),
      });
      if (result.success) {
        toast.success(`${pending.length} alocaç${pending.length > 1 ? "ões" : "ão"} adicionada${pending.length > 1 ? "s" : ""}`);
        setPending([]);
        onSuccess();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold">Adicionar creators</h3>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            className="w-full justify-between"
          >
            Selecionar creator...
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
          <Command>
            <CommandInput placeholder="Buscar creator..." />
            <CommandList>
              <CommandEmpty>Nenhuma creator disponível.</CommandEmpty>
              <CommandGroup>
                {available.map((c) => (
                  <CommandItem
                    key={c.creatorId}
                    onSelect={() => add(c)}
                  >
                    <Check className={cn("mr-2 h-4 w-4 opacity-0")} />
                    {c.creatorName}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {pending.length > 0 ? (
        <div className="space-y-2">
          {pending.map((p) => (
            <div
              key={p.creatorId}
              className="flex items-center gap-2 rounded-md border p-2"
            >
              <span className="text-sm font-medium flex-shrink-0">
                {p.creatorName}
              </span>
              <Input
                placeholder="Variante (opcional)"
                value={p.variante}
                onChange={(e) => updateVariante(p.creatorId, e.target.value)}
                className="flex-1"
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => remove(p.creatorId)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button onClick={submit} disabled={isPending}>
            {isPending ? "Salvando..." : `Alocar ${pending.length} creator${pending.length > 1 ? "s" : ""}`}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
