import { useState, useCallback } from "react";
import type { PriceConfig, Recipe, Category } from "../lib/types";
import { generateDefaultConfig } from "../lib/defaults";

interface PriceSettingsProps {
  config: PriceConfig;
  recipes: Recipe[];
  onChange: (config: PriceConfig) => void;
}

const CATEGORY_LABELS: Record<Category, string> = {
  bow: "造弓",
  cooking: "料理",
};

interface CollapsibleSectionProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

function CollapsibleSection({ title, children, defaultOpen = false }: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-t border-slate-700/50">
      <button
        type="button"
        className="w-full flex items-center justify-between py-2.5 px-1 text-sm font-semibold text-slate-300 hover:text-white transition-colors"
        onClick={() => setOpen((v) => !v)}
      >
        <span>{title}</span>
        <svg
          className={`w-3.5 h-3.5 text-slate-500 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      <div className={`card-expand overflow-hidden ${open ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0"}`}>
        <div className="pb-3">{children}</div>
      </div>
    </div>
  );
}

export default function PriceSettings({ config, recipes, onChange }: PriceSettingsProps) {
  const updateConfig = useCallback(
    (patch: Partial<PriceConfig>) => {
      onChange({ ...config, ...patch });
    },
    [config, onChange],
  );

  // Collect unique materials grouped by level
  const materialsByLevel = new Map<number, { name: string; image: string }[]>();
  const seen = new Set<string>();
  for (const recipe of recipes) {
    for (const mat of recipe.materials) {
      if (!seen.has(mat.name)) {
        seen.add(mat.name);
        const level = mat.materialLevel;
        if (!materialsByLevel.has(level)) {
          materialsByLevel.set(level, []);
        }
        materialsByLevel.get(level)!.push({ name: mat.name, image: mat.image });
      }
    }
  }
  const sortedLevels = [...materialsByLevel.keys()].sort((a, b) => a - b);

  // Group recipes by category
  const recipesByCategory = new Map<Category, Recipe[]>();
  for (const recipe of recipes) {
    if (!recipesByCategory.has(recipe.category)) {
      recipesByCategory.set(recipe.category, []);
    }
    recipesByCategory.get(recipe.category)!.push(recipe);
  }

  const handleReset = () => {
    onChange(generateDefaultConfig(recipes));
  };

  return (
    <div className="w-[280px] shrink-0 bg-slate-800 text-slate-300 text-sm overflow-y-auto h-full flex flex-col">
      <div className="p-3 space-y-3 flex-1 overflow-y-auto">
        {/* 补魔单价 */}
        <div>
          <label className="block text-xs font-semibold text-slate-200 mb-1">补魔单价</label>
          <input
            type="number"
            className="w-20 bg-slate-700 border border-slate-600 rounded px-2 py-1 text-right text-slate-100 text-sm focus:outline-none focus:border-blue-400"
            value={config.mpPrice}
            min={0}
            onChange={(e) => updateConfig({ mpPrice: Number(e.target.value) || 0 })}
          />
        </div>

        {/* 加价比例 */}
        <div>
          <label className="block text-xs font-semibold text-slate-200 mb-1">加价比例</label>
          <div className="space-y-1">
            {(["bow", "cooking"] as Category[]).map((cat) => (
              <div key={cat} className="flex items-center justify-between">
                <span>{CATEGORY_LABELS[cat]}</span>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    className="w-20 bg-slate-700 border border-slate-600 rounded px-2 py-1 text-right text-slate-100 text-sm focus:outline-none focus:border-blue-400"
                    value={config.markupRates[cat]}
                    min={0}
                    onChange={(e) =>
                      updateConfig({
                        markupRates: {
                          ...config.markupRates,
                          [cat]: Number(e.target.value) || 0,
                        },
                      })
                    }
                  />
                  <span className="text-xs text-slate-400">%</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 材料价格 */}
        <CollapsibleSection title="材料价格">
          <div className="space-y-2">
            {sortedLevels.map((level) => (
              <div key={level}>
                <div className="text-xs font-semibold text-slate-400 mb-1">{level}级材料</div>
                <div className="space-y-1">
                  {materialsByLevel.get(level)!.map((mat) => (
                    <div key={mat.name} className="flex items-center justify-between gap-1">
                      <div className="flex items-center gap-1 min-w-0 flex-1">
                        <img
                          src={`/items/${mat.image}`}
                          alt={mat.name}
                          className="w-6 h-6 shrink-0 object-contain"
                        />
                        <span className="truncate text-xs">{mat.name}</span>
                      </div>
                      <input
                        type="number"
                        className="w-20 bg-slate-700 border border-slate-600 rounded px-2 py-1 text-right text-slate-100 text-sm focus:outline-none focus:border-blue-400 shrink-0"
                        value={config.materialPrices[mat.name] ?? 0}
                        min={0}
                        onChange={(e) =>
                          updateConfig({
                            materialPrices: {
                              ...config.materialPrices,
                              [mat.name]: Number(e.target.value) || 0,
                            },
                          })
                        }
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CollapsibleSection>

        {/* 耗魔量 */}
        <CollapsibleSection title="耗魔量">
          <div className="space-y-2">
            {(["bow", "cooking"] as Category[]).map((cat) => {
              const catRecipes = recipesByCategory.get(cat);
              if (!catRecipes || catRecipes.length === 0) return null;
              return (
                <div key={cat}>
                  <div className="text-xs font-semibold text-slate-400 mb-1">
                    {CATEGORY_LABELS[cat]}
                  </div>
                  <div className="space-y-1">
                    {catRecipes.map((recipe) => (
                      <div key={recipe.id} className="flex items-center justify-between gap-1">
                        <span className="truncate text-xs flex-1 min-w-0">{recipe.name}</span>
                        <input
                          type="number"
                          className="w-20 bg-slate-700 border border-slate-600 rounded px-2 py-1 text-right text-slate-100 text-sm focus:outline-none focus:border-blue-400 shrink-0"
                          value={config.recipeMpCosts[recipe.id] ?? recipe.mpCost}
                          min={0}
                          onChange={(e) =>
                            updateConfig({
                              recipeMpCosts: {
                                ...config.recipeMpCosts,
                                [recipe.id]: Number(e.target.value) || 0,
                              },
                            })
                          }
                        />
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </CollapsibleSection>
      </div>

      {/* 重置按钮 */}
      <div className="p-3 border-t border-slate-600">
        <button
          type="button"
          className="w-full bg-slate-600 hover:bg-slate-500 text-slate-200 text-sm py-1.5 rounded transition-colors"
          onClick={handleReset}
        >
          重置为默认值
        </button>
      </div>
    </div>
  );
}
