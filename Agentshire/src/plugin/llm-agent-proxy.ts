/**
 * LLM proxy for implicit NPC behaviors and soul generation.
 * Reads provider config from OpenClaw runtime (rt.config.loadConfig()),
 * resolves env-templated API keys from the config's env section,
 * and makes direct HTTP calls. Falls back to process.env for QClaw compatibility.
 */

export interface LLMChatRequest {
  system: string;
  user: string;
  maxTokens: number;
  temperature: number;
  stop: string[];
  priority?: "user" | "background";
  timeoutMs?: number;
}

export interface LLMChatResult {
  text: string;
  usage?: { input: number; output: number };
  error?: string;
}

interface ProviderConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  apiFormat: "anthropic-messages" | "openai";
  thinking?: boolean;
  bodyMode?: "full" | "minimal";
}

const MAX_CONCURRENT = 2;
const MAX_QUEUE = 12;
const DEFAULT_TIMEOUT_MS = 45_000;
const BACKGROUND_TIMEOUT_MS = 10_000;

function resolveEnvRef(value: string, env: Record<string, string>): string {
  return value.replace(/\$\{(\w+)\}/g, (_, key) => env[key] ?? process.env[key] ?? "");
}

function normalizeBaseUrl(value: string): string {
  return value.trim().replace(/\/+$/, "").replace(/\/v1$/, "");
}

function loadProviderFromEnv(): ProviderConfig | null {
  const baseUrl = process.env.AGENTSHIRE_LLM_BASE_URL?.trim();
  if (!baseUrl) return null;
  const thinkingEnv = process.env.AGENTSHIRE_LLM_THINKING?.trim().toLowerCase();

  const apiFormat = process.env.AGENTSHIRE_LLM_API_FORMAT?.trim().startsWith("anthropic")
    ? "anthropic-messages" as const
    : "openai" as const;

  return {
    baseUrl: normalizeBaseUrl(baseUrl),
    apiKey: process.env.AGENTSHIRE_LLM_API_KEY?.trim() ?? "",
    model: process.env.AGENTSHIRE_LLM_MODEL?.trim() || "Qwen/Qwen3-32B-AWQ",
    apiFormat,
    ...(thinkingEnv === "true" || thinkingEnv === "false" ? { thinking: thinkingEnv === "true" } : {}),
    bodyMode: process.env.AGENTSHIRE_LLM_BODY_MODE?.trim().toLowerCase() === "minimal" ? "minimal" : "full",
  };
}

async function loadProvider(): Promise<ProviderConfig | null> {
  const envProvider = loadProviderFromEnv();
  if (envProvider) return envProvider;

  try {
    const { getTownRuntime } = await import("./runtime.js");
    const rt = getTownRuntime();
    const cfg = rt.config.loadConfig() as any;
    const env: Record<string, string> = cfg?.env ?? {};
    const providers = cfg?.models?.providers;
    if (!providers || typeof providers !== "object") return null;

    for (const [, provider] of Object.entries(providers) as [string, any][]) {
      if (!provider.baseUrl || !provider.apiKey) continue;
      const apiKey = resolveEnvRef(String(provider.apiKey), env);
      if (!apiKey) continue;

      const apiFormat = provider.api?.startsWith("openai") ? "openai" as const : "anthropic-messages" as const;
      const models = Array.isArray(provider.models) ? provider.models : [];
      const model = models[0]?.id ?? "default";

      return {
        baseUrl: normalizeBaseUrl(String(provider.baseUrl)),
        apiKey,
        model,
        apiFormat,
      };
    }
  } catch (err) {
    console.warn("[llm-agent-proxy] Failed to load provider:", (err as Error).message);
  }
  return null;
}

function describeProvider(config: ProviderConfig): string {
  return `${config.apiFormat} ${config.model} @ ${config.baseUrl}`;
}

async function callAnthropicMessages(config: ProviderConfig, req: LLMChatRequest): Promise<LLMChatResult> {
  const body = {
    model: config.model,
    max_tokens: req.maxTokens,
    temperature: req.temperature,
    system: req.system,
    messages: [{ role: "user", content: req.user }],
    ...(req.stop.length > 0 ? { stop_sequences: req.stop } : {}),
  };

  const url = `${config.baseUrl}/v1/messages`;
  const resp = await fetchWithTimeout(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": config.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
  }, req.timeoutMs);

  if (!resp.ok) {
    const errText = await resp.text().catch(() => "");
    throw new Error(`Anthropic API ${resp.status}: ${errText.slice(0, 200)}`);
  }

  const data = await resp.json() as {
    content?: Array<{ type: string; text?: string }>;
    usage?: { input_tokens?: number; output_tokens?: number };
  };

  const text = data.content?.find(b => b.type === "text")?.text ?? "";
  return {
    text,
    usage: data.usage
      ? { input: data.usage.input_tokens ?? 0, output: data.usage.output_tokens ?? 0 }
      : undefined,
  };
}

