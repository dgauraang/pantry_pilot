import Link from "next/link";
import { listRecipes } from "@/lib/db/recipes";

export const dynamic = "force-dynamic";

export default async function RecipesPage() {
  const recipes = await listRecipes();

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">Saved Recipes</h1>
      <ul className="space-y-2">
        {recipes.map((recipe) => (
          <li className="rounded-lg bg-white p-4 shadow-sm" key={recipe.id}>
            <Link className="font-medium text-brand-700" href={`/recipes/${recipe.id}`}>
              {recipe.title}
            </Link>
            <p className="text-sm text-slate-600">{new Date(recipe.createdAt).toLocaleString()}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
