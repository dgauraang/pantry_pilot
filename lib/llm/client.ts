import OpenAI from "openai";

const DEFAULT_BASE_URL = "https://openrouter.ai/api/v1";
const DEFAULT_MODEL = "openrouter/free";
const DEFAULT_FALLBACK_MODELS = [
  "openai/gpt-oss-20b:free",
  "mistralai/mistral-small-3.1-24b-instruct:free",
  "qwen/qwen3-coder:free"
];

function normalizeApiKey(value?: string): string {
  return (value ?? "").trim().replace(/^Bearer\s+/i, "");
}

export function getLlmApiKey() {
  const apiKey = normalizeApiKey(process.env.LLM_API_KEY);
  if (!apiKey) {
    throw new Error("LLM_API_KEY is required");
  }
  return apiKey;
}

export function hasLlmApiKey() {
  return normalizeApiKey(process.env.LLM_API_KEY).length > 0;
}

export function getLlmBaseUrl() {
  return (process.env.LLM_BASE_URL || DEFAULT_BASE_URL).trim();
}

function getLlmDefaultHeaders(): Record<string, string> | undefined {
  const referer = process.env.LLM_HTTP_REFERER?.trim();
  const title = process.env.LLM_X_TITLE?.trim();

  const headers: Record<string, string> = {};
  if (referer) {
    headers["HTTP-Referer"] = referer;
  }
  if (title) {
    headers["X-Title"] = title;
  }

  return Object.keys(headers).length > 0 ? headers : undefined;
}

export function getLlmClient() {
  return new OpenAI({
    apiKey: getLlmApiKey(),
    baseURL: getLlmBaseUrl(),
    defaultHeaders: getLlmDefaultHeaders()
  });
}

export function getLlmModel() {
  return process.env.LLM_MODEL || DEFAULT_MODEL;
}

export function getLlmFallbackModels(): string[] {
  const configured = (process.env.LLM_FALLBACK_MODELS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  const models = configured.length > 0 ? configured : DEFAULT_FALLBACK_MODELS;
  const primary = getLlmModel();
  return [...new Set(models.filter((model) => model !== primary))];
}

function getErrorStatus(error: unknown): number | null {
  if (!error || typeof error !== "object") {
    return null;
  }

  const status = (error as { status?: unknown }).status;
  return typeof status === "number" ? status : null;
}

function getErrorText(error: unknown): string {
  if (!error || typeof error !== "object") {
    return "";
  }

  const topLevel =
    typeof (error as { message?: unknown }).message === "string"
      ? (error as { message: string }).message
      : "";
  const nested = (error as { error?: unknown }).error;
  if (nested && typeof nested === "object") {
    const nestedMessage =
      typeof (nested as { message?: unknown }).message === "string"
        ? (nested as { message: string }).message
        : "";
    const raw =
      typeof (nested as { metadata?: { raw?: unknown } }).metadata?.raw === "string"
        ? (nested as { metadata: { raw: string } }).metadata.raw
        : "";
    return [raw, nestedMessage, topLevel].filter(Boolean).join(" | ");
  }

  return topLevel;
}

function shouldRetrySameModel(error: unknown): boolean {
  const status = getErrorStatus(error);
  return status === 429 || (status !== null && status >= 500);
}

function shouldTryFallbackModel(error: unknown): boolean {
  if (shouldRetrySameModel(error)) {
    return true;
  }

  const status = getErrorStatus(error);
  const text = getErrorText(error).toLowerCase();
  if (
    (status === 400 || status === 404) &&
    (
      text.includes("no endpoints found") ||
      text.includes("model_not_supported") ||
      text.includes("not found")
    )
  ) {
    return true;
  }

  return false;
}

type ChatCreateParams = Omit<OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming, "model">;

export async function createChatCompletionWithFallback(
  client: OpenAI,
  params: ChatCreateParams,
  options?: { maxAttemptsPerModel?: number }
) {
  const maxAttemptsPerModel = Math.max(1, options?.maxAttemptsPerModel ?? 2);
  const models = [getLlmModel(), ...getLlmFallbackModels()];

  let lastError: unknown = null;

  for (let modelIndex = 0; modelIndex < models.length; modelIndex += 1) {
    const model = models[modelIndex];

    for (let attempt = 1; attempt <= maxAttemptsPerModel; attempt += 1) {
      try {
        const completion = await client.chat.completions.create({
          ...params,
          model
        });
        return { completion, model };
      } catch (error) {
        lastError = error;
        const canRetry = shouldRetrySameModel(error) && attempt < maxAttemptsPerModel;
        if (canRetry) {
          await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
          continue;
        }

        const canFallback = shouldTryFallbackModel(error) && modelIndex < models.length - 1;
        if (canFallback) {
          break;
        }

        throw error;
      }
    }
  }

  throw lastError || new Error("LLM request failed");
}

export async function smokeCheckLlmAuth(): Promise<number | null> {
  try {
    const response = await fetch(`${getLlmBaseUrl()}/models`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${getLlmApiKey()}`,
        ...(getLlmDefaultHeaders() || {})
      },
      cache: "no-store"
    });
    return response.status;
  } catch {
    return null;
  }
}
