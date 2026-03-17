import { z } from "zod";

export const csvRowSchema = z.object({
  nome: z.string().min(1, "Nome é obrigatório"),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  handle: z.string().min(1, "Handle é obrigatório"),
  data_inicio: z.string().min(1, "Data de início é obrigatória"),
});

export type CsvRow = z.infer<typeof csvRowSchema>;

export const bulkImportSchema = z.object({
  brandId: z.number(),
  newCreators: z.array(
    z.object({
      fullName: z.string().min(1),
      email: z.string().optional().or(z.literal("")),
      handle: z.string().min(1),
      startDate: z.string(),
    }),
  ),
  existingCreatorLinks: z.array(
    z.object({
      creatorId: z.number(),
      handle: z.string().min(1),
      startDate: z.string(),
      existingAssignmentId: z.number().optional(),
    }),
  ),
});

export type BulkImportInput = z.infer<typeof bulkImportSchema>;

export type BulkImportResult =
  | {
      success: true;
      createdCount: number;
      linkedCount: number;
      handleAddedCount: number;
      errors: Array<{ name: string; error: string }>;
    }
  | { success: false; error: string };
