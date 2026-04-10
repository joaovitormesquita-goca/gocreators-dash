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

// --- Creator Groups ---

export const createGroupSchema = z.object({
  brandId: z.number(),
  name: z.string().min(1, "Nome é obrigatório").max(100),
});

export type CreateGroupInput = z.infer<typeof createGroupSchema>;

export const editGroupSchema = z.object({
  groupId: z.number(),
  name: z.string().min(1, "Nome é obrigatório").max(100),
});

export type EditGroupInput = z.infer<typeof editGroupSchema>;

// --- Brand Goals ---

export const upsertBrandGoalSchema = z.object({
  brandId: z.number(),
  metric: z.enum(["share_total", "share_recent"]),
  month: z.string().regex(/^\d{4}-\d{2}-01$/, "Mês deve estar no formato YYYY-MM-01"),
  value: z.number().min(0, "Meta deve ser maior ou igual a 0").max(100, "Meta deve ser menor ou igual a 100"),
});

export type UpsertBrandGoalInput = z.infer<typeof upsertBrandGoalSchema>;

export const deleteBrandGoalSchema = z.object({
  goalId: z.string().uuid("ID inválido"),
});

export type DeleteBrandGoalInput = z.infer<typeof deleteBrandGoalSchema>;
