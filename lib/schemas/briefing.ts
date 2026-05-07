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
  headline: string | null;
  construcao: string | null;
  tempo_video: string | null;
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

// ============ Allocation schemas (existing) ============

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

// ============ Briefing CRUD schemas (NEW) ============

const optionalUrl = z
  .string()
  .url("URL inválida")
  .or(z.literal(""))
  .nullable()
  .optional()
  .transform((v) => (v === "" ? null : v));

export const briefingFormSchema = z.object({
  brand_id: z.number().int().positive("Marca obrigatória"),
  briefing_number: z.number().int().positive("Número deve ser positivo"),
  semana: z.number().int().min(1).max(53).nullable().optional(),
  mes: z.number().int().min(1).max(12).nullable().optional(),
  ano: z.number().int().min(2020).max(2050).nullable().optional(),
  ref_url: optionalUrl,
  take_inicial: z.string().max(2000).nullable().optional(),
  fala_inicial: z.string().max(2000).nullable().optional(),
  headline: z.string().max(500).nullable().optional(),
  construcao: z.string().max(5000).nullable().optional(),
  tempo_video: z.string().max(100).nullable().optional(),
  produtos: z.array(z.string().max(100)).max(20).default([]),
});
export type BriefingFormInput = z.infer<typeof briefingFormSchema>;

export const updateBriefingSchema = briefingFormSchema.extend({
  id: z.number().int().positive(),
});
export type UpdateBriefingInput = z.infer<typeof updateBriefingSchema>;

export const deleteBriefingSchema = z.object({
  id: z.number().int().positive(),
});
export type DeleteBriefingInput = z.infer<typeof deleteBriefingSchema>;
