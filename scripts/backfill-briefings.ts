/* eslint-disable no-console */
import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import Papa from "papaparse";
import { createClient } from "@supabase/supabase-js";

type Args = {
  brand: string;
  inputDir: string;
  apiUrl?: string;
  serviceRoleKey?: string;
  revalidateUrl?: string;
  revalidateSecret?: string;
};

function parseCli(): Args {
  const { values } = parseArgs({
    options: {
      brand: { type: "string", short: "b" },
      "input-dir": { type: "string", short: "i" },
      "api-url": { type: "string" },
      "service-role-key": { type: "string" },
      "revalidate-url": { type: "string" },
      "revalidate-secret": { type: "string" },
    },
  });
  if (!values.brand) throw new Error("--brand=<id> is required");
  if (!values["input-dir"]) throw new Error("--input-dir=<path> is required");
  return {
    brand: values.brand as string,
    inputDir: values["input-dir"] as string,
    apiUrl: (values["api-url"] as string) ?? process.env.NEXT_PUBLIC_SUPABASE_URL,
    serviceRoleKey:
      (values["service-role-key"] as string) ??
      process.env.SUPABASE_SERVICE_ROLE_KEY,
    revalidateUrl: (values["revalidate-url"] as string) ?? process.env.NEXT_APP_URL,
    revalidateSecret:
      (values["revalidate-secret"] as string) ?? process.env.REVALIDATE_SECRET,
  };
}

function readCsv<T>(filepath: string): T[] {
  const txt = fs.readFileSync(filepath, "utf8");
  const result = Papa.parse<T>(txt, { header: true, skipEmptyLines: true });
  if (result.errors.length > 0) {
    console.warn(`CSV parse warnings for ${filepath}:`, result.errors.slice(0, 3));
  }
  return result.data;
}

function norm(s: string | null | undefined): string {
  return (s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/^@/, "")
    .trim();
}

