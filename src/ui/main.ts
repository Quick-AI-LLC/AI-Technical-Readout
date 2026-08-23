import { marked } from "marked";
import "./styles.css";
import { desktopApi, isDesktop, resizeWindow } from "./desktop";

type Match = { pair: string; base: string; quote: string };
type Config = {
  theme: "infer" | "dark" | "light";
  model: "grok" | "deepseek" | "glm";
  hasKey: boolean;
};

const A = (href: string, label: string) =>
  `<a href="${href}" target="_blank" rel="noopener">${label}</a>`;

const CTAS = [
  `The app runs local on your machine without a database, and nothing is sent to an external server.`,
  `Select your preferred model from Deepseek v4 Pro, GLM (latest), and the default Grok (latest) in settings. Token usage for analysis is minimal, don’t sweat it.`,
  `Your OpenRouter API key gives other apps &amp; services access to the best AI models in the world, explore them ${A("https://openrouter.ai/models", "here")}.`,
  `Free software courtesy of ${A("https://x.com/cdaqai", "@CDAQAI")}.`,
  `To use this local service, you need an OpenRouter API key with credits on it. Load a key with cryptocurrency ${A("https://openrouter.ai/settings/credits", "here")}.`,
  `You are currently using paid API inference. Mine it on InferProof ${A("https://inferproof.one", "inferproof.one")}.`,
  `Tokenize this inference ${A("https://x.com/inferproofone", "@inferproofone")}.`,
  `GitHub stars are welcomed! ${A("https://github.com/orgs/Quick-AI-LLC/repositories", "Quick AI LLC on GitHub")}`,
  `How much inference is mined on Base each day? ${A("https://inferproof.one/day", "Find out")}.`,
  `Need help? ${A("https://discord.gg/k5QE4Y3CBA", "Visit Discord")}.`,
  `Export your reading as markdown or html.`,
  `Swap the color scheme in settings.`,
  `Data processing architecture is ported from an existing, live Quick AI x402 service offering. Your selected LLM analyzes the x402 data output and provides your readout.`,
  `No funds for paid inference? OpenRouter has a variety of free models you can use in other applications. Keep an eye out for rate limits and clogged connections if you go the :free route.`,
  `Thank you for installing, we hope you find the readouts valuable!`,
];

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const onboard = $<HTMLElement>("onboard");
const work = $<HTMLElement>("work");
const request = $<HTMLElement>("request");
const analyzing = $<HTMLElement>("analyzing");
const readout = $<HTMLElement>("readout");
const settings = $<HTMLElement>("settings");
const matchesEl = $<HTMLElement>("matches");
const q = $<HTMLInputElement>("q");
const mdEl = $<HTMLElement>("md");
const ctaEl = $<HTMLElement>("cta");
const btnAnalyze = $<HTMLButtonElement>("btn-analyze");
const btnSettings = $<HTMLButtonElement>("btn-settings");

let cfg: Config = { theme: "infer", model: "grok", hasKey: false };
let selected: Match | null = null;
let mode: "short" | "long" = "long";
let lastMarkdown = "";
let lastTitle = "readout";
let ctaTimer: number | undefined;
let ctaI = 0;
let analyzeAbort: AbortController | null = null;

async function api(path: string, init?: RequestInit) {
  if (isDesktop()) {
    try {
      return (await desktopApi(path, init)) as Record<string, unknown>;
    } catch (err) {
      const name = err instanceof Error ? err.name : "";
      if (name === "AbortError") throw new Error("Canceled");
      throw err;
    }
  }
  let res: Response;
  try {
    res = await fetch(path, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    });
  } catch (err) {
    const name = err instanceof Error ? err.name : "";
    if (name === "AbortError") throw new Error("Canceled");
    throw err;
  }
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

function applyTheme(theme: Config["theme"]) {
  document.documentElement.setAttribute("data-theme", theme);
}

function showErr(id: string, msg: string | null) {
  const el = $(id);
  if (!msg) {
    el.hidden = true;
    el.textContent = "";
    return;
  }
  el.hidden = false;
  el.textContent = msg;
}

function renderShell() {
  applyTheme(cfg.theme);
  onboard.hidden = cfg.hasKey;
  work.hidden = !cfg.hasKey;
  btnSettings.hidden = !cfg.hasKey;
  for (const r of document.querySelectorAll<HTMLInputElement>('input[name="theme"]')) {
    r.checked = r.value === cfg.theme;
  }
  for (const r of document.querySelectorAll<HTMLInputElement>('input[name="model"]')) {
    r.checked = r.value === cfg.model;
  }
}

