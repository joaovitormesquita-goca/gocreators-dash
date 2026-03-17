import { z } from "zod";

export const backfillChunkSchema = z.object({
  adAccountId: z.number().int().positive("Conta de anúncio é obrigatória"),
  dateFrom: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Data deve estar no formato YYYY-MM-DD"),
  dateTo: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Data deve estar no formato YYYY-MM-DD"),
});

export type BackfillChunkInput = z.infer<typeof backfillChunkSchema>;

export type BackfillChunkResult = {
  adAccountId: number;
  dateFrom: string;
  dateTo: string;
  status: "pending" | "running" | "success" | "error";
  error?: string;
  creativesUpserted?: number;
  metricsUpserted?: number;
  accountSpendUpserted?: number;
};
