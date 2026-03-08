import { useState } from "react";
import type { Gem } from "../lib/types";

interface GemCardProps {
  gem: Gem;
}

export default function GemCard({ gem }: GemCardProps) {
  const [expanded, setExpanded] = useState(false);

  const minLevel = gem.levels[0]?.level ?? 0;
  const maxLevel = gem.levels[gem.levels.length - 1]?.level ?? 0;
  const levelLabel = minLevel === maxLevel ? `Lv.${minLevel}` : `Lv.${minLevel}~${maxLevel}`;

  const targets = [...new Set(gem.levels.flatMap((l) => l.effects.map((e) => e.target)))];
  const targetLabels: Record<string, string> = { weapon: "武器", armor: "防具", accessory: "飾品" };

  const firstEffect = gem.levels[0]?.effects[0]?.description ?? "";
  const lastEffect = gem.levels.length > 1 ? gem.levels[gem.levels.length - 1]?.effects[0]?.description ?? "" : "";

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md hover:border-gray-200 transition-all duration-200 select-none">
      {/* Header */}
      <div className="flex items-center gap-3 p-3.5 cursor-pointer" onClick={() => setExpanded((prev) => !prev)}>
        <div className="w-12 h-12 rounded-lg bg-gray-50 flex items-center justify-center flex-shrink-0">
          <img src={`/items/${gem.image}`} alt={gem.name} className="w-10 h-10 object-contain" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-bold text-gray-900 truncate text-sm">{gem.name}</span>
            <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[11px] font-semibold bg-accent-50 text-accent-700 flex-shrink-0">
              {levelLabel}
            </span>
          </div>
          <div className="text-[11px] text-gray-400 mt-0.5 truncate">
            {firstEffect}
            {lastEffect && ` ~ ${lastEffect}`}
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

      {/* Expanded detail */}
      <div className={`card-expand overflow-hidden ${expanded ? "max-h-[800px] opacity-100" : "max-h-0 opacity-0"}`}>
        <div className="border-t border-gray-100 px-4 py-3 text-sm overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-400 border-b border-gray-100">
                <th className="text-left py-1.5 font-medium pr-3">等級</th>
                {targets.map((t) => (
                  <th key={t} className="text-left py-1.5 font-medium pr-3">
                    {targetLabels[t] || t}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {gem.levels.map((lv) => (
                <tr key={lv.level} className="border-t border-gray-50 hover:bg-gray-50/50">
                  <td className="py-1.5 text-gray-500 font-mono pr-3 whitespace-nowrap">
                    <span className="text-accent-600">Lv.{lv.level}</span>{" "}
                    <span className="text-gray-300 text-[10px]">{lv.grade}</span>
                  </td>
                  {targets.map((t) => {
                    const effect = lv.effects.find((e) => e.target === t);
                    return (
                      <td key={t} className="py-1.5 text-gray-600 pr-3 whitespace-nowrap">
                        {effect?.description || "-"}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
