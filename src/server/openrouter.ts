import { getApiKey, modelSlug } from "./config.js";
import { systemPrompt } from "./prompt.js";

const OR = "https://openrouter.ai/api/v1";

export async function validateKey(key: string): Promise<void> {
  const res = await fetch(`${OR}/key`, {
    headers: { Authorization: `Bearer ${key}` },
  });
  if (res.status === 401 || res.status === 403) {
    throw new Error("OpenRouter rejected that key");
  }
  if (!res.ok) {
    throw new Error(`OpenRouter key check failed (${res.status})`);
  }
}

export async function complete(userPayload: unknown): Promise<string> {
  const key = getApiKey();
  if (!key) throw new Error("No OpenRouter API key set");
  let res: Response;
  try {
    res = await fetch(`${OR}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "http://127.0.0.1:5173",
        "X-Title": "AI Technical Readout",
      },
      signal: AbortSignal.timeout(240_000),
      body: JSON.stringify({
        model: modelSlug(),
        temperature: 0.3,
        messages: [
          { role: "system", content: systemPrompt() },
          { role: "user", content: JSON.stringify(userPayload) },
        ],
      }),
    });
  } catch (err) {
    const name = err instanceof Error ? err.name : "";
    if (name === "TimeoutError" || name === "AbortError") {
      throw new Error("OpenRouter timed out");
    }
    throw err;
  }
  if (res.status === 401 || res.status === 403) {
    throw new Error("OpenRouter rejected that key");
  }
  if (!res.ok) {
    throw new Error(`OpenRouter request failed (${res.status})`);
  }
  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string | Array<{ text?: string }> } }>;
  };
  const content = data.choices?.[0]?.message?.content;
  if (typeof content === "string" && content.trim()) return content.trim();
  if (Array.isArray(content)) {
    const text = content.map((p) => p.text ?? "").join("").trim();
    if (text) return text;
  }
  throw new Error("OpenRouter returned an empty readout");
}