function setMode(next: "short" | "long") {
  mode = next;
  for (const b of document.querySelectorAll<HTMLButtonElement>("[data-mode]")) {
    b.classList.toggle("on", b.dataset.mode === next);
  }
}

function setSelected(m: Match | null) {
  selected = m;
  btnAnalyze.disabled = !m;
  for (const b of matchesEl.querySelectorAll<HTMLButtonElement>(".match")) {
    b.classList.toggle("on", Boolean(m) && b.dataset.pair === m?.pair);
  }
}

function renderMatches(list: Match[]) {
  matchesEl.innerHTML = "";
  if (!list.length) {
    matchesEl.hidden = true;
    setSelected(null);
    return;
  }
  matchesEl.hidden = false;
  for (const m of list) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "match";
    b.dataset.pair = m.pair;
    b.innerHTML = `${m.base} <small>${m.pair}</small>`;
    b.addEventListener("click", () => setSelected(m));
    matchesEl.append(b);
  }
  setSelected(list.length === 1 ? list[0] : null);
}

function ctaPlain(html: string): string {
  return html.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&");
}

function dwellMs(html: string): number {
  const n = ctaPlain(html).length;
  return Math.min(14000, Math.max(3800, 2500 + n * 60));
}

function showCta() {
  const html = CTAS[ctaI % CTAS.length];
  ctaEl.innerHTML = html;
  ctaTimer = window.setTimeout(() => {
    ctaI = (ctaI + 1) % CTAS.length;
    showCta();
  }, dwellMs(html));
}

function startCtas() {
  window.clearTimeout(ctaTimer);
  showCta();
}

function stopCtas() {
  window.clearTimeout(ctaTimer);
  ctaI = (ctaI + 1) % CTAS.length;
}

function termLabel(): string {
  return mode === "short" ? "short-term" : "long-term";
}

function fileBase(): string {
  const day = new Date().toISOString().slice(0, 10);
  const safe = (selected?.base ?? "readout").replace(/[^\w.-]+/g, "");
  return `${safe}-${termLabel()}-${day}`;
}

function setWide(on: boolean) {
  document.getElementById("app")?.classList.toggle("wide", on);
  void resizeWindow(on);
}

