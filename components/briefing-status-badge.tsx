import { Badge } from "@/components/ui/badge";
import type {
  BriefingAggregateStatus,
  BriefingStatus,
} from "@/lib/schemas/briefing";

const AGG_LABELS: Record<BriefingAggregateStatus, string> = {
  nao_alocada: "Não alocada",
  pendente: "Pendente",
  em_andamento: "Em andamento",
  parcialmente_concluida: "Parcial",
  concluida: "Concluída",
  cancelada: "Cancelada",
};

const AGG_VARIANTS: Record<BriefingAggregateStatus, "default" | "secondary" | "destructive" | "outline"> = {
  nao_alocada: "outline",
  pendente: "secondary",
  em_andamento: "default",
  parcialmente_concluida: "default",
  concluida: "default",
  cancelada: "destructive",
};

const ASSIGNMENT_LABELS: Record<BriefingStatus, string> = {
  pendente: "Pendente",
  em_andamento: "Em andamento",
  concluido: "Concluído",
  cancelado: "Cancelado",
};

const ASSIGNMENT_VARIANTS: Record<BriefingStatus, "default" | "secondary" | "destructive" | "outline"> = {
  pendente: "secondary",
  em_andamento: "default",
  concluido: "default",
  cancelado: "destructive",
};

export function BriefingAggregateBadge({ status }: { status: BriefingAggregateStatus }) {
  return <Badge variant={AGG_VARIANTS[status]}>{AGG_LABELS[status]}</Badge>;
}

export function BriefingAssignmentBadge({ status }: { status: BriefingStatus }) {
  return <Badge variant={ASSIGNMENT_VARIANTS[status]}>{ASSIGNMENT_LABELS[status]}</Badge>;
}
