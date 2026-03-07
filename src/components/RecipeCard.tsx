import { useState } from "react";
import type { Recipe, CostBreakdown } from "../lib/types";

interface RecipeCardProps {
  recipe: Recipe;
  breakdown: CostBreakdown;
}

export default function RecipeCard({ recipe, breakdown }: RecipeCardProps) {
  const [expanded, setExpanded] = useState(false);

  const markup =
    breakdown.totalCost > 0
      ? Math.round(((breakdown.sellingPrice - breakdown.totalCost) / breakdown.totalCost) * 100)
      : 0;

  return (
    <div
      className="bg-white rounded-lg shadow hover:shadow-md transition-shadow cursor-pointer select-none"
      onClick={() => setExpanded((prev) => !prev)}
    >
      {/* Collapsed header */}
      <div className="flex items-center gap-3 p-3">
        <img
          src={`/items/${recipe.image}`}
          alt={recipe.name}
          className="w-12 h-12 object-contain flex-shrink-0"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-bold text-gray-900 truncate">{recipe.name}</span>
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-700 flex-shrink-0">
              Lv.{recipe.level}{recipe.variant}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-1 text-sm">
            <span className="text-gray-500">成本: {breakdown.totalCost}</span>
            <span className="text-amber-600 font-medium">售价: {breakdown.sellingPrice}</span>
          </div>
        </div>
        <svg
          className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {/* Expanded detail section */}
      <div
        className={`overflow-hidden transition-all duration-200 ${expanded ? "max-h-[600px] opacity-100" : "max-h-0 opacity-0"}`}
      >
        <div className="border-t border-gray-100 px-4 py-3 text-sm space-y-2">
          {/* Material breakdown */}
          {breakdown.materialCosts.map((mat) => {
            const isSubRecipe = mat.unitPrice !== Math.round(mat.unitPrice) || mat.total !== mat.unitPrice * mat.quantity;
            return (
              <div
                key={mat.name}
                className={`flex items-center gap-2 ${isSubRecipe ? "text-indigo-700 italic" : "text-gray-700"}`}
              >
                <img
                  src={`/items/${mat.image}`}
                  alt={mat.name}
                  className="w-6 h-6 object-contain flex-shrink-0"
                />
                <span className="truncate">{mat.name}</span>
                <span className="text-gray-400 flex-shrink-0">x{mat.quantity}</span>
                <span className="text-gray-400 text-xs flex-shrink-0">(@{mat.unitPrice}元)</span>
                <span className="ml-auto font-medium flex-shrink-0">= {mat.total}元</span>
              </div>
            );
          })}

          {/* MP cost row */}
          <div className="flex items-center gap-2 text-gray-700">
            <span className="w-6 h-6 flex items-center justify-center text-blue-500 flex-shrink-0 text-xs font-bold">
              MP
            </span>
            <span>补魔: {breakdown.mpCost}点</span>
            <span className="ml-auto font-medium flex-shrink-0">= {breakdown.mpTotal}元</span>
          </div>

          {/* Separator */}
          <hr className="border-gray-200" />

          {/* Total cost */}
          <div className="flex items-center justify-between font-bold text-gray-900">
            <span>成本合计:</span>
            <span>{breakdown.totalCost}元</span>
          </div>

          {/* Selling price */}
          <div className="flex items-center justify-between font-medium text-amber-600">
            <span>售卖价格:</span>
            <span>{breakdown.sellingPrice}元 (+{markup}%)</span>
          </div>
        </div>
      </div>
    </div>
  );
}
