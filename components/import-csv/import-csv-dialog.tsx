"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileUp } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { bulkImportCreators } from "@/app/dashboard/creators/list/actions";
import type { CreatorWithBrands } from "@/app/dashboard/creators/list/actions";
import type { BulkImportResult } from "@/lib/schemas/csv-import";

import { StepUpload } from "./step-upload";
import { StepMatchCreators } from "./step-match-creators";
import { StepReview } from "./step-review";
import { StepResult } from "./step-result";
import type { ParsedCreator, ResolvedCreator } from "./types";

type Brand = { id: number; name: string };

type Props = {
  brands: Brand[];
  existingCreators: CreatorWithBrands[];
};

const STEP_TITLES: Record<number, string> = {
  1: "Upload do CSV",
  2: "Verificação de Duplicatas",
  3: "Revisão",
  4: "Resultado",
};

export function ImportCsvDialog({ brands, existingCreators }: Props) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [brandId, setBrandId] = useState<number | null>(null);
  const [parsedCreators, setParsedCreators] = useState<ParsedCreator[]>([]);
  const [resolvedCreators, setResolvedCreators] = useState<ResolvedCreator[]>([]);
  const [result, setResult] = useState<BulkImportResult | null>(null);
  const router = useRouter();

  function reset() {
    setStep(1);
    setBrandId(null);
    setParsedCreators([]);
    setResolvedCreators([]);
    setResult(null);
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) reset();
  }

  function handleStep1Next(selectedBrandId: number, creators: ParsedCreator[]) {
    setBrandId(selectedBrandId);
    setParsedCreators(creators);
    setStep(2);
  }

  function handleStep2Next(resolved: ResolvedCreator[]) {
    setResolvedCreators(resolved);
    setStep(3);
  }

  function handleResult(importResult: BulkImportResult) {
    setResult(importResult);
    setStep(4);
  }

  function handleClose() {
    setOpen(false);
    reset();
    router.refresh();
  }

  const brandName =
    brands.find((b) => b.id === brandId)?.name ?? "";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <FileUp className="mr-2 h-4 w-4" />
          Importar CSV
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{STEP_TITLES[step]}</DialogTitle>
          <DialogDescription>
            Etapa {step} de 4 — Importação de creators via CSV
          </DialogDescription>
        </DialogHeader>

        {step === 1 && (
          <StepUpload brands={brands} onNext={handleStep1Next} />
        )}

        {step === 2 && brandId && (
          <StepMatchCreators
            parsedCreators={parsedCreators}
            existingCreators={existingCreators}
            brandId={brandId}
            onNext={handleStep2Next}
            onBack={() => setStep(1)}
          />
        )}

        {step === 3 && brandId && (
          <StepReview
            resolved={resolvedCreators}
            brandId={brandId}
            brandName={brandName}
            onImport={bulkImportCreators}
            onResult={handleResult}
            onBack={() => setStep(2)}
          />
        )}

        {step === 4 && result && (
          <StepResult result={result} onClose={handleClose} />
        )}
      </DialogContent>
    </Dialog>
  );
}
