"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { BriefingAggregateBadge } from "@/components/briefing-status-badge";
import { BriefingDetailSheet } from "@/components/briefing-detail-sheet";
import type { BriefingWithStatus } from "@/lib/schemas/briefing";

type Brand = { id: number; name: string };

const STATUS_OPTIONS: {
  value: string;
  label: string;
  group: "ativo" | "concluido";
}[] = [
  { value: "nao_alocada", label: "Não alocada", group: "ativo" },
  { value: "pendente", label: "Pendente", group: "ativo" },
  { value: "em_andamento", label: "Em andamento", group: "ativo" },
  { value: "parcialmente_concluida", label: "Parcial", group: "ativo" },
  { value: "concluida", label: "Concluída", group: "concluido" },
  { value: "cancelada", label: "Cancelada", group: "concluido" },
];

export function BriefingManagementTable({
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
  const [openId, setOpenId] = useState<number | null>(null);

  const currentStatusFilter = searchParams.get("status") ?? "ativos";
  const currentMes = searchParams.get("mes") ?? "";
  const currentAno = searchParams.get("ano") ?? "";
  const currentQ = searchParams.get("q") ?? "";

  function updateParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (value == null || value === "") params.delete(key);
    else params.set(key, value);
    router.push(`?${params.toString()}`);
  }

  const filteredBriefings = useMemo(() => briefings, [briefings]);

  return (
    <div className="space-y-4">
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

        <Select
          value={currentStatusFilter}
          onValueChange={(v) => updateParam("status", v === "ativos" ? null : v)}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ativos">Ativos (default)</SelectItem>
            <SelectItem value="todos">Todos</SelectItem>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
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
          placeholder="Buscar (nº, take, fala)"
          className="w-[280px]"
          value={currentQ}
          onChange={(e) => updateParam("q", e.target.value || null)}
        />
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[80px]">Nº</TableHead>
            <TableHead>Take inicial</TableHead>
            <TableHead className="w-[160px]">Produto</TableHead>
            <TableHead className="w-[100px]">Sem/Mês</TableHead>
            <TableHead className="w-[140px]">Status</TableHead>
            <TableHead className="w-[100px] text-right">Alocados</TableHead>
            <TableHead className="w-[80px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredBriefings.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="py-12 text-center text-sm text-muted-foreground">
                Nenhuma pauta encontrada para os filtros atuais.
              </TableCell>
            </TableRow>
          ) : (
            filteredBriefings.map((b) => {
              const completedFraction = b.assignment_count > 0
                ? `${b.completed_count}/${b.assignment_count}`
                : "—";
              const semMes = [b.semana, b.mes].filter((v) => v != null).join("/");
              return (
                <TableRow
                  key={b.id}
                  className="cursor-pointer"
                  onClick={() => setOpenId(b.id)}
                >
                  <TableCell className="font-mono">{b.briefing_number}</TableCell>
                  <TableCell className="max-w-[280px] truncate">
                    {b.take_inicial ?? "—"}
                  </TableCell>
                  <TableCell className="max-w-[160px] truncate">
                    {b.produtos.length > 0 ? b.produtos.join(", ") : "—"}
                  </TableCell>
                  <TableCell>{semMes || "—"}</TableCell>
                  <TableCell>
                    <BriefingAggregateBadge status={b.aggregate_status} />
                  </TableCell>
                  <TableCell className="text-right">{completedFraction}</TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenId(b.id);
                      }}
                    >
                      Detalhes
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>

      <BriefingDetailSheet
        briefingId={openId}
        brandId={selectedBrandId}
        onOpenChange={(open) => {
          if (!open) setOpenId(null);
        }}
      />
    </div>
  );
}
