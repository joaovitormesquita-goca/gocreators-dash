"use client";

import { useRef, useState } from "react";
import Papa from "papaparse";
import { parse, isValid } from "date-fns";
import { Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { csvRowSchema } from "@/lib/schemas/csv-import";
import type { ParsedCreator } from "./types";

type Brand = { id: number; name: string };

type RowError = {
  row: number;
  field: string;
  message: string;
};

type Props = {
  brands: Brand[];
  onNext: (brandId: number, creators: ParsedCreator[]) => void;
};

const REQUIRED_COLUMNS = ["nome", "handle", "data_inicio"];
const MAX_ROWS = 100;

export function StepUpload({ brands, onNext }: Props) {
  const [brandId, setBrandId] = useState<string>("");
  const [fileName, setFileName] = useState<string>("");
  const [parsedCreators, setParsedCreators] = useState<ParsedCreator[]>([]);
  const [rowErrors, setRowErrors] = useState<RowError[]>([]);
  const [generalError, setGeneralError] = useState<string>("");
  const fileRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setRowErrors([]);
    setGeneralError("");
    setParsedCreators([]);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim().toLowerCase(),
      complete(results) {
        const headers = results.meta.fields ?? [];
        const missing = REQUIRED_COLUMNS.filter((c) => !headers.includes(c));
        if (missing.length > 0) {
          setGeneralError(
            `Colunas obrigatórias ausentes: ${missing.join(", ")}`,
          );
          return;
        }

        const rows = results.data as Record<string, string>[];
        if (rows.length === 0) {
          setGeneralError("Arquivo CSV vazio.");
          return;
        }
        if (rows.length > MAX_ROWS) {
          setGeneralError(
            `Máximo de ${MAX_ROWS} linhas permitido. Este arquivo tem ${rows.length} linhas.`,
          );
          return;
        }

        const errors: RowError[] = [];
        const creators: ParsedCreator[] = [];

        rows.forEach((row, i) => {
          const rowNum = i + 2; // header is row 1

          const zodResult = csvRowSchema.safeParse(row);
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

          const dateStr = row.data_inicio?.trim();
          const parsedDate = parse(dateStr, "dd/MM/yyyy", new Date());
          if (!isValid(parsedDate)) {
            errors.push({
              row: rowNum,
              field: "data_inicio",
              message: `Formato inválido "${dateStr}". Use DD/MM/AAAA.`,
            });
            return;
          }

          const isoDate = parsedDate.toISOString().split("T")[0];

          creators.push({
            fullName: row.nome.trim(),
            email: row.email?.trim() ?? "",
            handle: row.handle.trim(),
            startDate: isoDate,
          });
        });

        setRowErrors(errors);
        if (errors.length === 0) {
          setParsedCreators(creators);
        }
      },
      error(err) {
        setGeneralError(`Erro ao ler CSV: ${err.message}`);
      },
    });
  }

  const canAdvance = brandId && parsedCreators.length > 0 && rowErrors.length === 0;

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Marca</label>
          <Select value={brandId} onValueChange={setBrandId}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione a marca" />
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
              Colunas: nome, email, handle, data_inicio (DD/MM/AAAA)
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
                  <TableHead className="w-24">Campo</TableHead>
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

      {parsedCreators.length > 0 && rowErrors.length === 0 && (
        <div className="rounded-md bg-muted/50 p-3 text-sm">
          {parsedCreators.length} creator(s) encontrado(s) no arquivo.
        </div>
      )}

      <div className="flex justify-end">
        <Button
          disabled={!canAdvance}
          onClick={() => onNext(Number(brandId), parsedCreators)}
        >
          Próximo
        </Button>
      </div>
    </div>
  );
}
