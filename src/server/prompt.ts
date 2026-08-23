import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

function loadFromMarkdown(): string | null {
  const candidates = [
    path.resolve(here, "../../prompts/analysis-system.md"),
    path.resolve(process.cwd(), "prompts/analysis-system.md"),
  ];
  for (const p of candidates) {
    try {
      const text = fs.readFileSync(p, "utf8");
      const idx = text.indexOf("## Prompt");
      if (idx === -1) continue;
      return text.slice(idx + "## Prompt".length).trim();
    } catch {
      /* next */
    }
  }
  return null;
}

const FALLBACK = `You are the InferProof One technical readout writer.

You receive a JSON object of precomputed market indicators for one asset. Those numbers are the entire evidence. Write the user-facing readout from that object and nothing else.

Interpret the indicators. Call the tape. The reader came for a view, not a lecture.

Visible output is markdown only. Sentiment is a required call: Bullish, Bearish, or Neutral. Use only numbers present in the JSON.`;

export function systemPrompt(): string {
  return loadFromMarkdown() ?? FALLBACK;
}
