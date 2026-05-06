import { unstable_cache } from "next/cache";
import { createStaticClient } from "@/lib/supabase/static";
import { CACHE_TAGS } from "@/lib/cache-tags";
import type {
  BriefingWithStatus,
  BriefingAssignmentWithCreator,
} from "@/lib/schemas/briefing";

export type BriefingFilters = {
  status?: string[];        // aggregate_status values
  mes?: number | null;
  ano?: number | null;
  q?: string | null;        // search across briefing_number, take_inicial, fala_inicial
};

const _getBriefingsCached = unstable_cache(
  async (
    brandId: number,
    statuses: string[] | null,
    mes: number | null,
    ano: number | null,
    q: string | null,
  ): Promise<BriefingWithStatus[]> => {
    const supabase = createStaticClient();
    let query = supabase
      .from("briefing_with_status")
      .select("*")
      .eq("brand_id", brandId);

    if (statuses && statuses.length > 0) {
      query = query.in("aggregate_status", statuses);
    }
    if (typeof mes === "number") {
      query = query.eq("mes", mes);
    }
    if (typeof ano === "number") {
      query = query.eq("ano", ano);
    }
    if (q && q.length > 0) {
      const numeric = Number(q);
      if (Number.isInteger(numeric) && numeric > 0) {
        query = query.eq("briefing_number", numeric);
      } else {
        query = query.or(
          `take_inicial.ilike.%${q}%,fala_inicial.ilike.%${q}%`,
        );
      }
    }

    const { data, error } = await query.order("briefing_number", {
      ascending: false,
    });
    if (error) throw new Error(error.message);
    return (data ?? []) as BriefingWithStatus[];
  },
  ["briefings-list"],
  { tags: [CACHE_TAGS.BRIEFINGS, CACHE_TAGS.BRANDS] },
);

export async function getBriefings(
  brandId: number,
  filters: BriefingFilters = {},
): Promise<BriefingWithStatus[]> {
  return _getBriefingsCached(
    brandId,
    filters.status && filters.status.length > 0 ? filters.status : null,
    typeof filters.mes === "number" ? filters.mes : null,
    typeof filters.ano === "number" ? filters.ano : null,
    filters.q ?? null,
  );
}

const _getBriefingDetailCached = unstable_cache(
  async (
    briefingId: number,
  ): Promise<{
    briefing: BriefingWithStatus;
    assignments: BriefingAssignmentWithCreator[];
  } | null> => {
    const supabase = createStaticClient();

    const { data: briefing, error: briefingError } = await supabase
      .from("briefing_with_status")
      .select("*")
      .eq("id", briefingId)
      .maybeSingle();
    if (briefingError) throw new Error(briefingError.message);
    if (!briefing) return null;

    const { data: assignments, error: assignmentsError } = await supabase
      .from("briefing_assignments")
      .select("*, creators(full_name)")
      .eq("briefing_id", briefingId)
      .order("assigned_at", { ascending: true });
    if (assignmentsError) throw new Error(assignmentsError.message);

    const mapped: BriefingAssignmentWithCreator[] = (assignments ?? []).map(
      (a) => ({
        id: a.id,
        briefing_id: a.briefing_id,
        creator_id: a.creator_id,
        variante: a.variante,
        status: a.status,
        delivered_url: a.delivered_url,
        assigned_at: a.assigned_at,
        assigned_by: a.assigned_by,
        updated_at: a.updated_at,
        updated_by: a.updated_by,
        creator_name:
          (a.creators as unknown as { full_name: string } | null)?.full_name ??
          "",
      }),
    );

    return {
      briefing: briefing as BriefingWithStatus,
      assignments: mapped,
    };
  },
  ["briefing-detail"],
  { tags: [CACHE_TAGS.BRIEFINGS] },
);

export async function getBriefingDetail(briefingId: number) {
  return _getBriefingDetailCached(briefingId);
}

const _getAllocatableCreatorsCached = unstable_cache(
  async (
    brandId: number,
  ): Promise<{ creatorId: number; creatorName: string }[]> => {
    const supabase = createStaticClient();
    const { data, error } = await supabase
      .from("creator_brands")
      .select("creator_id, creators(full_name)")
      .eq("brand_id", brandId)
      .order("creator_id");
    if (error) throw new Error(error.message);
    const seen = new Set<number>();
    const out: { creatorId: number; creatorName: string }[] = [];
    for (const row of data ?? []) {
      if (seen.has(row.creator_id)) continue;
      seen.add(row.creator_id);
      out.push({
        creatorId: row.creator_id,
        creatorName:
          (row.creators as unknown as { full_name: string } | null)
            ?.full_name ?? "",
      });
    }
    return out.sort((a, b) => a.creatorName.localeCompare(b.creatorName));
  },
  ["briefings-allocatable-creators"],
  { tags: [CACHE_TAGS.BRANDS] },
);

export async function getAllocatableCreators(brandId: number) {
  return _getAllocatableCreatorsCached(brandId);
}
