import { beforeEach, describe, expect, it, vi } from "vitest";

const createReceiptWithItems = vi.fn();
const extractReceiptTextFromImage = vi.fn();
const extractReceiptItemsWithLlm = vi.fn();
const applyReceiptItems = vi.fn();

vi.mock("node:fs/promises", () => ({
  mkdir: vi.fn(async () => undefined),
  writeFile: vi.fn(async () => undefined)
}));

vi.mock("@/lib/db/receipts", () => ({
  createReceiptWithItems,
  applyReceiptItems
}));

vi.mock("@/lib/ocr/receiptOcr", () => ({
  extractReceiptTextFromImage
}));

vi.mock("@/lib/llm/receiptExtraction", () => ({
  extractReceiptItemsWithLlm
}));

import { POST as postReceipt } from "@/app/api/receipts/route";
import { POST as applyReceipt } from "@/app/api/receipts/[id]/apply/route";

describe("POST /api/receipts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createReceiptWithItems.mockResolvedValue({
      id: "receipt-1",
      status: "pending",
      ocrConfidence: 0.92
    });
  });

  it("rejects unsupported mime type", async () => {
    const formData = new FormData();
    formData.append("file", new File(["abc"], "receipt.gif", { type: "image/gif" }));
    const request = new Request("http://localhost/api/receipts", {
      method: "POST",
      body: formData
    });

    const response = await postReceipt(request);
    expect(response.status).toBe(400);
  });

  it("parses OCR rows and persists receipt", async () => {
    extractReceiptTextFromImage.mockResolvedValue({
      text: "2 x 400g Tomatoes",
      confidence: 0.9,
      provider: "tesseract"
    });

    const formData = new FormData();
    formData.append("file", new File(["abc"], "receipt.jpg", { type: "image/jpeg" }));
    const request = new Request("http://localhost/api/receipts", {
      method: "POST",
      body: formData
    });

    const response = await postReceipt(request);
    const json = await response.json();

    expect(response.status).toBe(201);
    expect(json.receipt.id).toBe("receipt-1");
    expect(createReceiptWithItems).toHaveBeenCalledOnce();
  });

  it("falls back to LLM extraction when OCR quality is low", async () => {
    extractReceiptTextFromImage.mockResolvedValue({
      text: "",
      confidence: 0.1,
      provider: "none"
    });
    extractReceiptItemsWithLlm.mockResolvedValue([
      {
        name: "Milk",
        normalizedName: "milk",
        quantityValue: 1,
        unit: "l",
        rawLine: "Milk 1L",
        confidence: 0.85
      }
    ]);

    const formData = new FormData();
    formData.append("file", new File(["abc"], "receipt.png", { type: "image/png" }));
    const request = new Request("http://localhost/api/receipts", {
      method: "POST",
      body: formData
    });

    const response = await postReceipt(request);

    expect(response.status).toBe(201);
    expect(extractReceiptItemsWithLlm).toHaveBeenCalledOnce();
  });
});

describe("POST /api/receipts/[id]/apply", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    applyReceiptItems.mockResolvedValue({ created: 1, updated: 2, skipped: 1 });
  });

  it("validates payload and applies receipt rows", async () => {
    const request = new Request("http://localhost/api/receipts/receipt-1/apply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: [{ name: "Tomatoes", quantityValue: 1.5, unit: "kg", confidence: 0.9, confirmed: true }]
      })
    });

    const response = await applyReceipt(request, { params: { id: "receipt-1" } });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.result.updated).toBe(2);
    expect(applyReceiptItems).toHaveBeenCalledOnce();
  });

  it("returns 400 on invalid payload", async () => {
    const request = new Request("http://localhost/api/receipts/receipt-1/apply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: [] })
    });

    const response = await applyReceipt(request, { params: { id: "receipt-1" } });
    expect(response.status).toBe(400);
  });
});
