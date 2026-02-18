import OpenAI from "openai";

const DEFAULT_BASE_URL = "https://router.huggingface.co/v1";

export function getLlmClient() {
  const apiKey = process.env.LLM_API_KEY;

  if (!apiKey) {
    throw new Error("LLM_API_KEY is required");
  }

  return new OpenAI({
    apiKey,
    baseURL: process.env.LLM_BASE_URL || DEFAULT_BASE_URL
  });
}

export function getLlmModel() {
  return process.env.LLM_MODEL || "deepseek-ai/DeepSeek-R1:fastest";
}
