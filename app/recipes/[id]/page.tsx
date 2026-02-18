import { notFound } from "next/navigation";
import { getRecipeById } from "@/lib/db/recipes";

export const dynamic = "force-dynamic";

export default async function RecipeDetailPage({
  params
}: {
  params: { id: string };
}) {
  const recipe = await getRecipeById(params.id);

  if (!recipe) {
    notFound();
  }

  return (
    <section className="space-y-4 rounded-xl bg-white p-5 shadow-sm">
      <h1 className="text-2xl font-semibold">{recipe.title}</h1>
      <p className="text-slate-700">{recipe.notes}</p>
      <div>
        <h2 className="font-medium">Ingredients</h2>
        <ul className="list-disc pl-5 text-slate-700">
          {recipe.ingredients.map((ingredient) => (
            <li key={ingredient}>{ingredient}</li>
          ))}
        </ul>
      </div>
      <div>
        <h2 className="font-medium">Steps</h2>
        <ol className="list-decimal pl-5 text-slate-700">
          {recipe.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </div>
    </section>
  );
}
