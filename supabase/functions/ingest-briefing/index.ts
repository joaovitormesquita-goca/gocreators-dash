import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import type {
  IngestBriefingPayload,
  IncomingBriefing,
  IngestError,
  IngestResponse,
} from "./types.ts";

const MAX_BATCH = 500;

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const expectedSecret = Deno.env.get("INGEST_BRIEFING_SECRET");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!expectedSecret || !supabaseUrl || !supabaseServiceRoleKey) {
    return json({ error: "Server is misconfigured" }, 500);
  }

  const providedSecret = req.headers.get("x-ingest-secret");
  if (!providedSecret || providedSecret !== expectedSecret) {
    return json({ error: "Unauthorized" }, 401);
  }

  let body: IngestBriefingPayload;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  if (!body || typeof body !== "object") {
    return json({ error: "Body must be an object" }, 400);
  }

  if (typeof body.brand_id !== "number" || !Number.isInteger(body.brand_id)) {
    return json({ error: "brand_id must be an integer" }, 400);
  }

  if (!Array.isArray(body.briefings)) {
    return json({ error: "briefings must be an array" }, 400);
  }

  if (body.briefings.length > MAX_BATCH) {
    return json(
      { error: `Batch too large (max ${MAX_BATCH})` },
      400,
    );
  }

  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

  const { data: brandRow } = await supabase
    .from("brands")
    .select("id")
    .eq("id", body.brand_id)
    .maybeSingle();

  if (!brandRow) {
    return json({ error: `Brand ${body.brand_id} not found` }, 400);
  }

  const errors: IngestError[] = [];
  const validRows: ReturnType<typeof toRow>[] = [];

  for (const incoming of body.briefings) {
    const validation = validateBriefing(incoming);
    if (validation.error) {
      errors.push({
        briefing_number:
          typeof incoming?.briefing_number === "number"
            ? incoming.briefing_number
            : null,
        reason: validation.error,
      });
      continue;
    }
    validRows.push(toRow(body.brand_id, body.source_doc_id ?? null, incoming));
  }

  let inserted = 0;
  let updated = 0;

  if (validRows.length > 0) {
    const numbers = validRows.map((r) => r.briefing_number);

    const { data: existing } = await supabase
      .from("briefings")
      .select("briefing_number")
      .eq("brand_id", body.brand_id)
      .in("briefing_number", numbers);

    const existingSet = new Set(
      (existing ?? []).map((row) => row.briefing_number),
    );

    const { error: upsertError } = await supabase
      .from("briefings")
      .upsert(validRows, { onConflict: "brand_id,briefing_number" });

    if (upsertError) {
      return json(
        { error: `Database error: ${upsertError.message}` },
        500,
      );
    }

    for (const row of validRows) {
      if (existingSet.has(row.briefing_number)) {
        updated++;
      } else {
        inserted++;
      }
    }
  }

  // Fire-and-forget cache invalidation. Failures are non-fatal.
  const nextAppUrl = Deno.env.get("NEXT_APP_URL");
  const revalidateSecret = Deno.env.get("REVALIDATE_SECRET");
  if (nextAppUrl && revalidateSecret) {
    try {
      await fetch(`${nextAppUrl}/api/revalidate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-revalidate-secret": revalidateSecret,
        },
        body: JSON.stringify({ tags: ["briefings"] }),
      });
    } catch (e) {
      console.error("Failed to revalidate Next.js cache:", e);
    }
  }

  const response: IngestResponse = {
    received: body.briefings.length,
    inserted,
    updated,
    errors,
  };
  return json(response, 200);
});

function validateBriefing(b: IncomingBriefing | null | undefined): {
  error: string | null;
} {
  if (!b || typeof b !== "object") return { error: "Briefing not an object" };
  if (typeof b.briefing_number !== "number" || !Number.isInteger(b.briefing_number) || b.briefing_number < 1) {
    return { error: "briefing_number must be a positive integer" };
  }
  if (b.mes != null && (typeof b.mes !== "number" || b.mes < 1 || b.mes > 12)) {
    return { error: "mes must be between 1 and 12" };
  }
  if (b.semana != null && (typeof b.semana !== "number" || !Number.isInteger(b.semana))) {
    return { error: "semana must be an integer" };
  }
  if (b.ano != null && (typeof b.ano !== "number" || !Number.isInteger(b.ano))) {
    return { error: "ano must be an integer" };
  }
  if (b.produtos != null && !Array.isArray(b.produtos)) {
    return { error: "produtos must be an array of strings" };
  }
  return { error: null };
}

function toRow(brandId: number, sourceDocId: string | null, b: IncomingBriefing) {
  return {
    brand_id: brandId,
    briefing_number: b.briefing_number,
    semana: b.semana ?? null,
    mes: b.mes ?? null,
    ano: b.ano ?? null,
    ref_url: b.ref_url ?? null,
    take_inicial: b.take_inicial ?? null,
    fala_inicial: b.fala_inicial ?? null,
    headline: b.headline ?? null,
    construcao: b.construcao ?? null,
    tempo_video: b.tempo_video ?? null,
    produtos: b.produtos ?? [],
    source: "docs",
    source_doc_id: sourceDocId,
    updated_at: new Date().toISOString(),
  };
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
