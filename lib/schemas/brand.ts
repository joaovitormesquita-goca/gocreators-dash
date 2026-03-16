import { z } from "zod";

export const createBrandSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório").max(200),
});

export type CreateBrandInput = z.infer<typeof createBrandSchema>;

export const editBrandSchema = z.object({
  brandId: z.number(),
  name: z.string().min(1, "Nome é obrigatório").max(200),
});

export type EditBrandInput = z.infer<typeof editBrandSchema>;

export const createAdAccountSchema = z.object({
  brandId: z.number(),
  name: z.string().min(1, "Nome é obrigatório").max(200),
  metaAccountId: z.string().min(1, "ID da conta Meta é obrigatório"),
});

export type CreateAdAccountInput = z.infer<typeof createAdAccountSchema>;

export const editAdAccountSchema = z.object({
  adAccountId: z.number(),
  name: z.string().min(1, "Nome é obrigatório").max(200),
  metaAccountId: z.string().min(1, "ID da conta Meta é obrigatório"),
});

export type EditAdAccountInput = z.infer<typeof editAdAccountSchema>;
