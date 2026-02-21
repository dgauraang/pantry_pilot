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
  ignored: boolean;
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
      setReceiptError("Select a receipt file first.");
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
          confirmed: !row.requiresConfirmation,
          ignored: false
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
            confirmed: row.confirmed,
            ignored: row.ignored
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Pantry Items</h1>
          <p className="text-sm text-slate-600">Track ingredients and keep your pantry inventory current.</p>
        </div>
        <button className="btn-secondary" onClick={seedSample} type="button">
          Seed Sample Pantry
        </button>
      </div>

      <form className="card grid gap-3 sm:grid-cols-4" onSubmit={handleSubmit}>
        <div className="sm:col-span-4">
          <h2 className="section-title">Add Ingredient</h2>
          <p className="section-subtitle">Quickly add a pantry item with optional quantity details.</p>
        </div>
        <input
          className="input"
          onChange={(event) => setName(event.target.value)}
          placeholder="Name"
          required
          value={name}
        />
        <input
          className="input"
          onChange={(event) => setQuantity(event.target.value)}
          placeholder="Quantity"
          value={quantity}
        />
        <input
          className="input"
          onChange={(event) => setUnit(event.target.value)}
          placeholder="Unit"
          value={unit}
        />
        <button className="btn-primary" type="submit">
          Add
        </button>
      </form>

      <form className="card space-y-3" onSubmit={handleReceiptUpload}>
        <div className="space-y-1">
          <h2 className="section-title">Import Receipt File</h2>
          <p className="section-subtitle">Supported: jpg, jpeg, png, webp, pdf (single file, max 8MB).</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf"
            className="input"
            onChange={(event) => setUploadFile(event.target.files?.[0] || null)}
            type="file"
          />
          <button className="btn-primary" disabled={uploading} type="submit">
            {uploading ? "Uploading..." : "Upload Receipt"}
          </button>
        </div>
        {receiptError ? <p className="text-sm text-red-700">{receiptError}</p> : null}
        {receiptSuccess ? <p className="text-sm text-green-700">{receiptSuccess}</p> : null}
      </form>

      {receiptRows.length > 0 ? (
        <div className="card space-y-3">
          <div className="space-y-1">
            <h3 className="section-title">Review Parsed Items</h3>
            <p className="section-subtitle">Confirm uncertain rows before applying them to pantry inventory.</p>
          </div>
          <div className="overflow-auto rounded-lg border border-slate-200">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50">
                <tr className="text-left text-slate-700">
                  <th className="p-2 font-semibold">Ingredient</th>
                  <th className="w-28 p-2 font-semibold">Quantity</th>
                  <th className="w-28 p-2 font-semibold">Unit</th>
                  <th className="w-24 p-2 font-semibold">Confidence</th>
                  <th className="w-28 p-2 font-semibold">Confirm</th>
                  <th className="w-24 p-2 font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {receiptRows.map((row, index) => (
                  <tr
                    className={`border-t border-slate-200 odd:bg-white even:bg-slate-50/40 ${
                      row.ignored ? "opacity-60" : ""
                    }`}
                    key={`${row.rawLine}-${index}`}
                  >
                    <td className="p-2">
                      <input
                        className="input w-full"
                        onChange={(event) => updateReceiptRow(index, { name: event.target.value })}
                        value={row.name}
                      />
                    </td>
                    <td className="p-2">
                      <input
                        className="input w-24"
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
                        className="input w-24"
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
                          disabled={row.ignored}
                          type="checkbox"
                        />
                        <span className={row.requiresConfirmation ? "text-amber-700" : "text-slate-600"}>
                          {row.requiresConfirmation ? "Required" : "Optional"}
                        </span>
                      </label>
                    </td>
                    <td className="p-2">
                      <button
                        className="text-sm text-slate-700 underline underline-offset-2 hover:text-slate-900"
                        onClick={() => updateReceiptRow(index, { ignored: !row.ignored })}
                        type="button"
                      >
                        {row.ignored ? "Restore" : "Ignore"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button className="btn-primary" disabled={applying} onClick={handleApplyReceipt} type="button">
            {applying ? "Applying..." : "Apply to Pantry"}
          </button>
        </div>
      ) : null}

      <div className="space-y-3">
        <div className="space-y-1">
          <h2 className="section-title">Current Pantry</h2>
          <p className="section-subtitle">Your saved ingredients appear here.</p>
        </div>
        {items.length === 0 ? (
          <div className="card border-dashed">
            <p className="text-sm text-slate-600">No pantry items yet. Add one manually or import a receipt.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {items.map((item) => (
              <li className="card flex items-center justify-between" key={item.id}>
                <div>
                  <p className="font-medium">{item.name}</p>
                  <p className="text-sm text-slate-600">
                    {[item.quantity, item.unit].filter(Boolean).join(" ") || "No quantity"}
                  </p>
                </div>
                <button className="btn-danger" onClick={() => handleDelete(item.id)} type="button">
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
