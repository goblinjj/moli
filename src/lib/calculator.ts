import type { Recipe, PriceConfig, CostBreakdown } from "./types";

export function calculateCost(
  recipe: Recipe,
  allRecipes: Recipe[],
  config: PriceConfig,
  visited: Set<string> = new Set()
): CostBreakdown {
  const mpCostPoints = config.recipeMpCosts[recipe.id] ?? recipe.mpCost;
  const mpTotal = mpCostPoints;

  // Build a map of product names → recipes for recursive lookup
  const recipeByName = new Map<string, Recipe>();
  for (const r of allRecipes) {
    recipeByName.set(r.name, r);
  }

  visited.add(recipe.id);

  const materialCosts = recipe.materials.map((mat) => {
    let unitPrice: number;
    const subRecipe = recipeByName.get(mat.name);

    let isSubRecipe = false;
    if (subRecipe && !visited.has(subRecipe.id)) {
      // Recursive: material is a product in the recipe list
      const subCost = calculateCost(subRecipe, allRecipes, config, new Set(visited));
      unitPrice = subCost.totalCost;
      isSubRecipe = true;
    } else {
      // Base material or circular dependency fallback
      unitPrice = config.materialPrices[mat.name] ?? 1;
    }

    return {
      name: mat.name,
      quantity: mat.quantity,
      unitPrice,
      total: unitPrice * mat.quantity,
      image: mat.image,
      isSubRecipe,
    };
  });

  const materialTotal = materialCosts.reduce((sum, m) => sum + m.total, 0);
  const totalCost = materialTotal + mpTotal;
  const markupRate = config.markupRates[recipe.category] ?? 0;
  const sellingPrice = Math.ceil(totalCost * (1 + markupRate / 100));

  return { materialCosts, mpCost: mpCostPoints, mpTotal, totalCost, sellingPrice };
}
