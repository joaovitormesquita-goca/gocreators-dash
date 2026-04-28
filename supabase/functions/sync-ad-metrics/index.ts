import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { MetabaseClient } from "./metabase-client.ts";
import { matchCreatorBrand, extractGuidelineNumber, extractProductName } from "./handle-matcher.ts";
import { buildMetabaseQuery, buildAccountSpendQuery } from "./queries.ts";
import type { AdAccount, CreatorBrand, MetabaseRow, SyncResult } from "./types.ts";

Deno.serve(async (_req: Request) => {
  let syncLogId: string | null = null;
  let supabase: ReturnType<typeof createClient> | null = null;

  try {
    // Parse request body for trigger type and optional backfill params
    const body = await _req.json().catch(() => ({}));
    const trigger =
      body.trigger === "scheduled"
        ? "scheduled"
        : body.trigger === "backfill"
          ? "backfill"
          : "manual";
    const dateFrom: string | undefined = body.date_from;
    const dateTo: string | undefined = body.date_to;
    const filterAdAccountId: number | undefined = body.ad_account_id;
    const metabaseUrl = Deno.env.get("METABASE_URL");
    const metabaseUsername = Deno.env.get("METABASE_USERNAME");
    const metabasePassword = Deno.env.get("METABASE_PASSWORD");
    const metabaseDatabaseId = Deno.env.get("METABASE_DATABASE_ID");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (
      !metabaseUrl ||
      !metabaseUsername ||
      !metabasePassword ||
      !metabaseDatabaseId ||
      !supabaseUrl ||
      !supabaseServiceRoleKey
    ) {
      return new Response(
        JSON.stringify({ error: "Missing required environment variables" }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }

    supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Create sync log entry
    const { data: logRow } = await supabase
      .from("sync_logs")
      .insert({
        status: "running",
        trigger,
        ad_account_id: filterAdAccountId ?? null,
        date_from: dateFrom ?? null,
        date_to: dateTo ?? null,
      })
      .select("id")
      .single();
    syncLogId = logRow?.id ?? null;

    const metabase = new MetabaseClient(
      metabaseUrl,
      metabaseUsername,
      metabasePassword,
      Number(metabaseDatabaseId),
    );
    await metabase.authenticate();

    // Load lookup data
    const { data: adAccounts, error: adAccountsError } = await supabase
      .from("ad_accounts")
      .select("id, brand_id, meta_account_id");
    if (adAccountsError) throw adAccountsError;

    const { data: creatorBrands, error: creatorBrandsError } = await supabase
      .from("creator_brands")
      .select("id, brand_id, handles");
    if (creatorBrandsError) throw creatorBrandsError;

    // Group creator_brands by brand_id
    const brandHandlesMap = new Map<number, CreatorBrand[]>();
    for (const cb of creatorBrands as CreatorBrand[]) {
      if (!cb.handles || cb.handles.length === 0) continue;
      const list = brandHandlesMap.get(cb.brand_id) || [];
      list.push(cb);
      brandHandlesMap.set(cb.brand_id, list);
    }

    const results: SyncResult[] = [];

    // Filter to specific ad account if requested (backfill mode)
    const accountsToProcess = filterAdAccountId
      ? (adAccounts as AdAccount[]).filter((a) => a.id === filterAdAccountId)
      : (adAccounts as AdAccount[]);

    // Process each ad account sequentially
    for (const account of accountsToProcess) {
      const brandCreatorBrands = brandHandlesMap.get(account.brand_id);

      try {
        // Sync account daily spend (for ALL accounts, needed for share % calculation)
        const accountSpendUpserted = await syncAccountDailySpend(
          supabase,
          metabase,
          account,
          dateFrom,
          dateTo,
        );

        if (!brandCreatorBrands || brandCreatorBrands.length === 0) {
          results.push({
            account_id: account.meta_account_id,
            status: "success",
            creatives_upserted: 0,
            metrics_upserted: 0,
            unmatched_ads: 0,
            account_spend_upserted: accountSpendUpserted,
          });
          continue;
        }

        const result = await processAdAccount(
          supabase,
          metabase,
          account,
          brandCreatorBrands,
          dateFrom,
          dateTo,
        );
        result.account_spend_upserted = accountSpendUpserted;
        results.push(result);
      } catch (err) {
        console.error(`Error processing account ${account.meta_account_id}:`, err);
        results.push({
          account_id: account.meta_account_id,
          status: "error",
          creatives_upserted: 0,
          metrics_upserted: 0,
          unmatched_ads: 0,
          account_spend_upserted: 0,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // Update sync log with final results
    if (syncLogId && supabase) {
      const totals = results.reduce(
        (acc, r) => ({
          creatives_upserted: acc.creatives_upserted + r.creatives_upserted,
          metrics_upserted: acc.metrics_upserted + r.metrics_upserted,
          unmatched_ads: acc.unmatched_ads + r.unmatched_ads,
          account_spend_upserted:
            acc.account_spend_upserted + r.account_spend_upserted,
        }),
        {
          creatives_upserted: 0,
          metrics_upserted: 0,
          unmatched_ads: 0,
          account_spend_upserted: 0,
        },
      );

      const errors = results
        .filter((r) => r.error)
        .map((r) => `${r.account_id}: ${r.error}`);
      const hasErrors = errors.length > 0;

      await supabase
        .from("sync_logs")
        .update({
          finished_at: new Date().toISOString(),
          status: hasErrors ? "error" : "success",
          ...totals,
          error_message: hasErrors ? errors.join("; ") : null,
        })
        .eq("id", syncLogId);
    }

    return new Response(JSON.stringify({ results }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    // Update sync log with error status
    if (syncLogId && supabase) {
      await supabase
        .from("sync_logs")
        .update({
          finished_at: new Date().toISOString(),
          status: "error",
          error_message: err instanceof Error ? err.message : String(err),
        })
        .eq("id", syncLogId);
    }

    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : String(err),
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});

async function processAdAccount(
  supabase: ReturnType<typeof createClient>,
  metabase: MetabaseClient,
  account: AdAccount,
  creatorBrands: CreatorBrand[],
  dateFrom?: string,
  dateTo?: string,
): Promise<SyncResult> {
  // Collect all handles for this brand
  const allHandles = creatorBrands.flatMap((cb) => cb.handles);
  const sql = buildMetabaseQuery(account.meta_account_id, allHandles, dateFrom, dateTo);
  console.log(`Metabase query for ${account.meta_account_id}:\n${sql}`);
  const rows = await metabase.executeQuery(sql);
  console.log(`Metabase returned ${rows.length} rows for ${account.meta_account_id}`);

  if (rows.length === 0) {
    return {
      account_id: account.meta_account_id,
      status: "success",
      creatives_upserted: 0,
      metrics_upserted: 0,
      unmatched_ads: 0,
      account_spend_upserted: 0,
    };
  }

  // Match each row to a creator_brand
  const matched: { row: MetabaseRow; creatorBrandId: number }[] = [];
  let unmatchedCount = 0;

  for (const row of rows) {
    const creatorBrandId = matchCreatorBrand(row.ad_name, creatorBrands);
    if (creatorBrandId !== null) {
      matched.push({ row, creatorBrandId });
    } else {
      unmatchedCount++;
    }
  }

  if (matched.length === 0) {
    return {
      account_id: account.meta_account_id,
      status: "success",
      creatives_upserted: 0,
      metrics_upserted: 0,
      unmatched_ads: unmatchedCount,
    };
  }

  // Deduplicate creatives by meta_ad_id (pick first match)
  const uniqueCreatives = new Map<
    string,
    { creatorBrandId: number; createdTime: string; adName: string }
  >();
  for (const { row, creatorBrandId } of matched) {
    if (!uniqueCreatives.has(row.ad_id)) {
      uniqueCreatives.set(row.ad_id, {
        creatorBrandId,
        createdTime: row.created_time,
        adName: row.ad_name,
      });
    }
  }

  // Upsert creatives — created_time is included but won't change (same source value)
  const creativesToUpsert = Array.from(uniqueCreatives.entries()).map(
    ([metaAdId, { creatorBrandId, createdTime, adName }]) => ({
      creator_brand_id: creatorBrandId,
      ad_account_id: account.id,
      meta_ad_id: metaAdId,
      created_time: createdTime,
      ad_name: adName,
      guideline_number: extractGuidelineNumber(adName),
      product_name: extractProductName(adName),
    }),
  );

  const { error: upsertError } = await supabase
    .from("creatives")
    .upsert(creativesToUpsert, {
      onConflict: "meta_ad_id",
      ignoreDuplicates: false,
    });

  if (upsertError) {
    console.error("Failed to upsert creatives:", upsertError);
  }

  // Fetch all creative IDs (both new and existing)
  const metaAdIds = Array.from(uniqueCreatives.keys());
  const creativeIdMap = new Map<string, number>();

  console.log(`Fetching IDs for ${metaAdIds.length} unique creatives`);

  for (let i = 0; i < metaAdIds.length; i += 100) {
    const batch = metaAdIds.slice(i, i + 100);
    const { data: rows, error: fetchError } = await supabase
      .from("creatives")
      .select("id, meta_ad_id")
      .in("meta_ad_id", batch);
    if (fetchError) {
      console.error(`Failed to fetch creative IDs batch ${i}:`, fetchError);
    }
    if (rows) {
      for (const row of rows) {
        creativeIdMap.set(row.meta_ad_id, row.id);
      }
    }
  }
  console.log(`Resolved ${creativeIdMap.size} creative IDs`);

  // Build metrics data
  const metricsData = matched
    .map(({ row }) => {
      const creativeId = creativeIdMap.get(row.ad_id);
      if (!creativeId) return null;
      return {
        creative_id: creativeId,
        date: row.date,
        spend: row.spend,
        revenue: row.revenue,
        link_clicks: row.link_clicks,
        impressions: row.impressions,
      };
    })
    .filter((m): m is NonNullable<typeof m> => m !== null);

  console.log(`Account ${account.meta_account_id}: ${matched.length} matched rows, ${creativeIdMap.size} creative IDs resolved, ${metricsData.length} metrics to upsert`);

  // Batch UPSERT metrics (in chunks of 500)
  let metricsUpserted = 0;
  for (let i = 0; i < metricsData.length; i += 500) {
    const batch = metricsData.slice(i, i + 500);
    const { error: metricsError } = await supabase
      .from("ad_metrics")
      .upsert(batch, {
        onConflict: "creative_id,date",
        ignoreDuplicates: false,
      });

    if (metricsError) {
      console.error(`Failed to upsert metrics batch ${i}:`, metricsError);
    } else {
      metricsUpserted += batch.length;
    }
  }

  return {
    account_id: account.meta_account_id,
    status: "success",
    creatives_upserted: creativeIdMap.size,
    metrics_upserted: metricsUpserted,
    unmatched_ads: unmatchedCount,
    account_spend_upserted: 0,
  };
}

async function syncAccountDailySpend(
  supabase: ReturnType<typeof createClient>,
  metabase: MetabaseClient,
  account: AdAccount,
  dateFrom?: string,
  dateTo?: string,
): Promise<number> {
  const sql = buildAccountSpendQuery(account.meta_account_id, dateFrom, dateTo);
  const rows = await metabase.executeRawQuery(sql);

  if (rows.length === 0) return 0;

  const spendData = rows.map((row) => ({
    ad_account_id: account.id,
    date: String(row.date),
    spend: Number(row.spend) || 0,
  }));

  const { error } = await supabase
    .from("ad_account_daily_spend")
    .upsert(spendData, {
      onConflict: "ad_account_id,date",
      ignoreDuplicates: false,
    });

  if (error) {
    console.error(
      `Failed to upsert account daily spend for ${account.meta_account_id}:`,
      error,
    );
    return 0;
  }

  return spendData.length;
}
