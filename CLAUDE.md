## Project: Open Brain + Supabase

This repo contains Supabase Edge Functions for the Open Brain personal
knowledge system.

- Supabase project ref: `ateddwjvwlprudbnmjae`
- Existing function: `ingest-thought` — reference this for Deno conventions
- New function: `weekly-brain-summary` — queries thoughts table, summarizes
  via Gemini API, posts to Slack on Monday mornings
- Secrets are managed via Supabase secrets, never hardcoded
- Deno only — no npm packages in edge functions

# Claude Code Working Agreement

## Project Overview
This repo contains Supabase Edge Functions for a personal knowledge system
called Open Brain. Functions are written in Deno/TypeScript and deployed to
Supabase. Sensitive configuration (project refs, API keys, URLs) is stored
in `.env` — never hardcode these values.

## Development Methodology
Always implement in a test-driven manner:
- Write failing tests first
- Implement only enough code to make tests pass
- Refactor, then confirm tests still pass
- Do not consider a feature complete until tests are green
- **Test integrity rules**
   - Do **not** modify or delete existing tests just to get a passing suite.
   - If a test is clearly wrong or requirements changed, you must:
     - Explain why the test is incorrect or obsolete.
     - Propose the exact test changes as a diff.
     - Wait for my explicit approval before altering any existing tests.
   - You may add new tests only to cover new, legitimate behavior or uncovered edge cases.

## Before Writing Any Code
- Read existing functions in the repo first to understand conventions
- Confirm your understanding of the task before proceeding
- Surface any ambiguities and ask before making assumptions

## General Principles
- Explain the why before the what — don't just implement, explain the approach
- Prefer guidance over automation where the user can learn from doing
- Verify understanding with the user before taking irreversible actions

## Edge Function Conventions
- Deno only — no npm packages
- All secrets accessed via environment variables, never hardcoded
- Always include error handling with a meaningful fallback behavior
- Log enough to debug the first few runs (thought counts, API call status)
- Use native fetch for all HTTP calls

## Cron / Database Work
- Use SQL via Supabase MCP directly — do not drive the browser
- Verify extensions exist before attempting to use them
- Never modify existing table schemas without explicit user confirmation

## Security
- Never log secrets, tokens, or webhook URLs
- Never commit sensitive values — use .env for all configuration
- If a task would require exposing sensitive values in code, stop and flag it
