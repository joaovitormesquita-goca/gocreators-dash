"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { AlertCircle } from "lucide-react";
import type { SyncLog } from "@/app/dashboard/sync/actions";

function formatDateTime(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(startedAt: string, finishedAt: string | null): string {
  if (!finishedAt) return "—";
  const ms = new Date(finishedAt).getTime() - new Date(startedAt).getTime();
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) return `${seconds}s`;
  return `${minutes}m ${seconds}s`;
}

function StatusBadge({ status }: { status: SyncLog["status"] }) {
  const variants: Record<SyncLog["status"], { label: string; className: string }> = {
    running: {
      label: "Em execução",
      className: "bg-yellow-100 text-yellow-800 hover:bg-yellow-100",
    },
    success: {
      label: "Sucesso",
      className: "bg-green-100 text-green-800 hover:bg-green-100",
    },
    error: {
      label: "Erro",
      className: "bg-red-100 text-red-800 hover:bg-red-100",
    },
  };

  const { label, className } = variants[status];
  return (
    <Badge variant="secondary" className={className}>
      {label}
    </Badge>
  );
}

function TriggerBadge({ trigger }: { trigger: SyncLog["trigger"] }) {
  return (
    <Badge variant="outline">
      {trigger === "manual" ? "Manual" : "Agendado"}
    </Badge>
  );
}

export function SyncHistoryTable({ logs }: { logs: SyncLog[] }) {
  if (logs.length === 0) {
    return (
      <div className="flex items-center justify-center rounded-md border border-dashed p-8">
        <p className="text-sm text-muted-foreground">
          Nenhuma sincronização registrada.
        </p>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data/Hora</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Duração</TableHead>
              <TableHead className="text-right">Criativos</TableHead>
              <TableHead className="text-right">Métricas</TableHead>
              <TableHead className="text-right">Gastos</TableHead>
              <TableHead className="text-right">Não casados</TableHead>
              <TableHead>Gatilho</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.map((log) => (
              <TableRow key={log.id}>
                <TableCell className="whitespace-nowrap">
                  {formatDateTime(log.started_at)}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5">
                    <StatusBadge status={log.status} />
                    {log.status === "error" && log.error_message && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <AlertCircle className="h-4 w-4 text-red-500 cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent
                          side="right"
                          className="max-w-xs text-xs"
                        >
                          {log.error_message}
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  {formatDuration(log.started_at, log.finished_at)}
                </TableCell>
                <TableCell className="text-right">
                  {log.creatives_upserted}
                </TableCell>
                <TableCell className="text-right">
                  {log.metrics_upserted}
                </TableCell>
                <TableCell className="text-right">
                  {log.account_spend_upserted}
                </TableCell>
                <TableCell className="text-right">
                  {log.unmatched_ads}
                </TableCell>
                <TableCell>
                  <TriggerBadge trigger={log.trigger} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </TooltipProvider>
  );
}
