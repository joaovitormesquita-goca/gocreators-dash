import { z } from "zod";

export const BRIEFING_STATUSES = [
  "pendente",
  "em_andamento",
  "concluido",
  "cancelado",
] as const;

export const BRIEFING_AGGREGATE_STATUSES = [
  "nao_alocada",
  "pendente",
  "em_andamento",
  "parcialmente_concluida",
  "concluida",
  "cancelada",
] as const;

export type BriefingStatus = (typeof BRIEFING_STATUSES)[number];
export type BriefingAggregateStatus = (typeof BRIEFING_AGGREGATE_STATUSES)[number];

export type Briefing = {
  id: number;
  brand_id: number;
  briefing_number: number;
  semana: number | null;
  mes: number | null;
  ano: number | null;
  ref_url: string | null;
  take_inicial: string | null;
  fala_inicial: string | null;
  conceito: string | null;
  produtos: string[];
  source: "docs" | "native";
  source_doc_id: string | null;
  created_at: string;
  updated_at: string;
};

export type BriefingWithStatus = Briefing & {
  assignment_count: number;
  pending_count: number;
  in_progress_count: number;
  completed_count: number;
  cancelled_count: number;
  aggregate_status: BriefingAggregateStatus;
};

export type BriefingAssignment = {
  id: number;
  briefing_id: number;
  creator_id: number;
  variante: string | null;
  status: BriefingStatus;
  delivered_url: string | null;
  assigned_at: string;
  assigned_by: string | null;
  updated_at: string;
  updated_by: string | null;
};

export type BriefingAssignmentWithCreator = BriefingAssignment & {
  creator_name: string;
};

export const assignCreatorsSchema = z.object({
  briefingId: z.number().int().positive(),
  creators: z
    .array(
      z.object({
        creatorId: z.number().int().positive(),
        variante: z.string().max(200).nullable().optional(),
      }),
    )
    .min(1, "Selecione ao menos um creator"),
});
export type AssignCreatorsInput = z.infer<typeof assignCreatorsSchema>;

export const updateAssignmentStatusSchema = z
  .object({
    assignmentId: z.number().int().positive(),
    status: z.enum(BRIEFING_STATUSES),
    deliveredUrl: z.string().url("URL inválida").nullable().optional(),
  })
  .refine(
    (data) =>
      data.status !== "concluido" ||
      (data.deliveredUrl != null && data.deliveredUrl.length > 0),
    {
      message: "URL da entrega é obrigatória ao marcar como Concluído",
      path: ["deliveredUrl"],
    },
  );
export type UpdateAssignmentStatusInput = z.infer<typeof updateAssignmentStatusSchema>;

export const removeAssignmentSchema = z.object({
  assignmentId: z.number().int().positive(),
});
export type RemoveAssignmentInput = z.infer<typeof removeAssignmentSchema>;
