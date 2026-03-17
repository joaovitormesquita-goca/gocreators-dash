"use client";

import { useTransition } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { UserPlus, Link, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ResolvedCreator } from "./types";
import type { BulkImportInput, BulkImportResult } from "@/lib/schemas/csv-import";

type Props = {
  resolved: ResolvedCreator[];
  brandId: number;
  brandName: string;
  onImport: (input: BulkImportInput) => Promise<BulkImportResult>;
  onResult: (result: BulkImportResult) => void;
  onBack: () => void;
};

export function StepReview({
  resolved,
  brandId,
  brandName,
  onImport,
  onResult,
  onBack,
}: Props) {
  const [isPending, startTransition] = useTransition();

  const newCreators = resolved.filter((r) => r.type === "new");
  const existingLinks = resolved.filter((r) => r.type === "existing");
  const handleAdditions = existingLinks.filter(
    (r) => r.type === "existing" && r.existingAssignmentId,
  );
  const newLinks = existingLinks.filter(
    (r) => r.type === "existing" && !r.existingAssignmentId,
  );

  function handleImport() {
    const input: BulkImportInput = {
      brandId,
      newCreators: newCreators.map((c) => ({
        fullName: c.fullName,
        email: c.email,
        handle: c.handle,
        startDate: c.startDate,
      })),
      existingCreatorLinks: existingLinks
        .filter((c) => c.type === "existing")
        .map((c) => ({
          creatorId: c.creatorId,
          handle: c.handle,
          startDate: c.startDate,
          existingAssignmentId: c.existingAssignmentId,
        })),
    };

    startTransition(async () => {
      const result = await onImport(input);
      onResult(result);
    });
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-md border p-3 text-center">
          <p className="text-2xl font-bold">{resolved.length}</p>
          <p className="text-xs text-muted-foreground">Total</p>
        </div>
        <div className="rounded-md border p-3 text-center">
          <p className="text-2xl font-bold text-green-600">{newCreators.length}</p>
          <p className="text-xs text-muted-foreground">Novos creators</p>
        </div>
        <div className="rounded-md border p-3 text-center">
          <p className="text-2xl font-bold text-blue-600">{newLinks.length}</p>
          <p className="text-xs text-muted-foreground">Novos vínculos</p>
        </div>
        <div className="rounded-md border p-3 text-center">
          <p className="text-2xl font-bold text-amber-600">{handleAdditions.length}</p>
          <p className="text-xs text-muted-foreground">Handles adicionados</p>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        Marca: <span className="font-medium text-foreground">{brandName}</span>
      </p>

      <div className="max-h-[300px] overflow-y-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Handle</TableHead>
              <TableHead>Data Início</TableHead>
              <TableHead className="w-40">Ação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {resolved.map((r, i) => (
              <TableRow key={i}>
                <TableCell className="font-medium">{r.fullName}</TableCell>
                <TableCell className="font-mono text-sm">{r.handle}</TableCell>
                <TableCell>
                  {format(parseISO(r.startDate), "dd/MM/yyyy", { locale: ptBR })}
                </TableCell>
                <TableCell>
                  {r.type === "new" ? (
                    <Badge variant="outline" className="text-xs">
                      <UserPlus className="mr-1 h-3 w-3" />
                      Novo creator
                    </Badge>
                  ) : r.existingAssignmentId ? (
                    <Badge variant="secondary" className="text-xs text-amber-600">
                      <Plus className="mr-1 h-3 w-3" />
                      Add handle
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="text-xs text-blue-600">
                      <Link className="mr-1 h-3 w-3" />
                      Vincular
                    </Badge>
                  )}
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
