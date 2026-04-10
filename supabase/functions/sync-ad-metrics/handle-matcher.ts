import type { CreatorBrand } from "./types.ts";

export function matchCreatorBrand(
  adName: string,
  creatorBrands: CreatorBrand[],
): number | null {
  const lower = adName.toLowerCase();
  for (const cb of creatorBrands) {
    for (const handle of cb.handles) {
      if (lower.includes(handle.toLowerCase())) {
        return cb.id;
      }
    }
  }
  return null;
}

export function extractGuidelineNumber(adName: string): number | null {
  const match = adName.match(/- pauta (\d+) -/i);
  return match ? parseInt(match[1], 10) : null;
}
