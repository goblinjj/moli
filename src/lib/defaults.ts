import type { Recipe, PriceConfig } from "./types";

// 布料成品商店價格
const CLOTH_SHOP_PRICES: Record<string, number> = {
  "麻布": 120,
  "木棉布": 150,
  "毛氈": 174,
  "綿": 198,
  "細線": 240,
  "絹布": 300,
  "莎蓮娜紗布": 1800,
  "傑諾瓦紗布": 2160,
  "阿巴尼斯製的線": 800,
  "阿巴尼斯製的布": 800,
  "細麻布": 2340,
  "開米士毛線": 3060,
};

export function generateDefaultConfig(recipes: Recipe[]): PriceConfig {
  const materialPrices: Record<string, number> = {};

  for (const recipe of recipes) {
    for (const mat of recipe.materials) {
      if (mat.name in materialPrices) continue;

      if (mat.name in CLOTH_SHOP_PRICES) {
        materialPrices[mat.name] = CLOTH_SHOP_PRICES[mat.name];
      } else if (mat.name.endsWith("條")) {
        materialPrices[mat.name] = mat.materialLevel * 10;
      } else {
        materialPrices[mat.name] = mat.materialLevel / 2;
      }
    }
  }

  const recipeMpCosts: Record<string, number> = {};
  for (const recipe of recipes) {
    recipeMpCosts[recipe.id] = recipe.mpCost;
  }

  // Build default markup rates from all categories found in recipes
  const markupRates: Record<string, number> = {};
  for (const recipe of recipes) {
    if (!(recipe.category in markupRates)) {
      markupRates[recipe.category] = 20;
    }
  }

  return {
    materialPrices,
    recipeMpCosts,
    markupRates,
  };
}
