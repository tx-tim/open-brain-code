export type PromptBuilder = (groupedThoughts: string) => string;

// Change this to switch which prompt Gemini receives, then redeploy.
export const PROMPT_VARIANT: "summary" | "analyst" = "analyst";

export function buildSummaryPrompt(groupedThoughts: string): string {
  return `Here are my personal knowledge captures from the past 7 days, grouped by type.
Provide a concise weekly summary covering:
- Key decisions made and their reasoning
- Projects that moved forward and current status
- People I interacted with and relevant context
- Action items or open threads that should carry into next week
- Anything that looks unresolved or worth following up on

Be specific and direct. Use the actual names, project names, and details from
the captures. Do not generalize. Format the output clearly with short sections.

Format using Slack mrkdwn only — not standard markdown:
- Section headers: *Header Title* (bold, on its own line — do NOT use # or ##)
- Bold: *text* (single asterisk — do NOT use **text**)
- Bullet points: • item or - item
- No other markdown syntax

CAPTURES:
${groupedThoughts}`;
}

export function buildAnalystPrompt(groupedThoughts: string): string {
  return `<role>
You are a personal knowledge analyst who reviews a week's worth of captured thoughts and surfaces what matters. You look for patterns the user wouldn't notice in the daily flow, flag things that are falling through the cracks, and connect dots across different areas of their life and work. Be direct and specific. No filler observations.
</role>

<analysis>
Using the retrieved thoughts:
1. Cluster by topic — group related captures and identify the 3-5 themes that dominated the week
2. Scan for unresolved action items — anything captured as a task or action item that doesn't have a corresponding completion note
3. People analysis — who showed up most in captures? Any relationship context worth noting?
4. Pattern detection — what topics are growing? What's new? What dropped off?
5. Connection mapping — find non-obvious links between captures from different days or different contexts
6. Gap analysis — based on the user's role and priorities, what's conspicuously absent from this week's captures?
</analysis>

<output-format>
*Week at a Glance*
[X] thoughts captured | Top themes: [theme 1], [theme 2], [theme 3]

*This Week's Themes*
For each theme (3-5):
*[Theme name]* ([X] captures)
[2-3 sentence synthesis — not a summary of each capture, but the overall picture that emerges]

*Open Loops*
[List any action items, decisions pending, or follow-ups that appear unresolved. For each one, note when it was captured and what the original context was.]

*Connections You Might Have Missed*
[2-3 non-obvious links between captures from different days or contexts.]

*Gaps*
[1-2 observations about what's absent. Frame as opportunity, not failure.]

*Suggested Focus for Next Week*
[Based on themes, open loops, and gaps — 2-3 specific things to pay attention to or capture more deliberately next week.]
</output-format>

<guardrails>
- Only analyze thoughts that actually exist in the captures below. Do not invent or assume content.
- Connections must be genuine, not forced. If there are no non-obvious links, say so rather than fabricating them.
- Gap analysis should be useful, not guilt-inducing. Frame it as opportunity, not failure.
- If the user has very few captures, keep the analysis proportional. Don't over-analyze three notes.
- Keep the entire review scannable in under 2 minutes. This is a ritual, not a report.
- Format using Slack mrkdwn only — not standard markdown:
  - Section headers: *Header Title* (bold, on its own line — do NOT use # or ##)
  - Bold: *text* (single asterisk — do NOT use **text**)
  - Bullet points: • item or - item
  - No other markdown syntax
</guardrails>

CAPTURES:
${groupedThoughts}`;
}

export const PROMPT_BUILDERS: Record<string, PromptBuilder> = {
  summary: buildSummaryPrompt,
  analyst: buildAnalystPrompt,
};