function download(filename: string, contents: string, type: string) {
  const blob = new Blob([contents], { type });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

function htmlExport(markdown: string): string {
  const body = marked.parse(markdown, { async: false }) as string;
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><title>${lastTitle}</title>
<style>
  body { font-family: "IBM Plex Sans", system-ui, sans-serif; max-width: 46rem; margin: 2rem auto; padding: 0 1rem; color: #0e1a28; }
  table { border-collapse: collapse; width: 100%; font-family: "IBM Plex Mono", ui-monospace, monospace; font-size: 0.9rem; }
  th, td { border-bottom: 1px solid #d5dde6; text-align: left; padding: 0.4rem 0.5rem; }
  .nfa { color: #5b6b7c; font-size: 0.85rem; margin-top: 2rem; }
  footer { margin-top: 1.5rem; font-size: 0.85rem; color: #5b6b7c; }
</style></head><body>
${body}
<p class="nfa">None of this is financial advice.</p>
<footer>AI Technical Readout · <a href="https://inferproof.one">InferProof One</a></footer>
</body></html>`;
}

async function loadConfig() {
  cfg = (await api("/api/config")) as Config;
  renderShell();
}

async function search() {
  showErr("request-err", null);
  const query = q.value.trim();
  if (!query) {
    renderMatches([]);
    return;
  }
  try {
    const data = (await api(`/api/search?q=${encodeURIComponent(query)}`)) as { matches: Match[] };
    renderMatches(data.matches);
    if (!data.matches.length) showErr("request-err", "No USDT pair on this feed.");
  } catch (err) {
    showErr("request-err", err instanceof Error ? err.message : "Search failed");
  }
}

async function analyze() {
  if (!selected) return;
  showErr("request-err", null);
  request.hidden = true;
  readout.hidden = true;
  analyzing.hidden = false;
  setWide(true);
  startCtas();
  analyzeAbort?.abort();
  analyzeAbort = new AbortController();
  const timeout = window.setTimeout(() => analyzeAbort?.abort(), 240_000);
  try {
    const data = (await api("/api/analyze", {
      method: "POST",
      body: JSON.stringify({ pair: selected.pair, base: selected.base, mode }),
      signal: analyzeAbort.signal,
    })) as { markdown: string };
    lastMarkdown = data.markdown;
    lastTitle = `${selected.base} ${termLabel()}`;
    mdEl.innerHTML = marked.parse(data.markdown, { async: false }) as string;
    analyzing.hidden = true;
    readout.hidden = false;
    setWide(true);
  } catch (err) {
    analyzing.hidden = true;
    request.hidden = false;
    setWide(false);
    const msg = err instanceof Error ? err.message : "Analyze failed";
    showErr("request-err", msg === "Canceled" ? "Canceled." : msg);
  } finally {
    window.clearTimeout(timeout);
    analyzeAbort = null;
    stopCtas();
  }
}

$<HTMLButtonElement>("btn-cancel").addEventListener("click", () => {
  analyzeAbort?.abort();
});

$<HTMLButtonElement>("btn-save-key").addEventListener("click", async () => {
  showErr("onboard-err", null);
  const key = $<HTMLInputElement>("onboard-key").value.trim();
  try {
    cfg = (await api("/api/config/key", { method: "PUT", body: JSON.stringify({ key }) })) as Config;
    $<HTMLInputElement>("onboard-key").value = "";
    renderShell();
  } catch (err) {
    showErr("onboard-err", err instanceof Error ? err.message : "Could not save key");
  }
});

btnSettings.addEventListener("click", () => {
  settings.hidden = false;
});
$<HTMLButtonElement>("btn-close-settings").addEventListener("click", () => {
  settings.hidden = true;
  showErr("set-err", null);
});

$<HTMLButtonElement>("btn-rotate").addEventListener("click", async () => {
  showErr("set-err", null);
  const key = $<HTMLInputElement>("set-key").value.trim();
  try {
    cfg = (await api("/api/config/key", { method: "PUT", body: JSON.stringify({ key }) })) as Config;
    $<HTMLInputElement>("set-key").value = "";
    renderShell();
  } catch (err) {
    showErr("set-err", err instanceof Error ? err.message : "Could not save key");
  }
});

$<HTMLButtonElement>("btn-clear-key").addEventListener("click", async () => {
  cfg = (await api("/api/config/key", { method: "DELETE" })) as Config;
  settings.hidden = true;
  renderShell();
});

for (const r of document.querySelectorAll<HTMLInputElement>('input[name="theme"]')) {
  r.addEventListener("change", async () => {
    cfg = (await api("/api/config/theme", { method: "PUT", body: JSON.stringify({ theme: r.value }) })) as Config;
    renderShell();
  });
}
for (const r of document.querySelectorAll<HTMLInputElement>('input[name="model"]')) {
  r.addEventListener("change", async () => {
    cfg = (await api("/api/config/model", { method: "PUT", body: JSON.stringify({ model: r.value }) })) as Config;
    renderShell();
  });
}

for (const b of document.querySelectorAll<HTMLButtonElement>("[data-mode]")) {
  b.addEventListener("click", () => setMode(b.dataset.mode as "short" | "long"));
}

q.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    void search();
  }
});
q.addEventListener("blur", () => {
  if (q.value.trim()) void search();
});

$<HTMLButtonElement>("btn-lookup").addEventListener("click", () => void search());
btnAnalyze.addEventListener("click", () => void analyze());
$<HTMLButtonElement>("btn-again").addEventListener("click", () => {
  readout.hidden = true;
  request.hidden = false;
  setWide(false);
});
$<HTMLButtonElement>("btn-md").addEventListener("click", () => {
  const extra = `\n\n---\nNone of this is financial advice.\n\nAI Technical Readout · [InferProof One](https://inferproof.one)\n`;
  download(`${fileBase()}.md`, lastMarkdown + extra, "text/markdown");
});
$<HTMLButtonElement>("btn-html").addEventListener("click", () => {
  download(`${fileBase()}.html`, htmlExport(lastMarkdown), "text/html");
});

void loadConfig().catch((err) => {
  onboard.hidden = false;
  showErr("onboard-err", err instanceof Error ? err.message : "Could not load config");
});
