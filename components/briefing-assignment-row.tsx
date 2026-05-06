"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { BriefingAssignmentBadge } from "@/components/briefing-status-badge";
import {
  updateAssignmentStatus,
  removeAssignment,
} from "@/app/dashboard/briefings/actions";
import {
  BRIEFING_STATUSES,
  type BriefingAssignmentWithCreator,
  type BriefingStatus,
} from "@/lib/schemas/briefing";

const STATUS_LABELS: Record<BriefingStatus, string> = {
  pendente: "Pendente",
  em_andamento: "Em andamento",
  concluido: "Concluído",
  cancelado: "Cancelado",
};

export function BriefingAssignmentRow({
  assignment,
  onChange,
}: {
  assignment: BriefingAssignmentWithCreator;
  onChange: () => void;
}) {
  const [status, setStatus] = useState<BriefingStatus>(assignment.status);
  const [deliveredUrl, setDeliveredUrl] = useState(
    assignment.delivered_url ?? "",
  );
  const [editingUrl, setEditingUrl] = useState(false);
  const [isPending, startTransition] = useTransition();

  function commit(newStatus: BriefingStatus, urlValue: string) {
    startTransition(async () => {
      const result = await updateAssignmentStatus({
        assignmentId: assignment.id,
        status: newStatus,
        deliveredUrl: newStatus === "concluido" ? urlValue || null : null,
      });
      if (result.success) {
        toast.success("Status atualizado");
        setEditingUrl(false);
        onChange();
      } else {
        toast.error(result.error);
        setStatus(assignment.status);
      }
    });
  }

  function handleStatusChange(value: string) {
    const newStatus = value as BriefingStatus;
    setStatus(newStatus);
    if (newStatus === "concluido" && !deliveredUrl) {
      setEditingUrl(true);
      return;
    }
    commit(newStatus, deliveredUrl);
  }

  function handleRemove() {
    if (
      !confirm(
        `Remover alocação de ${assignment.creator_name}? Só funciona em pendente/cancelado.`,
      )
    ) {
      return;
    }
    startTransition(async () => {
      const result = await removeAssignment({ assignmentId: assignment.id });
      if (result.success) {
        toast.success("Alocação removida");
        onChange();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-medium truncate">{assignment.creator_name}</span>
          {assignment.variante ? (
            <span className="text-xs text-muted-foreground truncate">
              ({assignment.variante})
            </span>
          ) : null}
        </div>
        <BriefingAssignmentBadge status={status} />
      </div>

      <div className="flex items-center gap-2">
        <Select
          value={status}
          onValueChange={handleStatusChange}
          disabled={isPending}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {BRIEFING_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {STATUS_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {editingUrl || (status === "concluido" && deliveredUrl) ? (
          <Input
            placeholder="URL da entrega"
            className="flex-1"
            value={deliveredUrl}
            onChange={(e) => setDeliveredUrl(e.target.value)}
            onBlur={() => {
              if (status === "concluido") commit(status, deliveredUrl);
            }}
          />
        ) : null}

        <Button
          variant="ghost"
          size="sm"
          onClick={handleRemove}
          disabled={isPending}
        >
          Remover
        </Button>
      </div>

      {status === "concluido" && deliveredUrl ? (
        <a
          href={deliveredUrl}
          target="_blank"
          rel="noreferrer"
          className="text-xs text-blue-600 hover:underline truncate"
        >
          {deliveredUrl}
        </a>
      ) : null}
    </div>
  );
}
