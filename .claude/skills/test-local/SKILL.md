---
description: Run pre-flight checks to validate the local development environment before deploying
user_invocable: true
---

# /test-local — Local Environment Validation

Run each check below in order. Report results as a checklist at the end. Stop early and report if a critical step fails.

## 1. Docker & Supabase Health

Run `supabase status` to verify local Supabase services are running.

- If services are not running, report the failure and suggest `supabase start`.
- Do NOT start Supabase automatically — the user may need to start Docker first.

**Critical:** If this fails, stop here. Nothing else works without Supabase running.

## 2. Migration Sync

Check for uncommitted schema changes and apply pending migrations:

1. Run `supabase db diff` to detect schema drift (changes in `supabase/schemas/` not yet captured as migrations).
   - If there is drift, warn the user and suggest running `supabase db diff -f <name>` to generate a migration.
2. Run `supabase migration up` to apply any pending migrations to the local database.
   - Never use Supabase MCP or direct SQL to apply migrations.

## 3. Build Check

Run `npm run build` to verify:
- No TypeScript errors
- No Next.js build errors
- All imports resolve correctly

Report the first errors found (truncate to 30 lines max if verbose).

## 4. Edge Functions

1. Start Edge Functions with `supabase functions serve --no-verify-jwt` in the background.
2. Wait 3 seconds for the server to start.
3. Invoke the function with a lightweight test payload:
   ```bash
   curl -s -X POST http://localhost:54321/functions/v1/sync-ad-metrics \
     -H "Content-Type: application/json" \
     -d '{"trigger": "test"}' | head -50
   ```
4. Check the response for errors. A non-2xx status or error message means failure.
5. Stop the functions server after the test.

**Non-critical:** If Edge Functions fail but the rest passes, report it as a warning (the user may not need ETL for their current work).

## 5. App Verification

1. Start the dev server with `npm run dev` in the background.
2. Wait for the server to be ready (check for "Ready" in output or poll `http://localhost:3000`).
3. Verify the app responds with HTTP 200 at `http://localhost:3000`.
4. Stop the dev server after verification.

## 6. Report

Present a summary checklist:

```
Pre-flight results:
[pass/fail] Docker & Supabase running
[pass/fail] No schema drift
[pass/fail] Migrations applied
[pass/fail] Build passes
[pass/warn/fail] Edge Functions healthy
[pass/fail] App loads correctly
```

If all critical checks pass: "Environment is ready for deploy."
If any critical check fails: "Fix the issues above before deploying."
