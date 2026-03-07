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
      className="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md hover:border-gray-200 transition-all duration-200 cursor-pointer select-none"
      onClick={() => setExpanded((prev) => !prev)}
    >
      {/* Collapsed header */}
      <div className="flex items-center gap-3 p-3.5">
        <div className="w-12 h-12 rounded-lg bg-gray-50 flex items-center justify-center flex-shrink-0">
          <img
            src={`/items/${recipe.image}`}
            alt={recipe.name}
            className="w-10 h-10 object-contain"
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-bold text-gray-900 truncate text-sm">{recipe.name}</span>
            <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[11px] font-semibold bg-accent-50 text-accent-700 flex-shrink-0">
              Lv.{recipe.level}{recipe.variant}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-1 text-sm tabular-nums">
            <span className="text-gray-400 font-mono text-xs">成本 <span className="text-gray-600 font-medium">{breakdown.totalCost}</span></span>
            <span className="text-amber-500 font-mono text-xs">售价 <span className="text-amber-600 font-semibold">{breakdown.sellingPrice}</span></span>
          </div>
        </div>
        <svg
          className={`w-4 h-4 text-gray-300 flex-shrink-0 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
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
        className={`card-expand overflow-hidden ${expanded ? "max-h-[600px] opacity-100" : "max-h-0 opacity-0"}`}
      >
        <div className="border-t border-gray-100 px-4 py-3 text-sm space-y-2">
          {/* Material breakdown */}
          {breakdown.materialCosts.map((mat) => (
              <div
                key={mat.name}
                className={`flex items-center gap-2 ${mat.isSubRecipe ? "text-accent-700 italic" : "text-gray-600"}`}
              >
                <img
                  src={`/items/${mat.image}`}
                  alt={mat.name}
                  className="w-5 h-5 object-contain flex-shrink-0"
                />
                <span className="truncate text-xs">{mat.name}</span>
                <span className="text-gray-400 flex-shrink-0 text-xs font-mono">x{mat.quantity}</span>
                <span className="text-gray-300 text-xs flex-shrink-0 font-mono">@{mat.unitPrice}</span>
                <span className="ml-auto font-medium flex-shrink-0 text-xs font-mono tabular-nums">{mat.total}元</span>
              </div>
          ))}

          {/* MP cost row */}
          <div className="flex items-center gap-2 text-gray-600">
            <span className="w-5 h-5 flex items-center justify-center text-accent-500 flex-shrink-0 text-[10px] font-bold bg-accent-50 rounded">
              MP
            </span>
            <span className="text-xs">补魔 {breakdown.mpCost}点</span>
            <span className="ml-auto font-medium flex-shrink-0 text-xs font-mono tabular-nums">{breakdown.mpTotal}元</span>
          </div>

          {/* Separator */}
          <hr className="border-gray-100" />

          {/* Total cost */}
          <div className="flex items-center justify-between font-bold text-gray-900 text-sm">
            <span>成本合计</span>
            <span className="font-mono tabular-nums">{breakdown.totalCost}元</span>
          </div>

          {/* Selling price */}
          <div className="flex items-center justify-between font-semibold text-amber-600 text-sm">
            <span>售卖价格</span>
            <span className="font-mono tabular-nums">{breakdown.sellingPrice}元 <span className="text-xs text-amber-400">(+{markup}%)</span></span>
          </div>
        </div>
      </div>
    </div>
  );
}
