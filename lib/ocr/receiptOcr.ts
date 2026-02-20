import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import { unlink } from "node:fs/promises";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type OcrResult = {
  text: string;
  confidence: number;
  provider: "tesseract" | "pdftotext" | "none";
  errorCode?: "pdf_tool_missing";
};

function resolveTesseractWorkerPath(): string | undefined {
  // In Next.js server bundles, require.resolve() can return webpack module ids
  // like "(rsc)/...", which are invalid for worker_threads.Worker.
  const candidate = path.join(
    process.cwd(),
    "node_modules",
    "tesseract.js",
    "src",
    "worker-script",
    "node",
    "index.js"
  );

  return existsSync(candidate) ? candidate : undefined;
}

export async function extractReceiptTextFromImage(filePath: string): Promise<OcrResult> {
  const require = createRequire(import.meta.url);

  let tesseract: any;
  try {
    tesseract = require("tesseract.js");
  } catch {
    return { text: "", confidence: 0, provider: "none" };
  }

  const workerPath = resolveTesseractWorkerPath();

  try {
    const result = await tesseract.recognize(filePath, "eng", workerPath ? { workerPath } : undefined);
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

async function extractReceiptTextFromPdf(filePath: string): Promise<OcrResult> {
  try {
    const { stdout } = await execFileAsync("pdftotext", ["-layout", "-enc", "UTF-8", filePath, "-"], {
      timeout: 15000,
      maxBuffer: 10 * 1024 * 1024
    });
    const text = stdout.trim();
    if (text.length > 0) {
      return {
        text,
        confidence: 0.82,
        provider: "pdftotext"
      };
    }
  } catch (error) {
    if ((error as { code?: string }).code !== "ENOENT") {
      console.error("pdftotext failed", error);
    }
  }

  const tmpBase = path.join(os.tmpdir(), `receipt-${randomUUID()}`);
  const renderedImagePath = `${tmpBase}.png`;

  try {
    await execFileAsync("pdftoppm", ["-png", "-f", "1", "-singlefile", filePath, tmpBase], {
      timeout: 15000,
      maxBuffer: 10 * 1024 * 1024
    });
    return await extractReceiptTextFromImage(renderedImagePath);
  } catch (error) {
    if ((error as { code?: string }).code === "ENOENT") {
      return { text: "", confidence: 0, provider: "none", errorCode: "pdf_tool_missing" };
    }
    console.error("PDF OCR fallback failed", error);
    return { text: "", confidence: 0, provider: "none" };
  } finally {
    try {
      await unlink(renderedImagePath);
    } catch {
      // Best-effort cleanup for temporary rendered files.
    }
  }
}

export async function extractReceiptText(filePath: string, mimeType: string): Promise<OcrResult> {
  if (mimeType === "application/pdf") {
    return extractReceiptTextFromPdf(filePath);
  }

  return extractReceiptTextFromImage(filePath);
}
