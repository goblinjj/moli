import { useState, useEffect, useMemo, useCallback } from "react";
import type { Recipe, PriceConfig, Category } from "../lib/types";
import { calculateCost } from "../lib/calculator";
import { generateDefaultConfig } from "../lib/defaults";
import { loadConfig, saveConfig } from "../lib/storage";
import SearchFilter from "./SearchFilter";
import RecipeCard from "./RecipeCard";

interface CalculatorProps {
  recipes: Recipe[];
}

const CATEGORY_GROUPS: { group: string; items: { id: Category; label: string }[] }[] = [
  {
    group: "武器",
    items: [
      { id: "sword", label: "鑄劍" },
      { id: "axe", label: "造斧" },
      { id: "spear", label: "造槍" },
      { id: "bow", label: "造弓" },
      { id: "staff", label: "造杖" },
      { id: "dagger", label: "小刀" },
      { id: "throw", label: "投擲" },
      { id: "bomb", label: "炸彈" },
    ],
  },
  {
    group: "防具",
    items: [
      { id: "helmet", label: "頭盔" },
      { id: "hat", label: "帽子" },
      { id: "armor", label: "鎧甲" },
      { id: "cloth", label: "衣服" },
      { id: "robe", label: "長袍" },
      { id: "boots", label: "靴子" },
      { id: "shoes", label: "鞋子" },
      { id: "shield", label: "盾牌" },
    ],
  },
  {
    group: "補給",
    items: [
      { id: "cooking", label: "料理" },
      { id: "pharmacy", label: "藥品" },
    ],
  },
  {
    group: "其他",
    items: [
      { id: "accessory", label: "飾品" },
      { id: "dragon", label: "水龍" },
      { id: "fiveC", label: "５Ｃ" },
      { id: "scroll", label: "卷軸" },
    ],
  },
  {
    group: "寵物",
    items: [
      { id: "collar", label: "項圈" },
      { id: "crystal", label: "晶石" },
      { id: "petArmor", label: "裝甲" },
      { id: "petAccessory", label: "飾品" },
      { id: "petCloth", label: "服裝" },
    ],
  },
];

// Flat lookup for label by category id
const CATEGORY_LABELS: Record<string, string> = {};
for (const g of CATEGORY_GROUPS) {
  for (const item of g.items) {
    CATEGORY_LABELS[item.id] = item.label;
  }
}

export default function Calculator({ recipes }: CalculatorProps) {
  const [activeCategory, setActiveCategory] = useState<Category>("sword");
  const [searchQuery, setSearchQuery] = useState("");
  const [levelFilter, setLevelFilter] = useState<number | null>(null);
  const [config, setConfig] = useState<PriceConfig>(() => {
    const defaults = generateDefaultConfig(recipes);
    return loadConfig(defaults);
  });

  // Persist config to localStorage whenever it changes
  useEffect(() => {
    saveConfig(config);
  }, [config]);

  const handleConfigChange = useCallback((newConfig: PriceConfig) => {
    setConfig(newConfig);
  }, []);

  // Filter recipes: category -> search -> level
  const filteredRecipes = useMemo(() => {
    let result = recipes.filter((r) => r.category === activeCategory);

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter((r) => r.name.toLowerCase().includes(q));
    }

    if (levelFilter !== null) {
      result = result.filter((r) => r.level === levelFilter);
    }

    return result;
  }, [recipes, activeCategory, searchQuery, levelFilter]);

  // Max level for the current category
  const maxLevel = useMemo(() => {
    const categoryRecipes = recipes.filter((r) => r.category === activeCategory);
    if (categoryRecipes.length === 0) return 1;
    return Math.max(...categoryRecipes.map((r) => r.level));
  }, [recipes, activeCategory]);

  // Cost breakdowns for all filtered recipes
  const breakdowns = useMemo(() => {
    return filteredRecipes.map((recipe) => ({
      recipe,
      breakdown: calculateCost(recipe, recipes, config),
    }));
  }, [filteredRecipes, recipes, config]);

  // Reset level filter when switching categories
  const handleCategoryChange = useCallback((cat: Category) => {
    setActiveCategory(cat);
    setLevelFilter(null);
    setSearchQuery("");
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-slate-900 text-white px-6 py-3.5 shadow-lg">
        <h1 className="text-lg font-bold tracking-wide select-none">
          <span className="text-accent-500">MR</span>
          <span className="mx-1.5 text-slate-400">|</span>
          魔力宝贝生产计算器
        </h1>
      </header>

      {/* Category navigation */}
      <nav className="bg-white border-b border-gray-200 px-5 lg:px-6 py-2.5 overflow-x-auto scrollbar-hide">
        <div className="flex items-center gap-4">
          {CATEGORY_GROUPS.map((group) => (
            <div key={group.group} className="flex items-center gap-1 flex-shrink-0">
              <span className="text-[11px] text-gray-400 font-medium mr-0.5">{group.group}</span>
              {group.items.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => handleCategoryChange(cat.id)}
                  className={`px-3 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-all duration-150 ${
                    activeCategory === cat.id
                      ? "bg-accent-500 text-white shadow-sm shadow-accent-500/20"
                      : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          ))}
        </div>
      </nav>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto p-5 lg:p-6">
        {/* Toolbar: search + level filter + markup */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 pb-2">
          <SearchFilter
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            levelFilter={levelFilter}
            onLevelChange={setLevelFilter}
            maxLevel={maxLevel}
          />
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <span className="text-gray-400 text-xs">加价</span>
            <input
              type="number"
              className="w-16 bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-right text-gray-700 text-xs font-mono shadow-sm focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500"
              value={config.markupRates[activeCategory] || ''}
              min={0}
              onChange={(e) =>
                handleConfigChange({
                  ...config,
                  markupRates: {
                    ...config.markupRates,
                    [activeCategory]: Number(e.target.value) || 0,
                  },
                })
              }
            />
            <span className="text-gray-400 text-xs">%</span>
          </div>
        </div>

        {breakdowns.length === 0 ? (
          <div className="text-center text-slate-400 mt-16 text-sm">
            没有找到匹配的配方
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mt-4">
            {breakdowns.map(({ recipe, breakdown }) => (
              <RecipeCard key={recipe.id} recipe={recipe} breakdown={breakdown} config={config} onConfigChange={handleConfigChange} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
