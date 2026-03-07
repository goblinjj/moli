import { useState, useEffect, useMemo, useCallback } from "react";
import type { Recipe, PriceConfig, Category } from "../lib/types";
import { calculateCost } from "../lib/calculator";
import { generateDefaultConfig } from "../lib/defaults";
import { loadConfig, saveConfig } from "../lib/storage";
import PriceSettings from "./PriceSettings";
import SearchFilter from "./SearchFilter";
import RecipeCard from "./RecipeCard";

interface CalculatorProps {
  recipes: Recipe[];
}

const CATEGORY_LABELS: Record<Category, string> = {
  bow: "造弓",
  cooking: "料理",
};

export default function Calculator({ recipes }: CalculatorProps) {
  const [activeCategory, setActiveCategory] = useState<Category>("bow");
  const [searchQuery, setSearchQuery] = useState("");
  const [levelFilter, setLevelFilter] = useState<number | null>(null);
  const [config, setConfig] = useState<PriceConfig>(() => {
    const defaults = generateDefaultConfig(recipes);
    return loadConfig(defaults);
  });
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
    <div className="min-h-screen bg-slate-100 flex flex-col">
      {/* Header */}
      <header className="bg-slate-800 text-white px-4 py-3 flex items-center justify-between shadow-md">
        <h1 className="text-lg font-bold tracking-wide">魔力宝贝生产计算器</h1>
        <div className="flex items-center gap-2">
          {(["bow", "cooking"] as Category[]).map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => handleCategoryChange(cat)}
              className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${
                activeCategory === cat
                  ? "bg-blue-500 text-white"
                  : "bg-slate-700 text-slate-300 hover:bg-slate-600"
              }`}
            >
              {CATEGORY_LABELS[cat]}
            </button>
          ))}
        </div>
      </header>

      {/* Mobile sidebar toggle */}
      <button
        type="button"
        className="md:hidden fixed bottom-4 right-4 z-50 bg-blue-500 text-white w-12 h-12 rounded-full shadow-lg flex items-center justify-center text-xl"
        onClick={() => setSidebarOpen((v) => !v)}
        aria-label="Toggle price settings"
      >
        {sidebarOpen ? "\u2715" : "\u2699"}
      </button>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Sidebar overlay on mobile */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/40 z-30 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside
          className={`
            fixed md:static z-40 top-0 left-0 h-full md:h-auto
            transform transition-transform duration-200 ease-in-out
            ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
            md:translate-x-0
            overflow-y-auto
          `}
        >
          <PriceSettings config={config} recipes={recipes} onChange={handleConfigChange} />
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto p-4">
          <SearchFilter
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            levelFilter={levelFilter}
            onLevelChange={setLevelFilter}
            maxLevel={maxLevel}
          />

          {breakdowns.length === 0 ? (
            <div className="text-center text-slate-400 mt-12 text-sm">
              没有找到匹配的配方
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-3">
              {breakdowns.map(({ recipe, breakdown }) => (
                <RecipeCard key={recipe.id} recipe={recipe} breakdown={breakdown} />
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
