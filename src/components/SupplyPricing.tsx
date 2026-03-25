import { useState, useEffect, useMemo, useCallback } from "react";
import type { Recipe } from "../lib/types";
import { loadPricingRatios, savePricingRatios } from "../lib/storage";

interface SupplyPricingProps {
  recipes: Recipe[];
}

const DEFAULT_RATIO = 1.5;

// Blood-magic pool discount rates by level (1-10)
const POOL_DISCOUNT: Record<number, number> = {
  1: 0.45, 2: 0.50, 3: 0.55, 4: 0.60, 5: 0.65,
  6: 0.70, 7: 0.75, 8: 0.80, 9: 0.85, 10: 0.90,
};

type Tab = "cooking" | "pharmacy";

export default function SupplyPricing({ recipes }: SupplyPricingProps) {
  const [activeTab, setActiveTab] = useState<Tab>("cooking");
  const [levelFilter, setLevelFilter] = useState<number | null>(null);
  const [ratios, setRatios] = useState<Record<string, number>>(() => loadPricingRatios());

  useEffect(() => {
    savePricingRatios(ratios);
  }, [ratios]);

  // Reset level filter when switching tabs
  const handleTabChange = useCallback((tab: Tab) => {
    setActiveTab(tab);
    setLevelFilter(null);
  }, []);

  const allItems = useMemo(() => {
    return recipes.filter(
      (r) =>
        r.category === activeTab &&
        r.level >= 1 &&
        r.level <= 10 &&
        r.recoveryValue != null &&
        r.recoveryValue > 0
    ).sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
  }, [recipes, activeTab]);

  const items = useMemo(() => {
    if (levelFilter === null) return allItems;
    return allItems.filter((r) => r.level === levelFilter);
  }, [allItems, levelFilter]);

  const availableLevels = useMemo(() => {
    const levels = new Set(allItems.map((r) => r.level));
    return Array.from(levels).sort((a, b) => a - b);
  }, [allItems]);

  const getRatio = useCallback(
    (id: string) => ratios[id] ?? DEFAULT_RATIO,
    [ratios]
  );

  const handleRatioChange = useCallback((id: string, value: number) => {
    setRatios((prev) => ({ ...prev, [id]: value }));
  }, []);

  const formatNumber = (n: number) =>
    Number.isInteger(n) ? n.toLocaleString() : n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div>
      {/* Tab switch: 料理 / 血瓶 */}
      <div className="flex gap-1.5 mb-4">
        {([
          { id: "cooking" as Tab, label: "料理" },
          { id: "pharmacy" as Tab, label: "血瓶" },
        ]).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => handleTabChange(tab.id)}
            className={`px-3.5 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-all duration-150 ${
              activeTab === tab.id
                ? "bg-accent-500 text-white shadow-sm shadow-accent-500/20"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-900"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Level filter */}
      <div className="flex items-center gap-1.5 mb-4 overflow-x-auto scrollbar-hide">
        <button
          type="button"
          onClick={() => setLevelFilter(null)}
          className={`px-2.5 py-0.5 rounded-full text-xs font-medium transition-all duration-150 ${
            levelFilter === null
              ? "bg-accent-500 text-white shadow-sm shadow-accent-500/20"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-900"
          }`}
        >
          全部
        </button>
        {availableLevels.map((lv) => (
          <button
            key={lv}
            type="button"
            onClick={() => setLevelFilter(lv === levelFilter ? null : lv)}
            className={`px-2.5 py-0.5 rounded-full text-xs font-medium transition-all duration-150 ${
              levelFilter === lv
                ? "bg-accent-500 text-white shadow-sm shadow-accent-500/20"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-900"
            }`}
          >
            Lv.{lv}
          </button>
        ))}
      </div>

      {/* Pricing table */}
      {items.length === 0 ? (
        <div className="text-center text-slate-400 mt-16 text-sm">没有找到数据</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-left text-gray-500 text-xs border-b border-gray-200 sticky top-0 bg-white">
                <th className="py-2 px-2 font-medium">图标</th>
                <th className="py-2 px-2 font-medium">名称</th>
                <th className="py-2 px-2 font-medium text-center hidden md:table-cell">等级</th>
                <th className="py-2 px-2 font-medium text-right hidden md:table-cell">回复值</th>
                <th className="py-2 px-2 font-medium text-center">比例</th>
                <th className="py-2 px-2 font-medium text-right">单价</th>
                <th className="py-2 px-2 font-medium text-right hidden md:table-cell">一组(×5)</th>
                <th className="py-2 px-2 font-medium text-right">一箱(×50)</th>
                <th className="py-2 px-2 font-medium text-right">血魔池每点成本</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const ratio = getRatio(item.id);
                const unitPrice = item.recoveryValue! * ratio;
                const groupPrice = unitPrice * 5;
                const boxPrice = unitPrice * 50;
                const discount = POOL_DISCOUNT[item.level] ?? 1;
                const poolCost = unitPrice / (item.recoveryValue! * discount);

                return (
                  <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-2 px-2">
                      <img
                        src={`/items/${item.image}`}
                        alt={item.name}
                        className="w-8 h-8 object-contain"
                      />
                    </td>
                    <td className="py-2 px-2 font-medium text-gray-800">{item.name}</td>
                    <td className="py-2 px-2 text-center text-gray-600 hidden md:table-cell">{item.level}</td>
                    <td className="py-2 px-2 text-right tabular-nums text-gray-700 hidden md:table-cell">
                      {item.recoveryValue!.toLocaleString()}
                    </td>
                    <td className="py-2 px-2 text-center">
                      <input
                        type="number"
                        className="w-16 bg-white border border-gray-200 rounded-lg px-2 py-1 text-right text-gray-700 text-xs font-mono shadow-sm focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500"
                        value={ratio}
                        min={0}
                        step={0.1}
                        onChange={(e) =>
                          handleRatioChange(item.id, Number(e.target.value) || 0)
                        }
                      />
                    </td>
                    <td className="py-2 px-2 text-right tabular-nums text-gray-700">
                      {formatNumber(unitPrice)}
                    </td>
                    <td className="py-2 px-2 text-right tabular-nums text-gray-700 hidden md:table-cell">
                      {formatNumber(groupPrice)}
                    </td>
                    <td className="py-2 px-2 text-right tabular-nums text-gray-700">
                      {formatNumber(boxPrice)}
                    </td>
                    <td className="py-2 px-2 text-right tabular-nums text-gray-700">
                      {formatNumber(poolCost)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
