"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type RecipeView = {
  id: string;
  title: string;
  createdAt: string;
};

export default function RecipesPage() {
  const [recipes, setRecipes] = useState<RecipeView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadRecipes() {
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/recipes", { cache: "no-store" });
      const payload = (await response.json()) as {
        recipes?: RecipeView[];
        error?: string;
      };

      if (!response.ok || !payload.recipes) {
        setError(payload.error || "Failed to load recipes.");
        return;
      }

      setRecipes(payload.recipes);
    } catch {
      setError("Failed to load recipes.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadRecipes();
  }, []);

  async function deleteRecipe(id: string) {
    const response = await fetch(`/api/recipes/${id}`, { method: "DELETE" });
    if (!response.ok) {
      setError("Failed to delete recipe.");
      return;
    }

    setRecipes((current) => current.filter((recipe) => recipe.id !== id));
  }

  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Saved Recipes</h1>
        <p className="text-sm text-slate-600">Browse your generated recipes and remove outdated ones.</p>
      </div>

      {loading ? (
        <div className="card border-dashed">
          <p className="text-sm text-slate-600">Loading recipes...</p>
        </div>
      ) : null}
      {error ? <p className="rounded-md bg-red-100 p-3 text-red-700">{error}</p> : null}

      <ul className="space-y-2">
        {recipes.map((recipe) => (
          <li className="card flex items-center justify-between gap-3" key={recipe.id}>
            <div>
              <Link className="font-medium text-brand-700 hover:underline" href={`/recipes/${recipe.id}`}>
                {recipe.title}
              </Link>
              <p className="text-sm text-slate-600">{new Date(recipe.createdAt).toLocaleString()}</p>
            </div>
            <button className="btn-danger" onClick={() => deleteRecipe(recipe.id)} type="button">
              Delete
            </button>
          </li>
        ))}
      </ul>

      {!loading && recipes.length === 0 ? (
        <div className="card border-dashed">
          <p className="text-sm text-slate-600">No saved recipes yet.</p>
        </div>
      ) : null}
    </section>
  );
}
