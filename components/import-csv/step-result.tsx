"use client";

import { CheckCircle2, XCircle, AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { BulkImportResult } from "@/lib/schemas/csv-import";

type Props = {
  result: BulkImportResult;
  onClose: () => void;
};

export function StepResult({ result, onClose }: Props) {
  if (!result.success) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 rounded-md bg-destructive/10 p-4">
          <XCircle className="h-6 w-6 text-destructive shrink-0" />
          <div>
            <p className="font-medium text-destructive">Erro na importação</p>
            <p className="text-sm text-destructive/80">{result.error}</p>
          </div>
        </div>
        <div className="flex justify-end">
          <Button onClick={onClose}>Fechar</Button>
        </div>
      </div>
    );
  }

  const totalSuccess =
    result.createdCount + result.linkedCount + result.handleAddedCount;
  const hasErrors = result.errors.length > 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 rounded-md bg-green-50 p-4 dark:bg-green-950/20">
        <CheckCircle2 className="h-6 w-6 text-green-600 shrink-0" />
        <div>
          <p className="font-medium text-green-700 dark:text-green-400">
            Importação concluída
          </p>
          <p className="text-sm text-green-600 dark:text-green-500">
            {totalSuccess} operação(ões) realizada(s) com sucesso.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-md border p-3 text-center">
          <p className="text-2xl font-bold text-green-600">
            {result.createdCount}
          </p>
          <p className="text-xs text-muted-foreground">Creators criados</p>
        </div>
        <div className="rounded-md border p-3 text-center">
          <p className="text-2xl font-bold text-blue-600">
            {result.linkedCount}
          </p>
          <p className="text-xs text-muted-foreground">Vínculos criados</p>
        </div>
        <div className="rounded-md border p-3 text-center">
          <p className="text-2xl font-bold text-amber-600">
            {result.handleAddedCount}
          </p>
          <p className="text-xs text-muted-foreground">Handles adicionados</p>
        </div>
      </div>

      {hasErrors && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-amber-600">
            <AlertTriangle className="h-4 w-4" />
            <span>{result.errors.length} erro(s) parcial(is):</span>
          </div>
          <div className="max-h-32 overflow-y-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Creator</TableHead>
                  <TableHead>Erro</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.errors.map((err, i) => (
                  <TableRow key={i}>
                    <TableCell>{err.name}</TableCell>
                    <TableCell className="text-sm text-destructive">
                      {err.error}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <Button onClick={onClose}>Fechar</Button>
      </div>
    </div>
  );
}
