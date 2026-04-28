import { z } from "zod";

export const spendViewFiltersSchema = z.object({
  brandId: z.number().positive("Selecione uma marca"),
  creatorIds: z.array(z.number()).optional(),
  startDate: z.string().date("Data inicial inválida"),
  endDate: z.string().date("Data final inválida"),
  productNames: z.array(z.string()).optional(),
});

export type SpendViewFilters = z.infer<typeof spendViewFiltersSchema>;
