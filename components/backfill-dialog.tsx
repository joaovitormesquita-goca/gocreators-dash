"use client";

import { useState, useCallback, useRef } from "react";
import { History, Loader2, CheckCircle2, XCircle, Circle, Pause } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { startBackfillChunk } from "@/app/dashboard/brands/actions";
import type { BackfillChunkResult } from "@/lib/schemas/backfill";

type ChunkStatus = "pending" | "running" | "success" | "error";

interface Chunk {
  dateFrom: string;
  dateTo: string;
  status: ChunkStatus;
  result?: BackfillChunkResult;
}

function generateMonthlyChunks(dateFrom: string, dateTo: string): Chunk[] {
  const chunks: Chunk[] = [];
  const start = new Date(dateFrom + "T00:00:00");
  const end = new Date(dateTo + "T00:00:00");

  let current = new Date(start.getFullYear(), start.getMonth(), 1);

  while (current < end) {
    const chunkStart = new Date(
      Math.max(current.getTime(), start.getTime()),
    );
    const nextMonth = new Date(current.getFullYear(), current.getMonth() + 1, 1);
    const chunkEnd = new Date(Math.min(nextMonth.getTime(), end.getTime()));

    if (chunkStart < chunkEnd) {
      chunks.push({
        dateFrom: formatDate(chunkStart),
        dateTo: formatDate(chunkEnd),
        status: "pending",
      });
    }

    current = nextMonth;
  }

  return chunks;
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function formatMonthLabel(dateFrom: string): string {
  const d = new Date(dateFrom + "T00:00:00");
  return d.toLocaleDateString("pt-BR", { month: "short", year: "numeric" });
}

interface BackfillDialogProps {
  adAccountId: number;
  adAccountName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BackfillDialog({
  adAccountId,
  adAccountName,
  open,
  onOpenChange,
}: BackfillDialogProps) {
  const [dateFrom, setDateFrom] = useState("2025-01-01");
  const [dateTo, setDateTo] = useState(formatDate(new Date()));
  const [chunks, setChunks] = useState<Chunk[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const cancelledRef = useRef(false);

  function handleGenerate() {
    setChunks(generateMonthlyChunks(dateFrom, dateTo));
    setHasStarted(false);
  }

  const runBackfill = useCallback(async () => {
    setIsRunning(true);
    setHasStarted(true);
    cancelledRef.current = false;

    let totalCreatives = 0;
    let totalMetrics = 0;
    let totalSpend = 0;
    let errorCount = 0;

    for (let i = 0; i < chunks.length; i++) {
      if (cancelledRef.current) break;

      const chunk = chunks[i];
      if (chunk.status === "success") continue;

      // Mark as running
      setChunks((prev) =>
        prev.map((c, idx) => (idx === i ? { ...c, status: "running" as ChunkStatus } : c)),
      );

      const response = await startBackfillChunk({
        adAccountId,
        dateFrom: chunk.dateFrom,
        dateTo: chunk.dateTo,
      });

      if (response.success) {
        const result = response.result;
        totalCreatives += result.creativesUpserted ?? 0;
        totalMetrics += result.metricsUpserted ?? 0;
        totalSpend += result.accountSpendUpserted ?? 0;

        if (result.status === "error") {
          errorCount++;
        }

        setChunks((prev) =>
          prev.map((c, idx) =>
            idx === i ? { ...c, status: result.status as ChunkStatus, result } : c,
          ),
        );
      } else {
        errorCount++;
        setChunks((prev) =>
          prev.map((c, idx) =>
            idx === i
              ? {
                  ...c,
                  status: "error" as ChunkStatus,
                  result: {
                    adAccountId,
                    dateFrom: chunk.dateFrom,
                    dateTo: chunk.dateTo,
                    status: "error",
                    error: response.error,
                  },
                }
              : c,
          ),
        );
      }
    }

    setIsRunning(false);

    if (cancelledRef.current) {
      toast.info("Backfill pausado.");
    } else if (errorCount > 0) {
      toast.error(`Backfill concluido com ${errorCount} erro(s).`);
    } else {
      toast.success(
        `Backfill concluido! ${totalCreatives} criativos, ${totalMetrics} metricas, ${totalSpend} dias de spend.`,
      );
    }
  }, [chunks, adAccountId]);

  function handlePause() {
    cancelledRef.current = true;
  }

  const completedCount = chunks.filter((c) => c.status === "success").length;
  const totalCount = chunks.length;
  const hasPending = chunks.some((c) => c.status === "pending" || c.status === "error");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Importar Historico</DialogTitle>
          <DialogDescription>
            Importar dados historicos do Metabase para a conta{" "}
            <strong>{adAccountName}</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
          {/* Date range inputs */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="backfill-from">Data inicio</Label>
              <Input
                id="backfill-from"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                disabled={isRunning}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="backfill-to">Data fim</Label>
              <Input
                id="backfill-to"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                disabled={isRunning}
              />
            </div>
          </div>

          {!hasStarted && (
            <Button variant="outline" onClick={handleGenerate} disabled={isRunning}>
              Gerar chunks mensais
            </Button>
          )}

          {/* Progress summary */}
          {chunks.length > 0 && (
            <div className="text-sm text-muted-foreground">
              {completedCount} de {totalCount} chunks concluidos
            </div>
          )}

          {/* Chunk list */}
          {chunks.length > 0 && (
            <div className="flex-1 overflow-y-auto space-y-1 min-h-0 max-h-[300px] pr-1">
              {chunks.map((chunk, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                >
                  <div className="flex items-center gap-2">
                    <ChunkStatusIcon status={chunk.status} />
                    <span className="font-medium">
                      {formatMonthLabel(chunk.dateFrom)}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      {chunk.dateFrom} - {chunk.dateTo}
                    </span>
                  </div>
                  <div>
                    {chunk.status === "success" && chunk.result && (
                      <span className="text-xs text-muted-foreground">
                        {chunk.result.metricsUpserted} metricas, {chunk.result.accountSpendUpserted} spend
                      </span>
                    )}
                    {chunk.status === "error" && chunk.result?.error && (
                      <span className="text-xs text-destructive truncate max-w-[150px] block">
                        {chunk.result.error}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isRunning}
          >
            Fechar
          </Button>
          {isRunning ? (
            <Button variant="destructive" onClick={handlePause}>
              <Pause className="mr-2 h-4 w-4" />
              Pausar
            </Button>
          ) : (
            <Button
              onClick={runBackfill}
              disabled={chunks.length === 0 || !hasPending}
            >
              <History className="mr-2 h-4 w-4" />
              {hasStarted ? "Retomar" : "Iniciar Backfill"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ChunkStatusIcon({ status }: { status: ChunkStatus }) {
  switch (status) {
    case "pending":
      return <Circle className="h-4 w-4 text-muted-foreground" />;
    case "running":
      return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
    case "success":
      return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    case "error":
      return <XCircle className="h-4 w-4 text-destructive" />;
  }
}
