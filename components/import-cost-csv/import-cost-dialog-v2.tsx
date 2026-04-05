"use client";

import { useState, useEffect, useTransition, useMemo } from "react";
import { Upload, Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getCreatorsForBrand,
  exportCostCsvFromMatrix,
  importCreatorCostsWithMonth,
  type CreatorForBrand,
} from "@/app/dashboard/costs/actions";
import type { BulkCostImportResult } from "@/lib/schemas/creator-cost";
import { CreatorMultiSelect, type CreatorOption } from "@/components/creator-multi-select";
import { MonthMultiSelect } from "@/components/month-multi-select";
import { toast } from "sonner";

import { StepUpload } from "./step-upload";
import { StepReview } from "./step-review";
import { StepResult } from "./step-result";
import type { ParsedCostRow } from "./types";

type Brand = { id: number; name: string };

type Props = {
  brands: Brand[];
  onSuccess: () => void;
};

function generateMonthRange(from: string, to: string): string[] {
  const months: string[] = [];
  const start = new Date(from);
  const end = new Date(to);
  const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  const endMonth = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1));

  while (cursor <= endMonth) {
    months.push(cursor.toISOString().substring(0, 10));
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return months;
}

const STEP_TITLES: Record<number, string> = {
  1: "Selecionar Brand, Creators e Meses",
  2: "Gerar CSV Base e Upload",
  3: "Revisão",
  4: "Resultado",
};

