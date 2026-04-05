"use client";

import { CheckCircle2, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { BulkCostImportResult } from "@/lib/schemas/creator-cost";

type Props = {
  result: BulkCostImportResult;
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

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 rounded-md bg-green-50 p-4 dark:bg-green-950/20">
        <CheckCircle2 className="h-6 w-6 text-green-600 shrink-0" />
        <div>
          <p className="font-medium text-green-700 dark:text-green-400">
            Importação concluída
          </p>
          <p className="text-sm text-green-600 dark:text-green-500">
            {result.importedCount} custo(s) importado(s) com sucesso.
          </p>
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={onClose}>Fechar</Button>
      </div>
    </div>
  );
}