async function callOpenAI(config: ProviderConfig, req: LLMChatRequest): Promise<LLMChatResult> {
  const body = config.bodyMode === "minimal" ? {
    stream: false,
    messages: [
      { role: "system", content: req.system },
      { role: "user", content: req.user },
    ],
    ...(config.thinking !== undefined ? { thinking: config.thinking } : {}),
  } : {
    model: config.model,
    max_tokens: req.maxTokens,
    temperature: req.temperature,
    stream: false,
    messages: [
      { role: "system", content: req.system },
      { role: "user", content: req.user },
    ],
    ...(req.stop.length > 0 ? { stop: req.stop } : {}),
    ...(config.thinking !== undefined ? { thinking: config.thinking } : {}),
  };

  const url = `${config.baseUrl}/v1/chat/completions`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (config.apiKey) {
    headers.Authorization = `Bearer ${config.apiKey}`;
  }

  const resp = await fetchWithTimeout(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  }, req.timeoutMs);

  if (!resp.ok) {
    const errText = await resp.text().catch(() => "");
    throw new Error(`OpenAI API ${resp.status} ${resp.statusText}: ${errText.slice(0, 500)}`);
  }

  const data = await resp.json() as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };

  const text = data.choices?.[0]?.message?.content ?? "";
  return {
    text,
    usage: data.usage
      ? { input: data.usage.prompt_tokens ?? 0, output: data.usage.completion_tokens ?? 0 }
      : undefined,
  };
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs?: number): Promise<Response> {
  const ms = timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ac.signal });
  } catch (err) {
    if ((err as Error).name === "AbortError") {
      throw new Error(`LLM timeout sau ${Math.round(ms / 1000)} giây`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

let activeRequests = 0;
const requestQueue: Array<{
  req: LLMChatRequest;
  resolve: (r: LLMChatResult) => void;
  reject: (e: Error) => void;
}> = [];

function drainQueue(): void {
  while (requestQueue.length > 0 && activeRequests < MAX_CONCURRENT) {
    const next = requestQueue.shift()!;
    executeChat(next.req).then(next.resolve, next.reject);
  }
}

async function executeChat(req: LLMChatRequest): Promise<LLMChatResult> {
  activeRequests++;
  try {
    const config = await loadProvider();
    if (!config) {
      const msg = "No LLM provider configured. Set AGENTSHIRE_LLM_BASE_URL and AGENTSHIRE_LLM_API_KEY.";
      console.warn(`[llm-agent-proxy] ${msg}`);
      return { text: "", error: msg };
    }
    const kind = req.priority ?? "user";
    console.log(`[llm-agent-proxy] chat start kind=${kind} ${describeProvider(config)} maxTokens=${req.maxTokens} temp=${req.temperature}`);
    return config.apiFormat === "openai"
      ? await callOpenAI(config, req)
      : await callAnthropicMessages(config, req);
  } catch (err) {
    const message = (err as Error).message;
    console.warn("[llm-agent-proxy] chat error:", message);
    return { text: "", error: message };
  } finally {
    activeRequests--;
    drainQueue();
  }
}

export async function chat(req: LLMChatRequest): Promise<LLMChatResult> {
  const priority = req.priority ?? "user";
  const normalizedReq: LLMChatRequest = {
    ...req,
    priority,
    timeoutMs: req.timeoutMs ?? (priority === "background" ? BACKGROUND_TIMEOUT_MS : DEFAULT_TIMEOUT_MS),
  };

  if (priority === "background" && (activeRequests > 0 || requestQueue.length > 0)) {
    return { text: "", error: "background_skipped_busy" };
  }

  if (activeRequests >= MAX_CONCURRENT) {
    return new Promise<LLMChatResult>((resolve, reject) => {
      if (requestQueue.length >= MAX_QUEUE) {
        resolve({ text: "", error: "llm_queue_full" });
        return;
      }
      const item = { req: normalizedReq, resolve, reject };
      if (priority === "user") {
        requestQueue.unshift(item);
      } else {
        requestQueue.push(item);
      }
    });
  }
  return executeChat(normalizedReq);
}

export function isAvailable(): boolean {
  return loadProvider() !== null;
}