export function ImportCostDialogV2({ brands, onSuccess }: Props) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);

  // Step 1 state
  const [selectedBrandId, setSelectedBrandId] = useState<number | null>(null);
  const [creators, setCreators] = useState<CreatorForBrand[]>([]);
  const [selectedCreatorIds, setSelectedCreatorIds] = useState<number[]>([]);
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);
  const [isLoadingCreators, startLoadingCreators] = useTransition();

  // Step 2 state
  const [isExporting, startExport] = useTransition();
  const [parsedRows, setParsedRows] = useState<ParsedCostRow[]>([]);

  // Step 3/4 state
  const [result, setResult] = useState<BulkCostImportResult | null>(null);

  // Creator brand map for upload validation
  const creatorBrandMap = useMemo(() => {
    const map = new Map<string, number>();
    creators.forEach((c) => {
      map.set(c.creatorName.toLowerCase(), c.creatorBrandId);
    });
    return map;
  }, [creators]);

  const brandName = useMemo(() => {
    return brands.find((b) => b.id === selectedBrandId)?.name ?? "";
  }, [brands, selectedBrandId]);

  // Creator options for multi-select
  const creatorOptions: CreatorOption[] = useMemo(() => {
    return creators.map((c) => ({ id: c.creatorBrandId, full_name: c.creatorName }));
  }, [creators]);

  // Available months based on selected creators
  const availableMonths = useMemo(() => {
    const selectedCreators = selectedCreatorIds.length > 0
      ? creators.filter((c) => selectedCreatorIds.includes(c.creatorBrandId))
      : creators;

    if (selectedCreators.length === 0) return [];

    const today = new Date().toISOString().substring(0, 10);
    const earliest = selectedCreators.reduce((min, c) => (c.startDate < min ? c.startDate : min), selectedCreators[0].startDate);
    const latest = selectedCreators.reduce((max, c) => {
      const end = c.endDate ?? today;
      return end > max ? end : max;
    }, selectedCreators[0].endDate ?? today);

    return generateMonthRange(earliest, latest);
  }, [creators, selectedCreatorIds]);

  // Load creators when brand changes
  useEffect(() => {
    if (open && selectedBrandId) {
      setSelectedCreatorIds([]);
      setSelectedMonths([]);
      startLoadingCreators(async () => {
        const data = await getCreatorsForBrand(selectedBrandId);
        setCreators(data);
      });
    }
  }, [open, selectedBrandId]);

  function reset() {
    setStep(1);
    setSelectedBrandId(null);
    setCreators([]);
    setSelectedCreatorIds([]);
    setSelectedMonths([]);
    setParsedRows([]);
    setResult(null);
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) reset();
  }

  function handleExportCsv() {
    if (!selectedBrandId) return;

    const sortedMonths = [...selectedMonths].sort();
    const monthFrom = sortedMonths[0];
    const monthTo = sortedMonths[sortedMonths.length - 1];
    const creatorBrandIds = selectedCreatorIds.length > 0 ? selectedCreatorIds : undefined;

    startExport(async () => {
      const result = await exportCostCsvFromMatrix(
        selectedBrandId,
        monthFrom,
        monthTo,
        creatorBrandIds,
      );
      if (!result.success) {
        toast.error(result.error);
        return;
      }

      // Filter CSV rows to only include selected months if not all selected
      // The server returns all months in range, so we filter client-side
      const lines = result.csv.split("\n");
      const header = lines[0];
      const dataLines = selectedMonths.length > 0
        ? lines.slice(1).filter((line) => {
            const monthMatch = line.match(/^"[^"]*","(\d{4}-\d{2})"/);
            if (!monthMatch) return false;
            return selectedMonths.some((m) => m.startsWith(monthMatch[1]));
          })
        : lines.slice(1);

      const csv = [header, ...dataLines].join("\n");

      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `custos-creators-base.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("CSV base exportado");
    });
  }

  function handleUploadNext(rows: ParsedCostRow[]) {
    setParsedRows(rows);
    setStep(3);
  }

  async function handleImport(): Promise<BulkCostImportResult> {
    if (!selectedBrandId) return { success: false, error: "Brand não selecionada" };

    return importCreatorCostsWithMonth({
      brandId: selectedBrandId,
      costs: parsedRows
        .filter((r) => r.creatorBrandId != null && r.month)
        .map((r) => ({
          creatorBrandId: r.creatorBrandId!,
          month: `${r.month!}-01`,
          cost: r.cost,
        })),
    });
  }

  function handleResult(importResult: BulkCostImportResult) {
    setResult(importResult);
    setStep(4);
  }

  function handleClose() {
    setOpen(false);
    reset();
    if (result?.success) onSuccess();
  }

  const canProceedStep1 = selectedBrandId != null && !isLoadingCreators;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <Upload className="h-4 w-4 mr-2" />
          Importar Custos
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{STEP_TITLES[step]}</DialogTitle>
          <DialogDescription>
            Etapa {step} de 4 — Importação de custos via CSV
          </DialogDescription>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Brand</label>
              <Select
                value={selectedBrandId?.toString() ?? ""}
                onValueChange={(v) => setSelectedBrandId(Number(v))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma brand" />
                </SelectTrigger>
                <SelectContent>
                  {brands.map((b) => (
                    <SelectItem key={b.id} value={b.id.toString()}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedBrandId && !isLoadingCreators && creators.length > 0 && (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Creators</label>
                  <CreatorMultiSelect
                    creators={creatorOptions}
                    selected={selectedCreatorIds}
                    onSelectionChange={setSelectedCreatorIds}
                  />
                  <p className="text-xs text-muted-foreground">
                    {selectedCreatorIds.length === 0
                      ? `Todos os ${creators.length} creators serão incluídos`
                      : `${selectedCreatorIds.length} creator(s) selecionado(s)`}
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Meses</label>
                  <MonthMultiSelect
                    months={availableMonths}
                    selected={selectedMonths}
                    onSelectionChange={setSelectedMonths}
                  />
                  <p className="text-xs text-muted-foreground">
                    {selectedMonths.length === 0
                      ? `Todos os ${availableMonths.length} meses serão incluídos`
                      : `${selectedMonths.length} mês(es) selecionado(s)`}
                  </p>
                </div>
              </>
            )}

            {isLoadingCreators && (
              <p className="text-sm text-muted-foreground">Carregando creators...</p>
            )}

            <div className="flex justify-end">
              <Button disabled={!canProceedStep1} onClick={() => setStep(2)}>
                Próximo
              </Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <div className="rounded-md border p-4 space-y-3">
              <p className="text-sm font-medium">1. Baixe o CSV base</p>
              <p className="text-xs text-muted-foreground">
                O CSV será gerado com as colunas: creator_name, month, brand_name, cost.
                Preencha a coluna cost e faça upload abaixo.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportCsv}
                disabled={isExporting}
              >
                <Download className="h-4 w-4 mr-1" />
                {isExporting ? "Gerando..." : "Baixar CSV Base"}
              </Button>
            </div>

            <div className="rounded-md border p-4 space-y-3">
              <p className="text-sm font-medium">2. Faça upload do CSV preenchido</p>
              <StepUpload
                creatorBrandMap={creatorBrandMap}
                brandName={brandName}
                onNext={handleUploadNext}
                includeMonth
              />
            </div>
          </div>
        )}

        {step === 3 && (
          <StepReview
            rows={parsedRows}
            brandName={brandName}
            onImport={handleImport}
            onResult={handleResult}
            onBack={() => setStep(2)}
            showMonth
          />
        )}

        {step === 4 && result && (
          <StepResult result={result} onClose={handleClose} />
        )}
      </DialogContent>
    </Dialog>
  );
}
