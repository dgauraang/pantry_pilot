import { z } from "zod";
import { createChatCompletionWithFallback, getLlmClient } from "@/lib/llm/client";
import { normalizeName, normalizeUnit } from "@/lib/receipts/normalize";

const receiptLineItemSchema = z.object({
  name: z.string().trim().min(1),
  quantityValue: z.number().positive().nullable().optional(),
  unit: z.string().trim().nullable().optional(),
  rawLine: z.string().trim().min(1),
  confidence: z.number().min(0).max(1).optional()
});

const receiptExtractionSchema = z.object({
  items: z.array(receiptLineItemSchema)
});

export type LlmExtractedReceiptItem = z.infer<typeof receiptLineItemSchema> & {
  normalizedName: string;
  unit: string | null;
};

function extractJsonBlock(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith("```")) {
    const match = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
    if (match?.[1]) {
      return match[1];
    }
  }
  return trimmed;
}

export async function extractReceiptItemsWithLlm(ocrText: string): Promise<LlmExtractedReceiptItem[]> {
  const client = getLlmClient();

  const systemPrompt = [
    "You extract grocery receipt line items from OCR text.",
    "Return only JSON in this schema:",
    '{"items":[{"name":"string","quantityValue":number|null,"unit":"string|null","rawLine":"string","confidence":0-1}]}',
    "Do not include tax/subtotal/total lines.",
    "If quantity is unknown set quantityValue to null."
  ].join("\n");

  const userPrompt = [
    "Parse receipt OCR text into ingredient rows.",
    "OCR text:",
    ocrText || "(empty OCR text)"
  ].join("\n\n");

  const { completion } = await createChatCompletionWithFallback(client, {
    temperature: 0,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ]
  });

  const content = completion.choices[0]?.message?.content;
  const text = typeof content === "string" ? content : "";
  const parsed = receiptExtractionSchema.parse(JSON.parse(extractJsonBlock(text)));

  return parsed.items
    .map((item) => ({
      ...item,
      quantityValue: item.quantityValue ?? null,
      unit: normalizeUnit(item.unit),
      normalizedName: normalizeName(item.name)
    }))
    .filter((item) => item.normalizedName.length > 0);
}
