import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PROMPT_BUILDERS, PROMPT_VARIANT, type PromptBuilder } from "./prompt-utils.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY")!;
const SLACK_WEBHOOK_URL = Deno.env.get("SLACK_WEBHOOK_URL")!;

const GEMINI_ENDPOINT =
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

interface Thought {
  content: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

function formatDateRange(start: Date, end: Date): { start: string; end: string } {
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { start: fmt(start), end: fmt(end) };
}

function groupByType(thoughts: Thought[]): string {
  const groups: Record<string, string[]> = {};
  for (const t of thoughts) {
    const type = (t.metadata?.type as string) || "uncategorized";
    if (!groups[type]) groups[type] = [];
    groups[type].push(t.content);
  }
  return Object.entries(groups)
    .map(([type, items]) => {
      const header = `[${type.toUpperCase()}]`;
      const body = items.map((c, i) => `${i + 1}. ${c}`).join("\n");
      return `${header}\n${body}`;
    })
    .join("\n\n");
}

function chunkText(text: string, maxLen: number): string[] {
  const lines = text.split("\n");
  const chunks: string[] = [];
  let current = "";
  for (const line of lines) {
    const next = current ? current + "\n" + line : line;
    if (next.length > maxLen) {
      if (current) chunks.push(current);
      current = line;
    } else {
      current = next;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

async function callGemini(groupedThoughts: string, buildPrompt: PromptBuilder): Promise<string> {
  const prompt = buildPrompt(groupedThoughts);

  const res = await fetch(GEMINI_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini API error ${res.status}: ${err}`);
  }

  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}

async function postToSlack(blocks: unknown[]): Promise<void> {
  const res = await fetch(SLACK_WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ blocks }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Slack webhook error ${res.status}: ${err}`);
  }
}

async function postFallback(text: string): Promise<void> {
  await fetch(SLACK_WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
}

Deno.serve(async (_req: Request): Promise<Response> => {
  try {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const { start: startStr, end: endStr } = formatDateRange(sevenDaysAgo, now);

    const { data: thoughts, error } = await supabase
      .from("thoughts")
      .select("content, metadata, created_at")
      .gte("created_at", sevenDaysAgo.toISOString())
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Supabase query error:", error);
      await postFallback(
        "Weekly Brain Summary unavailable — database query error. Check function logs.",
      );
      return new Response("error", { status: 500 });
    }

    console.log(`Thought count for past 7 days: ${thoughts?.length ?? 0}`);

    if (!thoughts || thoughts.length === 0) {
      await postToSlack([
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: "No Open Brain captures found for the past 7 days.",
          },
        },
      ]);
      return new Response("ok", { status: 200 });
    }

    const groupedThoughts = groupByType(thoughts as Thought[]);
    console.log(`Calling Gemini API (prompt: ${PROMPT_VARIANT})...`);

    let summary: string;
    try {
      summary = await callGemini(groupedThoughts, PROMPT_BUILDERS[PROMPT_VARIANT]);
    } catch (err) {
      console.error("Gemini error:", err);
      await postFallback(
        "Weekly Brain Summary unavailable — Gemini API error. Check function logs.",
      );
      return new Response("gemini error", { status: 200 });
    }

    const summaryChunks = chunkText(summary, 3000);
    const blocks = [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: `\uD83E\uDDE0 Weekly Brain Summary \u2014 ${startStr} to ${endStr}`,
        },
      },
      ...summaryChunks.map((chunk) => ({
        type: "section",
        text: { type: "mrkdwn", text: chunk },
      })),
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `${thoughts.length} captures from ${startStr} to ${endStr}`,
          },
        ],
      },
    ];

    await postToSlack(blocks);
    console.log("Slack message posted successfully.");
    return new Response("ok", { status: 200 });
  } catch (err) {
    console.error("Function error:", err);
    await postFallback(
      "Weekly Brain Summary unavailable — unexpected error. Check function logs.",
    ).catch(() => {});
    return new Response("error", { status: 500 });
  }
});
