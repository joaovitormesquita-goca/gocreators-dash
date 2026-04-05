"use client";

import { useRef, useState } from "react";
import Papa from "papaparse";
import { Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { costCsvRowSchema, costCsvRowWithMonthSchema } from "@/lib/schemas/creator-cost";
import type { ParsedCostRow } from "./types";

type RowError = {
  row: number;
  field: string;
  message: string;
};

type Props = {
  creatorBrandMap: Map<string, number>;
  brandName: string;
  onNext: (rows: ParsedCostRow[]) => void;
  includeMonth?: boolean;
};

const REQUIRED_COLUMNS_BASE = ["creator_name", "brand_name", "cost"];
const REQUIRED_COLUMNS_WITH_MONTH = ["creator_name", "month", "brand_name", "cost"];
const MAX_ROWS = 200;

export function StepUpload({ creatorBrandMap, brandName, onNext, includeMonth }: Props) {
  const [fileName, setFileName] = useState("");
  const [parsedRows, setParsedRows] = useState<ParsedCostRow[]>([]);
  const [rowErrors, setRowErrors] = useState<RowError[]>([]);
  const [generalError, setGeneralError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setRowErrors([]);
    setGeneralError("");
    setParsedRows([]);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim().toLowerCase(),
      complete(results) {
        const headers = results.meta.fields ?? [];
        const requiredCols = includeMonth ? REQUIRED_COLUMNS_WITH_MONTH : REQUIRED_COLUMNS_BASE;
        const missing = requiredCols.filter((c) => !headers.includes(c));
        if (missing.length > 0) {
          setGeneralError(
            `Colunas obrigatórias ausentes: ${missing.join(", ")}`,
          );
          return;
        }

        const rawRows = results.data as Record<string, string>[];
        if (rawRows.length === 0) {
          setGeneralError("Arquivo CSV vazio.");
          return;
        }
        if (rawRows.length > MAX_ROWS) {
          setGeneralError(
            `Máximo de ${MAX_ROWS} linhas permitido. Este arquivo tem ${rawRows.length} linhas.`,
          );
          return;
        }

        const errors: RowError[] = [];
        const rows: ParsedCostRow[] = [];
        const schema = includeMonth ? costCsvRowWithMonthSchema : costCsvRowSchema;

        rawRows.forEach((row, i) => {
          const rowNum = i + 2;
          const costRaw = row.cost?.trim();

          // Skip rows with empty cost (as per business rule)
          if (!costRaw) return;

          const zodResult = schema.safeParse(row);
          if (!zodResult.success) {
            zodResult.error.issues.forEach((issue) => {
              errors.push({
                row: rowNum,
                field: String(issue.path[0] ?? ""),
                message: issue.message,
              });
            });
            return;
          }

          const creatorName = row.creator_name.trim();
          const lookupKey = creatorName.toLowerCase();
          const creatorBrandId = creatorBrandMap.get(lookupKey) ?? null;

          if (creatorBrandId == null) {
            errors.push({
              row: rowNum,
              field: "creator_name",
              message: `Creator "${creatorName}" não encontrado na brand "${brandName}"`,
            });
            return;
          }

          const monthRaw = includeMonth ? row.month?.trim() : undefined;
          if (includeMonth && !monthRaw) {
            errors.push({
              row: rowNum,
              field: "month",
              message: "Mês é obrigatório",
            });
            return;
          }

          rows.push({
            creatorName,
            brandName: row.brand_name.trim(),
            cost: zodResult.data.cost,
            creatorBrandId,
            ...(includeMonth && monthRaw ? { month: monthRaw } : {}),
          });
        });

        setRowErrors(errors);
        if (errors.length === 0) {
          setParsedRows(rows);
        }
      },
      error(err) {
        setGeneralError(`Erro ao ler CSV: ${err.message}`);
      },
    });
  }

  const canAdvance = parsedRows.length > 0 && rowErrors.length === 0;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <label className="text-sm font-medium">Arquivo CSV</label>
        <div
          className="flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-6 cursor-pointer hover:border-primary/50 transition-colors"
          onClick={() => fileRef.current?.click()}
        >
          <Upload className="h-8 w-8 text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">
            {fileName || "Clique para selecionar um arquivo .csv"}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Colunas: {includeMonth ? "creator_name, month, brand_name, cost" : "creator_name, brand_name, cost"}
          </p>
          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>
      </div>

      {generalError && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {generalError}
        </div>
      )}

      {rowErrors.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-destructive">
            {rowErrors.length} erro(s) encontrado(s):
          </p>
          <div className="max-h-48 overflow-y-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Linha</TableHead>
                  <TableHead className="w-28">Campo</TableHead>
                  <TableHead>Erro</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rowErrors.map((err, i) => (
                  <TableRow key={i}>
                    <TableCell>{err.row}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {err.field}
                    </TableCell>
                    <TableCell>{err.message}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {parsedRows.length > 0 && rowErrors.length === 0 && (
        <div className="rounded-md bg-muted/50 p-3 text-sm">
          {parsedRows.length} custo(s) encontrado(s) no arquivo.
        </div>
      )}

      <div className="flex justify-end">
        <Button disabled={!canAdvance} onClick={() => onNext(parsedRows)}>
          Próximo
        </Button>
      </div>
    </div>
  );
}
