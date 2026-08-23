import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export const MODELS = {
  grok: { id: "grok", label: "Grok", slug: "~x-ai/grok-latest" },
  deepseek: { id: "deepseek", label: "DeepSeek", slug: "deepseek/deepseek-v4-pro-0813" },
  glm: { id: "glm", label: "GLM", slug: "~z-ai/glm-latest" },
} as const;

export type ModelId = keyof typeof MODELS;
export type ThemeId = "infer" | "dark" | "light";

type FileShape = {
  apiKey?: string;
  theme?: ThemeId;
  model?: ModelId;
};

const DIR =
  process.env.APPDATA?.trim() ||
  process.env.XDG_CONFIG_HOME?.trim() ||
  path.join(os.homedir(), ".config");

export const CONFIG_DIR = path.join(DIR, "ai-technical-readout");
const FILE = path.join(CONFIG_DIR, "config.json");

function readFile(): FileShape {
  try {
    return JSON.parse(fs.readFileSync(FILE, "utf8")) as FileShape;
  } catch {
    return {};
  }
}

function writeFile(data: FileShape): void {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2), { encoding: "utf8", mode: 0o600 });
}

export function publicConfig(): { theme: ThemeId; model: ModelId; hasKey: boolean } {
  const d = readFile();
  const theme: ThemeId = d.theme === "dark" || d.theme === "light" ? d.theme : "infer";
  const model: ModelId = d.model && d.model in MODELS ? d.model : "grok";
  return { theme, model, hasKey: Boolean(d.apiKey?.trim()) };
}

export function getApiKey(): string | null {
  const k = readFile().apiKey?.trim();
  return k || null;
}

export function setApiKey(key: string): void {
  const d = readFile();
  d.apiKey = key.trim();
  writeFile(d);
}

export function clearApiKey(): void {
  const d = readFile();
  delete d.apiKey;
  writeFile(d);
}

export function setTheme(theme: ThemeId): void {
  const d = readFile();
  d.theme = theme;
  writeFile(d);
}

export function setModel(model: ModelId): void {
  if (!(model in MODELS)) throw new Error("Unknown model");
  const d = readFile();
  d.model = model;
  writeFile(d);
}

export function modelSlug(): string {
  return MODELS[publicConfig().model].slug;
}
