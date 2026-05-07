"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Plus } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { BriefingContentCard } from "@/components/briefing-content-card";
import type { BriefingWithStatus } from "@/lib/schemas/briefing";

type Brand = { id: number; name: string };

export function BriefingsGrid({
  brands,
  selectedBrandId,
  briefings,
}: {
  brands: Brand[];
  selectedBrandId: number | null;
  briefings: BriefingWithStatus[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const currentMes = searchParams.get("mes") ?? "";
  const currentAno = searchParams.get("ano") ?? "";
  const currentQ = searchParams.get("q") ?? "";

  function updateParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (value == null || value === "") params.delete(key);
    else params.set(key, value);
    router.push(`?${params.toString()}`);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <Select
          value={selectedBrandId?.toString() ?? ""}
          onValueChange={(v) => updateParam("brand", v)}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Marca" />
          </SelectTrigger>
          <SelectContent>
            {brands.map((b) => (
              <SelectItem key={b.id} value={b.id.toString()}>
                {b.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input
          type="number"
          placeholder="Mês"
          className="w-[100px]"
          value={currentMes}
          onChange={(e) => updateParam("mes", e.target.value || null)}
          min={1}
          max={12}
        />
        <Input
          type="number"
          placeholder="Ano"
          className="w-[120px]"
          value={currentAno}
          onChange={(e) => updateParam("ano", e.target.value || null)}
        />
        <Input
          placeholder="Buscar (nº, headline, take, fala)"
          className="w-[300px]"
          value={currentQ}
          onChange={(e) => updateParam("q", e.target.value || null)}
        />

        <div className="ml-auto">
          <Button asChild>
            <Link
              href={
                selectedBrandId
                  ? `/dashboard/briefings/new?brand=${selectedBrandId}`
                  : "/dashboard/briefings/new"
              }
            >
              <Plus className="h-4 w-4 mr-1" />
              Nova pauta
            </Link>
          </Button>
        </div>
      </div>

      {briefings.length === 0 ? (
        <div className="rounded-lg border border-dashed p-16 text-center">
          <p className="text-sm text-muted-foreground">
            Nenhuma pauta encontrada para os filtros atuais.
          </p>
          <Button asChild variant="link" className="mt-2">
            <Link
              href={
                selectedBrandId
                  ? `/dashboard/briefings/new?brand=${selectedBrandId}`
                  : "/dashboard/briefings/new"
              }
            >
              Criar a primeira →
            </Link>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {briefings.map((b) => (
            <BriefingContentCard key={b.id} briefing={b} />
          ))}
        </div>
      )}
    </div>
  );
}
