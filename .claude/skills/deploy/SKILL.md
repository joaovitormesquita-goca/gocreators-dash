---
description: Deploy Supabase migrations and Edge Functions to production with safety checks
user_invocable: true
---

# /deploy — Production Deployment

Deploy changes to production Supabase with pre-flight validation and explicit user confirmation at every destructive step.

**Golden rule:** NEVER execute a remote/production command without the user saying "yes" first.

## 1. Pre-flight (run /test-local)

Execute the full `/test-local` checklist first.

- If any **critical** check fails, STOP and report. Do not proceed to deployment.
- If only **warnings** exist (e.g., Edge Functions), ask the user if they want to continue.

## 2. Identify Pending Changes

### Migrations

1. Run `supabase migration list` to compare local vs remote migrations.
2. List any migrations that exist locally but have NOT been pushed to remote.
3. For each pending migration, show the filename and a brief description of what it does (read the migration file).

### Edge Functions

1. Check if any files in `supabase/functions/` have been modified since the last deploy.
   - Use `git diff main -- supabase/functions/` to detect changes.
2. If modified, summarize what changed.

### Summary

Present a clear summary:

```
Pending deployment:
- Migrations: [N] pending (list filenames)
- Edge Functions: [changed/no changes] (list function names if changed)
```

If nothing is pending, report "Nothing to deploy" and stop.

## 3. Confirmation Gate

Present the summary and ask: **"Confirm deploy to production?"**

- List exactly what will be executed (`supabase db push`, `supabase functions deploy <name>`)
- WAIT for the user to explicitly confirm before proceeding
- If the user says no or wants to adjust, stop immediately

## 4. Deploy Migrations

Only if there are pending migrations AND user confirmed:

```bash
supabase db push
```

- Report success or failure.
- If it fails, STOP. Do not proceed to Edge Functions. Show the error and suggest fixes.

## 5. Deploy Edge Functions

Only if Edge Functions changed AND user confirmed:

```bash
supabase functions deploy <function-name>
```

Deploy each modified function individually. Report success or failure for each.

## 6. Post-deploy Verification

After successful deployment:

1. Check Supabase project logs for any immediate errors using `supabase` CLI or MCP tools.
2. If the user has access to the production URL, suggest they verify the app manually.

## 7. Report

Present a final summary:

```
Deployment complete:
[success/failed] Migrations pushed (N applied)
[success/failed/skipped] Edge Functions deployed (list names)

Post-deploy: [any warnings or errors from logs]
```
