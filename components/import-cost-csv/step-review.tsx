"use client";

import { useTransition } from "react";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ParsedCostRow } from "./types";
import type { BulkCostImportResult } from "@/lib/schemas/creator-cost";

type Props = {
  rows: ParsedCostRow[];
  month?: string;
  brandName: string;
  onImport: () => Promise<BulkCostImportResult>;
  onResult: (result: BulkCostImportResult) => void;
  onBack: () => void;
  showMonth?: boolean;
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function formatMonth(dateStr: string) {
  const date = new Date(dateStr);
  return date.toLocaleDateString("pt-BR", { month: "short", year: "numeric", timeZone: "UTC" });
}

export function StepReview({ rows, month, brandName, onImport, onResult, onBack, showMonth }: Props) {
  const [isPending, startTransition] = useTransition();

  const totalCost = rows.reduce((sum, r) => sum + r.cost, 0);

  function handleImport() {
    startTransition(async () => {
      const result = await onImport();
      onResult(result);
    });
  }

  return (
    <div className="space-y-4">
      <div className={`grid gap-3 ${showMonth ? "grid-cols-2" : "grid-cols-3"}`}>
        <div className="rounded-md border p-3 text-center">
          <p className="text-2xl font-bold">{rows.length}</p>
          <p className="text-xs text-muted-foreground">Custos a importar</p>
        </div>
        <div className="rounded-md border p-3 text-center">
          <p className="text-lg font-bold">{brandName}</p>
          <p className="text-xs text-muted-foreground">Brand</p>
        </div>
        {!showMonth && month && (
          <div className="rounded-md border p-3 text-center">
            <p className="text-lg font-bold">{formatMonth(month)}</p>
            <p className="text-xs text-muted-foreground">Mês</p>
          </div>
        )}
      </div>

      <div className="rounded-md bg-muted/50 p-3 text-sm">
        Total: <strong>{formatCurrency(totalCost)}</strong>
      </div>

      <div className="max-h-64 overflow-y-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Creator</TableHead>
              {showMonth && <TableHead>Mês</TableHead>}
              <TableHead className="text-right">Custo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, i) => (
              <TableRow key={i}>
                <TableCell>{row.creatorName}</TableCell>
                {showMonth && (
                  <TableCell>{row.month ? formatMonth(row.month) : "—"}</TableCell>
                )}
                <TableCell className="text-right">
                  {formatCurrency(row.cost)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack} disabled={isPending}>
          Voltar
        </Button>
        <Button onClick={handleImport} disabled={isPending}>
          {isPending ? "Importando..." : "Importar"}
        </Button>
      </div>
    </div>
  );
}
