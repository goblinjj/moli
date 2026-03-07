import type { Recipe, PriceConfig } from "./types";

export function generateDefaultConfig(recipes: Recipe[]): PriceConfig {
  const materialPrices: Record<string, number> = {};

  for (const recipe of recipes) {
    for (const mat of recipe.materials) {
      if (mat.name in materialPrices) continue;

      if (mat.name.endsWith("條")) {
        materialPrices[mat.name] = mat.materialLevel * 20;
      } else {
        materialPrices[mat.name] = mat.materialLevel * 1;
      }
    }
  }

  const recipeMpCosts: Record<string, number> = {};
  for (const recipe of recipes) {
    recipeMpCosts[recipe.id] = recipe.mpCost;
  }

  return {
    materialPrices,
    recipeMpCosts,
    markupRates: { bow: 20, cooking: 20 },
  };
}
