"use client";

import { useState, useEffect, useTransition } from "react";
import { Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { importCreatorCosts } from "@/app/dashboard/creators/actions";
import { getCreatorBrandsForBrand } from "@/app/dashboard/creators/actions";
import type { BulkCostImportResult } from "@/lib/schemas/creator-cost";

import { StepUpload } from "./step-upload";
import { StepReview } from "./step-review";
import { StepResult } from "./step-result";
import type { ParsedCostRow } from "./types";

type Props = {
  brandId: number;
  month: string | null;
  disabled?: boolean;
  onSuccess: () => void;
};

const STEP_TITLES: Record<number, string> = {
  1: "Upload do CSV de Custos",
  2: "Revisão",
  3: "Resultado",
};

export function ImportCostCsvDialog({ brandId, month, disabled, onSuccess }: Props) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [parsedRows, setParsedRows] = useState<ParsedCostRow[]>([]);
  const [result, setResult] = useState<BulkCostImportResult | null>(null);
  const [creatorBrandMap, setCreatorBrandMap] = useState<Map<string, number>>(new Map());
  const [brandName, setBrandName] = useState("");
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (open && brandId) {
      startTransition(async () => {
        const data = await getCreatorBrandsForBrand(brandId);
        const map = new Map<string, number>();
        data.forEach((cb) => {
          map.set(cb.creatorName.toLowerCase(), cb.creatorBrandId);
        });
        setCreatorBrandMap(map);
        setBrandName(data[0]?.brandName ?? "");
      });
    }
  }, [open, brandId]);

  function reset() {
    setStep(1);
    setParsedRows([]);
    setResult(null);
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) reset();
  }

  function handleStep1Next(rows: ParsedCostRow[]) {
    setParsedRows(rows);
    setStep(2);
  }

  async function handleImport(): Promise<BulkCostImportResult> {
    if (!month) return { success: false, error: "Mês não selecionado" };

    const monthDate = new Date(month);
    const monthStr = `${monthDate.getUTCFullYear()}-${String(monthDate.getUTCMonth() + 1).padStart(2, "0")}-01`;

    return importCreatorCosts({
      brandId,
      month: monthStr,
      costs: parsedRows
        .filter((r) => r.creatorBrandId != null)
        .map((r) => ({
          creatorBrandId: r.creatorBrandId!,
          cost: r.cost,
        })),
    });
  }

  function handleResult(importResult: BulkCostImportResult) {
    setResult(importResult);
    setStep(3);
  }

  function handleClose() {
    setOpen(false);
    reset();
    if (result?.success) onSuccess();
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled}>
          <Upload className="h-4 w-4 mr-1" />
          Importar Custos
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{STEP_TITLES[step]}</DialogTitle>
          <DialogDescription>
            Etapa {step} de 3 — Importação de custos via CSV
          </DialogDescription>
        </DialogHeader>

        {step === 1 && (
          <StepUpload
            creatorBrandMap={creatorBrandMap}
            brandName={brandName}
            onNext={handleStep1Next}
          />
        )}

        {step === 2 && month && (
          <StepReview
            rows={parsedRows}
            month={month}
            brandName={brandName}
            onImport={handleImport}
            onResult={handleResult}
            onBack={() => setStep(1)}
          />
        )}

        {step === 3 && result && (
          <StepResult result={result} onClose={handleClose} />
        )}
      </DialogContent>
    </Dialog>
  );
}
