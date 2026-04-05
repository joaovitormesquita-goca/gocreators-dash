export type ParsedCostRow = {
  creatorName: string;
  brandName: string;
  cost: number;
  creatorBrandId: number | null;
  month?: string;
  error?: string;
};
