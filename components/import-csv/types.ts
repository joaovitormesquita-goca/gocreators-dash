import type { CreatorWithBrands } from "@/app/dashboard/creators/list/actions";

export type ParsedCreator = {
  fullName: string;
  email: string;
  handle: string;
  startDate: string; // ISO YYYY-MM-DD
};

export type ResolvedCreator = ParsedCreator & (
  | { type: "new" }
  | { type: "existing"; creatorId: number; creatorName: string; existingAssignmentId?: number }
);

export type CreatorMatch = {
  parsed: ParsedCreator;
  bestMatch: CreatorWithBrands | null;
  similarity: number;
  decision: "new" | "existing";
  alreadyLinked: boolean; // true if existing creator is already linked to target brand
  existingAssignmentId?: number; // if already linked, the creator_brands.id
};
