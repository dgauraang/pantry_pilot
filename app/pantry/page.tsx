"use client";

import { FormEvent, useEffect, useState } from "react";

type PantryItem = {
  id: string;
  name: string;
  quantityValue?: number | null;
  quantity?: string | null;
  unit?: string | null;
};

type ReceiptRow = {
  name: string;
  quantityValue: number | null;
  unit: string | null;
  rawLine: string;
  confidence: number;
  requiresConfirmation: boolean;
  confirmed: boolean;
};

export default function PantryPage() {
  const [items, setItems] = useState<PantryItem[]>([]);
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [receiptId, setReceiptId] = useState<string | null>(null);
  const [receiptRows, setReceiptRows] = useState<ReceiptRow[]>([]);
  const [uploading, setUploading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [receiptError, setReceiptError] = useState<string | null>(null);
  const [receiptSuccess, setReceiptSuccess] = useState<string | null>(null);

  async function loadItems() {
    const response = await fetch("/api/pantry", { cache: "no-store" });
    const data = (await response.json()) as { items: PantryItem[] };
    setItems(data.items);
  }

  useEffect(() => {
    void loadItems();
  }, []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    await fetch("/api/pantry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, quantity, unit })
    });
    setName("");
    setQuantity("");
    setUnit("");
    await loadItems();
  }

  async function handleDelete(id: string) {
    await fetch(`/api/pantry/${id}`, { method: "DELETE" });
    await loadItems();
  }

  async function seedSample() {
    await fetch("/api/pantry/seed", { method: "POST" });
    await loadItems();
  }

  function updateReceiptRow(index: number, patch: Partial<ReceiptRow>) {
    setReceiptRows((current) =>
      current.map((row, rowIndex) =>
        rowIndex === index
          ? {
              ...row,
              ...patch
            }
          : row
      )
    );
  }

  async function handleReceiptUpload(event: FormEvent) {
    event.preventDefault();
    setReceiptError(null);
    setReceiptSuccess(null);

    if (!uploadFile) {
      setReceiptError("Select an image file first.");
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", uploadFile);

      const response = await fetch("/api/receipts", {
        method: "POST",
        body: formData
      });

      const data = (await response.json()) as {
        error?: { message?: string } | string;
        receipt?: {
          id: string;
          rows: Array<{
            name: string;
            quantityValue: number | null;
            unit: string | null;
            rawLine: string;
            confidence: number;
            requiresConfirmation: boolean;
          }>;
        };
      };

      if (!response.ok || !data.receipt) {
        const message =
          typeof data.error === "string"
            ? data.error
            : data.error?.message || "Failed to parse receipt image.";
        setReceiptError(message);
        return;
      }

      setReceiptId(data.receipt.id);
      setReceiptRows(
        data.receipt.rows.map((row) => ({
          ...row,
          confirmed: !row.requiresConfirmation
        }))
      );
    } catch {
      setReceiptError("Failed to upload receipt image.");
    } finally {
      setUploading(false);
    }
  }

  async function handleApplyReceipt() {
    if (!receiptId) {
      setReceiptError("Upload a receipt before applying.");
      return;
    }

    setApplying(true);
    setReceiptError(null);
    setReceiptSuccess(null);
    try {
      const response = await fetch(`/api/receipts/${receiptId}/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: receiptRows.map((row) => ({
            name: row.name,
            quantityValue: row.quantityValue,
            unit: row.unit,
            rawLine: row.rawLine,
            confidence: row.confidence,
            confirmed: row.confirmed
          }))
        })
      });
      const data = (await response.json()) as {
        error?: string;
        result?: { created: number; updated: number; skipped: number };
      };

      if (!response.ok || !data.result) {
        setReceiptError(data.error || "Failed to apply receipt.");
        return;
      }

      setReceiptSuccess(
        `Applied receipt: ${data.result.created} created, ${data.result.updated} updated, ${data.result.skipped} skipped.`
      );
      await loadItems();
    } catch {
      setReceiptError("Failed to apply receipt.");
    } finally {
      setApplying(false);
    }
  }

  return (
    <section className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Pantry Items</h1>
        <button
          className="rounded-md bg-brand-700 px-4 py-2 text-sm font-medium text-white"
          onClick={seedSample}
          type="button"
        >
          Seed Sample Pantry
        </button>
      </div>

      <form className="grid gap-3 rounded-xl bg-white p-4 shadow-sm sm:grid-cols-4" onSubmit={handleSubmit}>
        <input
          className="rounded-md border border-slate-300 px-3 py-2"
          onChange={(event) => setName(event.target.value)}
          placeholder="Name"
          required
          value={name}
        />
        <input
          className="rounded-md border border-slate-300 px-3 py-2"
          onChange={(event) => setQuantity(event.target.value)}
          placeholder="Quantity"
          value={quantity}
        />
        <input
          className="rounded-md border border-slate-300 px-3 py-2"
          onChange={(event) => setUnit(event.target.value)}
          placeholder="Unit"
          value={unit}
        />
        <button className="rounded-md bg-brand-500 px-4 py-2 font-medium text-white" type="submit">
          Add
        </button>
      </form>

      <form className="space-y-3 rounded-xl bg-white p-4 shadow-sm" onSubmit={handleReceiptUpload}>
        <h2 className="text-lg font-semibold">Import Receipt Image</h2>
        <p className="text-sm text-slate-600">Supported: jpg, jpeg, png, webp (single image, max 8MB).</p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            onChange={(event) => setUploadFile(event.target.files?.[0] || null)}
            type="file"
          />
          <button
            className="rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            disabled={uploading}
            type="submit"
          >
            {uploading ? "Uploading..." : "Upload Receipt"}
          </button>
        </div>
        {receiptError ? <p className="text-sm text-red-700">{receiptError}</p> : null}
        {receiptSuccess ? <p className="text-sm text-green-700">{receiptSuccess}</p> : null}
      </form>

      {receiptRows.length > 0 ? (
        <div className="space-y-3 rounded-xl bg-white p-4 shadow-sm">
          <h3 className="text-lg font-semibold">Review Parsed Items</h3>
          <div className="overflow-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="p-2">Ingredient</th>
                  <th className="p-2">Quantity</th>
                  <th className="p-2">Unit</th>
                  <th className="p-2">Confidence</th>
                  <th className="p-2">Confirm</th>
                </tr>
              </thead>
              <tbody>
                {receiptRows.map((row, index) => (
                  <tr className="border-b align-top" key={`${row.rawLine}-${index}`}>
                    <td className="p-2">
                      <input
                        className="w-full rounded-md border border-slate-300 px-2 py-1"
                        onChange={(event) => updateReceiptRow(index, { name: event.target.value })}
                        value={row.name}
                      />
                    </td>
                    <td className="p-2">
                      <input
                        className="w-24 rounded-md border border-slate-300 px-2 py-1"
                        onChange={(event) =>
                          updateReceiptRow(index, {
                            quantityValue: event.target.value ? Number(event.target.value) : null
                          })
                        }
                        type="number"
                        value={row.quantityValue ?? ""}
                      />
                    </td>
                    <td className="p-2">
                      <input
                        className="w-24 rounded-md border border-slate-300 px-2 py-1"
                        onChange={(event) => updateReceiptRow(index, { unit: event.target.value || null })}
                        value={row.unit ?? ""}
                      />
                    </td>
                    <td className="p-2">{Math.round(row.confidence * 100)}%</td>
                    <td className="p-2">
                      <label className="inline-flex items-center gap-2">
                        <input
                          checked={row.confirmed}
                          onChange={(event) => updateReceiptRow(index, { confirmed: event.target.checked })}
                          type="checkbox"
                        />
                        <span className={row.requiresConfirmation ? "text-amber-700" : "text-slate-600"}>
                          {row.requiresConfirmation ? "Required" : "Optional"}
                        </span>
                      </label>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            className="rounded-md bg-brand-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            disabled={applying}
            onClick={handleApplyReceipt}
            type="button"
          >
            {applying ? "Applying..." : "Apply to Pantry"}
          </button>
        </div>
      ) : null}

      <ul className="space-y-2">
        {items.map((item) => (
          <li className="flex items-center justify-between rounded-lg bg-white p-4 shadow-sm" key={item.id}>
            <div>
              <p className="font-medium">{item.name}</p>
              <p className="text-sm text-slate-600">
                {[item.quantity, item.unit].filter(Boolean).join(" ") || "No quantity"}
              </p>
            </div>
            <button
              className="rounded-md border border-red-300 px-3 py-1 text-sm text-red-700"
              onClick={() => handleDelete(item.id)}
              type="button"
            >
              Delete
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
