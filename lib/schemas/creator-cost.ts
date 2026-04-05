import { z } from "zod";

export const costCsvRowSchema = z.object({
  creator_name: z.string().min(1, "Nome do creator é obrigatório"),
  brand_name: z.string().min(1, "Nome da brand é obrigatório"),
  cost: z
    .string()
    .min(1, "Custo é obrigatório")
    .transform((v) => parseFloat(v.replace(",", ".")))
    .pipe(z.number().positive("Custo deve ser positivo")),
});

export type CostCsvRow = z.infer<typeof costCsvRowSchema>;

export const upsertCreatorCostSchema = z.object({
  creatorBrandId: z.number(),
  month: z.string().regex(/^\d{4}-\d{2}-01$/, "Mês deve ser primeiro dia do mês (YYYY-MM-01)"),
  cost: z.number().positive("Custo deve ser positivo"),
});

export type UpsertCreatorCostInput = z.infer<typeof upsertCreatorCostSchema>;

export const bulkCostImportSchema = z.object({
  brandId: z.number(),
  month: z.string(),
  costs: z.array(
    z.object({
      creatorBrandId: z.number(),
      cost: z.number().positive("Custo deve ser positivo"),
    }),
  ),
});

export type BulkCostImportInput = z.infer<typeof bulkCostImportSchema>;

export type BulkCostImportResult =
  | { success: true; importedCount: number }
  | { success: false; error: string };

export type UpsertCreatorCostResult =
  | { success: true }
  | { success: false; error: string };

// V2 schemas — CSV with month column per row

export const costCsvRowWithMonthSchema = z.object({
  creator_name: z.string().min(1, "Nome do creator é obrigatório"),
  month: z.string().min(1, "Mês é obrigatório"),
  brand_name: z.string().min(1, "Nome da brand é obrigatório"),
  cost: z
    .string()
    .min(1, "Custo é obrigatório")
    .transform((v) => parseFloat(v.replace(",", ".")))
    .pipe(z.number().positive("Custo deve ser positivo")),
});

export type CostCsvRowWithMonth = z.infer<typeof costCsvRowWithMonthSchema>;

export const bulkCostImportWithMonthSchema = z.object({
  brandId: z.number(),
  costs: z.array(
    z.object({
      creatorBrandId: z.number(),
      month: z.string().regex(/^\d{4}-\d{2}-01$/, "Mês deve ser primeiro dia do mês (YYYY-MM-01)"),
      cost: z.number().positive("Custo deve ser positivo"),
    }),
  ),
});

export type BulkCostImportWithMonthInput = z.infer<typeof bulkCostImportWithMonthSchema>;
