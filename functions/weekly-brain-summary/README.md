# OpenBrain Weekly Brain Summary

Run test:
`deno run --allow-net --allow-env --allow-read test-locally.ts`

## Sample success output:

---

Querying thoughts from 2026-02-27 to 2026-03-06...
Found 105 thoughts.
Calling Gemini API...

--- Gemini Summary ---

Here is your concise weekly summary:

... message


----------------------

Posting to Slack...
Slack message posted successfully.

supabase/functions/weekly-brain-summary on  main [?] 
♐︎ 

## Switching Prompts

To compare: change PROMPT_VARIANT at the top from "summary" to "analyst", save, run test-locally.ts, redeploy. One line, no other changes needed.

### Verification

Set PROMPT_VARIANT = "summary" → run test-locally.ts → confirm existing output unchanged
Set PROMPT_VARIANT = "analyst" → run test-locally.ts → confirm new structured format posts to Slack
Deploy with whichever variant is preferred

## Deploy function to Supabase

`supabase functions deploy <_function name_> <_--options_>
example:
```
supabase functions deploy weekly-brain-summary --no-verify-jwt --project-ref <_supabase project ref_> 2>&1
```

**supabase functions deploy weekly-brain-summary**
Deploys the edge function named weekly-brain-summary. The CLI looks for it at supabase/functions/weekly-brain-summary/.

**--no-verify-jwt:** 
Tells Supabase not to require a valid JWT in the Authorization header before invoking the function. This function is triggered by a pg_cron job using the service role key as a Bearer token — not a user JWT — so JWT verification would reject every call. Without this flag, the function would silently never run.

**--project-ref:** 
Explicitly tells the CLI which Supabase project to deploy to. Normally this is read from a .supabase/config link file created by supabase link, but this repo was never linked. Without this flag, the CLI searches for a project ref, fails to find one, and exits with the "Cannot find project ref" error we kept hitting.

**2>&1:** 
Shell I/O redirection. By default, a process has two output streams: stdout (normal output, stream 1) and stderr (errors/warnings, stream 2). The Supabase CLI sends some output — like the "WARNING: Docker is not running" message — to stderr instead of stdout. 2>&1 redirects stderr into stdout, so both streams get captured together in the terminal and in Claude's tool output. Without it, warnings and error messages from the CLI could disappear silently.