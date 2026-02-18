import { createRequire } from "node:module";

export type OcrResult = {
  text: string;
  confidence: number;
  provider: "tesseract" | "none";
};

export async function extractReceiptTextFromImage(filePath: string): Promise<OcrResult> {
  const require = createRequire(import.meta.url);

  let tesseract: any;
  try {
    tesseract = require("tesseract.js");
  } catch {
    return { text: "", confidence: 0, provider: "none" };
  }

  try {
    const result = await tesseract.recognize(filePath, "eng");
    const text = String(result?.data?.text ?? "").trim();
    const confidenceRaw = Number(result?.data?.confidence ?? 0);

    return {
      text,
      confidence: Number((Math.max(0, Math.min(confidenceRaw, 100)) / 100).toFixed(2)),
      provider: "tesseract"
    };
  } catch (error) {
    console.error("OCR failed", error);
    return { text: "", confidence: 0, provider: "none" };
  }
}
