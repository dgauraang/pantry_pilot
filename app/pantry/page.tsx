"use client";

import { FormEvent, useEffect, useState } from "react";

type PantryItem = {
  id: string;
  name: string;
  quantity?: string | null;
  unit?: string | null;
};

export default function PantryPage() {
  const [items, setItems] = useState<PantryItem[]>([]);
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("");

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
