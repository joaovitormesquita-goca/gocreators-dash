import { z } from "zod";

export const brandAssignmentSchema = z.object({
  brandId: z.string().min(1, "Selecione uma marca"),
  handles: z.string().min(1, "Informe ao menos um handle"),
  startDate: z.date({ error: "Selecione a data de início" }),
});

export const createCreatorSchema = z.object({
  fullName: z.string().min(1, "Nome é obrigatório").max(200),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  brandAssignments: z
    .array(brandAssignmentSchema)
    .min(1, "Vincule ao menos uma marca"),
});

export type CreateCreatorInput = z.infer<typeof createCreatorSchema>;
