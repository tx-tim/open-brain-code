// Local test script for weekly-brain-summary
// Usage: deno run --allow-net --allow-env --allow-read test-locally.ts
//
// Loads secrets from .env in the repo root (two levels up from this file).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PROMPT_BUILDERS, PROMPT_VARIANT } from "./prompt-utils.ts";

// Load .env from repo root
const envPath = new URL("../../.env", import.meta.url).pathname;
const envText = await Deno.readTextFile(envPath);
for (const line of envText.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eq = trimmed.indexOf("=");
  if (eq === -1) continue;
  const key = trimmed.slice(0, eq).trim();
  const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
  Deno.env.set(key, value);
}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY")!;
const SLACK_WEBHOOK_URL = Deno.env.get("SLACK_WEBHOOK_URL")!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !GEMINI_API_KEY || !SLACK_WEBHOOK_URL) {
  console.error("Missing required env vars. Check your .env file.");
  Deno.exit(1);
}

const GEMINI_ENDPOINT =
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

interface Thought {
  content: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
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

// --- Query thoughts ---
const now = new Date();
const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
const startStr = formatDate(sevenDaysAgo);
const endStr = formatDate(now);

console.log(`Querying thoughts from ${startStr} to ${endStr}...`);

const { data: thoughts, error } = await supabase
  .from("thoughts")
  .select("content, metadata, created_at")
  .gte("created_at", sevenDaysAgo.toISOString())
  .order("created_at", { ascending: true });

if (error) {
  console.error("Supabase query error:", error);
  Deno.exit(1);
}

console.log(`Found ${thoughts?.length ?? 0} thoughts.`);

if (!thoughts || thoughts.length === 0) {
  console.log("No captures found. Posting empty message to Slack...");
  await fetch(SLACK_WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: "No Open Brain captures found for the past 7 days." }),
  });
  console.log("Done.");
  Deno.exit(0);
}

const groupedThoughts = groupByType(thoughts as Thought[]);

// --- Call Gemini ---
console.log(`Calling Gemini API (prompt: ${PROMPT_VARIANT})...`);

const prompt = PROMPT_BUILDERS[PROMPT_VARIANT](groupedThoughts);

const geminiRes = await fetch(GEMINI_ENDPOINT, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
});

if (!geminiRes.ok) {
  const err = await geminiRes.text();
  console.error(`Gemini API error ${geminiRes.status}: ${err}`);
  await fetch(SLACK_WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text: "Weekly Brain Summary unavailable — Gemini API error. Check function logs.",
    }),
  });
  Deno.exit(1);
}

const geminiData = await geminiRes.json();
const summary: string = geminiData.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

console.log("\n--- Gemini Summary ---\n");
console.log(summary);
console.log("\n----------------------\n");

// --- Post to Slack ---
console.log("Posting to Slack...");

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

const slackRes = await fetch(SLACK_WEBHOOK_URL, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ blocks }),
});

if (!slackRes.ok) {
  console.error(`Slack webhook error ${slackRes.status}: ${await slackRes.text()}`);
  Deno.exit(1);
}

console.log("Slack message posted successfully.");