async function main() {
  const args = parseCli();
  if (!args.apiUrl || !args.serviceRoleKey) {
    throw new Error(
      "Missing Supabase credentials. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in env, or pass --api-url and --service-role-key.",
    );
  }
  const brandId = Number(args.brand);
  if (!Number.isInteger(brandId) || brandId < 1) {
    throw new Error("--brand must be a positive integer");
  }

  const pautasCsv = path.join(args.inputDir, "apice-pautas.csv");
  const porPautaCsv = path.join(args.inputDir, "apice-por-pauta.csv");
  const legendaCsv = path.join(args.inputDir, "legenda-handles.csv");

  for (const f of [pautasCsv, porPautaCsv, legendaCsv]) {
    if (!fs.existsSync(f)) throw new Error(`File not found: ${f}`);
  }

  type PautaRow = Record<string, string>;
  const pautasRows = readCsv<PautaRow>(pautasCsv);
  const porPautaRows = readCsv<PautaRow>(porPautaCsv);
  const legendaRows = readCsv<PautaRow>(legendaCsv);

  // Build canonical name map from Legenda
  const handleToCanonical = new Map<string, string>();
  for (const row of legendaRows) {
    const nameKey = Object.keys(row).find((k) => /nome/i.test(k) && !/handle/i.test(k));
    const handleKey = Object.keys(row).find((k) => /handle|@|user|instagram/i.test(k));
    if (!nameKey || !handleKey) continue;
    const name = row[nameKey];
    const handle = row[handleKey];
    if (handle) handleToCanonical.set(norm(handle), norm(name || handle));
  }

  // Load creators table
  const supabase = createClient(args.apiUrl, args.serviceRoleKey);
  const { data: creators, error: cErr } = await supabase
    .from("creators")
    .select("id, full_name");
  if (cErr) throw new Error(`Failed to load creators: ${cErr.message}`);
  const fullNameToId = new Map<string, number>();
  for (const c of creators ?? []) {
    fullNameToId.set(norm(c.full_name), c.id);
  }

  // Build briefing map from "Apice - Pautas"
  type Briefing = {
    briefing_number: number;
    semana: number | null;
    mes: number | null;
    ano: number | null;
    ref_url: string | null;
    take_inicial: string | null;
    fala_inicial: string | null;
    headline: string | null;
    construcao: string | null;
    tempo_video: string | null;
    produtos: string[];
  };
  const briefingByNumber = new Map<number, Briefing>();
  for (const row of pautasRows) {
    const num = parseInt(row["Pauta"] ?? "", 10);
    if (!Number.isInteger(num) || num < 1) continue;
    briefingByNumber.set(num, {
      briefing_number: num,
      semana: parseIntOrNull(row["Semana"]),
      mes: parseIntOrNull(row["Mês"] ?? row["Mes"]),
      ano: parseIntOrNull(row["Ano"]),
      ref_url: row["Ref"]?.trim() || null,
      take_inicial: row["Take inicial"]?.trim() || null,
      fala_inicial: row["Fala inicial"]?.trim() || null,
      headline: row["Headline"]?.trim() || null,
      construcao: (row["Construção"] ?? row["Construcao"] ?? row["Conceito"])?.trim() || null,
      tempo_video: (row["Tempo de Vídeo"] ?? row["Tempo de Video"] ?? row["Tempo"])?.trim() || null,
      produtos: row["Produto"]
        ? [row["Produto"].trim()].filter(Boolean)
        : [],
    });
  }

  // Walk Por Pauta: filter to Entregou=0 (active), resolve creator
  type Assignment = {
    briefing_number: number;
    creator_id: number;
    variante: string | null;
  };
  const activeAssignments: Assignment[] = [];
  const unmatched: { row: PautaRow; reason: string }[] = [];

  for (const row of porPautaRows) {
    const entregou = (row["Entregou"] ?? row["Entregou?"] ?? "").trim();
    if (entregou !== "0" && entregou !== "") continue; // skip delivered rows

    const num = parseInt(row["Pauta"] ?? "", 10);
    if (!Number.isInteger(num) || num < 1) {
      unmatched.push({ row, reason: "invalid pauta number" });
      continue;
    }
    if (!briefingByNumber.has(num)) {
      unmatched.push({ row, reason: `briefing ${num} missing in pautas csv` });
      continue;
    }
    const creatorRaw = row["CREATORS"] ?? row["Creator"] ?? "";
    const candidate = norm(creatorRaw);
    const canonical = handleToCanonical.get(candidate) ?? candidate;
    const creatorId = fullNameToId.get(canonical);
    if (!creatorId) {
      unmatched.push({ row, reason: `unmatched creator: ${creatorRaw}` });
      continue;
    }
    activeAssignments.push({
      briefing_number: num,
      creator_id: creatorId,
      variante: (row["Variante"] ?? "").trim() || null,
    });
  }

  // Filter briefings: only keep ones with at least one active assignment
  const activeNumbers = new Set(activeAssignments.map((a) => a.briefing_number));
  const briefingsToInsert = Array.from(briefingByNumber.values())
    .filter((b) => activeNumbers.has(b.briefing_number))
    .map((b) => ({
      brand_id: brandId,
      briefing_number: b.briefing_number,
      semana: b.semana,
      mes: b.mes,
      ano: b.ano,
      ref_url: b.ref_url,
      take_inicial: b.take_inicial,
      fala_inicial: b.fala_inicial,
      headline: b.headline,
      construcao: b.construcao,
      tempo_video: b.tempo_video,
      produtos: b.produtos,
      source: "docs" as const,
      source_doc_id: "backfill",
      updated_at: new Date().toISOString(),
    }));

  console.log(`Briefings to upsert: ${briefingsToInsert.length}`);
  console.log(`Active assignments: ${activeAssignments.length}`);
  console.log(`Unmatched rows: ${unmatched.length}`);

  // Upsert briefings
  if (briefingsToInsert.length > 0) {
    const { error: bErr } = await supabase
      .from("briefings")
      .upsert(briefingsToInsert, { onConflict: "brand_id,briefing_number" });
    if (bErr) throw new Error(`Briefing upsert failed: ${bErr.message}`);
  }

  // Get IDs for upserted briefings
  const { data: insertedBriefings } = await supabase
    .from("briefings")
    .select("id, briefing_number")
    .eq("brand_id", brandId)
    .in(
      "briefing_number",
      briefingsToInsert.map((b) => b.briefing_number),
    );
  const numberToId = new Map<number, number>();
  for (const b of insertedBriefings ?? []) {
    numberToId.set(b.briefing_number, b.id);
  }

  // Insert assignments (idempotent via unique key on (briefing_id, creator_id))
  const assignmentRows = activeAssignments
    .map((a) => {
      const briefingId = numberToId.get(a.briefing_number);
      if (!briefingId) return null;
      return {
        briefing_id: briefingId,
        creator_id: a.creator_id,
        variante: a.variante,
        status: "pendente" as const,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r != null);

  if (assignmentRows.length > 0) {
    // Use upsert with ignoreDuplicates so re-runs don't break
    const { error: aErr } = await supabase
      .from("briefing_assignments")
      .upsert(assignmentRows, {
        onConflict: "briefing_id,creator_id",
        ignoreDuplicates: true,
      });
    if (aErr) throw new Error(`Assignment upsert failed: ${aErr.message}`);
  }

  // Write unmatched report
  if (unmatched.length > 0) {
    const csv = Papa.unparse(
      unmatched.map((u) => ({
        reason: u.reason,
        ...u.row,
      })),
    );
    const outPath = path.join(args.inputDir, "unmatched.csv");
    fs.writeFileSync(outPath, csv, "utf8");
    console.log(`Unmatched rows written to ${outPath}`);
  }

  // Trigger cache revalidation
  if (args.revalidateUrl && args.revalidateSecret) {
    try {
      await fetch(`${args.revalidateUrl}/api/revalidate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-revalidate-secret": args.revalidateSecret,
        },
        body: JSON.stringify({ tags: ["briefings"] }),
      });
      console.log("Revalidate dispatched");
    } catch (e) {
      console.error("Revalidate failed (non-fatal):", e);
    }
  }

  console.log("Backfill complete.");
}

function parseIntOrNull(v: string | undefined | null): number | null {
  if (v == null) return null;
  const trimmed = v.trim();
  if (trimmed === "") return null;
  const n = parseInt(trimmed, 10);
  return Number.isInteger(n) ? n : null;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
