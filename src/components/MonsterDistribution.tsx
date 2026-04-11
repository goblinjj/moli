import { useState, useMemo, useCallback } from "react";
import type { MonsterRegion } from "../lib/types";
import MonsterCard from "./MonsterCard";

interface MonsterDistributionProps {
  regions: MonsterRegion[];
}

type MonsterMode = "browse" | "levelGuide";

export default function MonsterDistribution({ regions }: MonsterDistributionProps) {
  const [mode, setMode] = useState<MonsterMode>("browse");
  const [activeRegionIdx, setActiveRegionIdx] = useState(0);
  const [activeLocationId, setActiveLocationId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [playerLevel, setPlayerLevel] = useState<number>(1);

  const activeRegion = regions[activeRegionIdx];

  const activeLocation = useMemo(() => {
    if (!activeRegion) return null;
    if (activeLocationId) {
      return activeRegion.locations.find((l) => l.id === activeLocationId) || activeRegion.locations[0] || null;
    }
    return activeRegion.locations[0] || null;
  }, [activeRegion, activeLocationId]);

  const handleRegionChange = useCallback((idx: number) => {
    setActiveRegionIdx(idx);
    setActiveLocationId(null);
    setSearchQuery("");
  }, []);

  const filteredMonsters = useMemo(() => {
    if (!activeLocation) return [];
    if (!searchQuery.trim()) return activeLocation.monsters;
    const q = searchQuery.trim().toLowerCase();
    return activeLocation.monsters.filter((m) => m.name.toLowerCase().includes(q));
  }, [activeLocation, searchQuery]);

  const levelRecommendations = useMemo(() => {
    if (mode !== "levelGuide") return [];
    const lv = playerLevel;
    const results: {
      monster: { name: string; levelMin: number; levelMax: number; earth: number; water: number; fire: number; wind: number; type: string; typeDetail: string; cardGrade: string; sealable: boolean; encounterCount: string; crystals: string[]; isBoss: boolean; image: string };
      locationName: string;
      regionName: string;
      avgLevel: number;
      diff: number;
    }[] = [];

    for (const region of regions) {
      for (const loc of region.locations) {
        for (const m of loc.monsters) {
          if (m.isBoss) continue;
          const avgLevel = Math.round((m.levelMin + m.levelMax) / 2);
          const diff = avgLevel - lv;
          if (diff >= -10 && diff <= 10) {
            results.push({
              monster: m,
              locationName: loc.name,
              regionName: region.name,
              avgLevel,
              diff,
            });
          }
        }
      }
    }

    results.sort((a, b) => {
      const aOptimal = a.diff >= 3 && a.diff <= 7;
      const bOptimal = b.diff >= 3 && b.diff <= 7;
      if (aOptimal !== bOptimal) return aOptimal ? -1 : 1;
      return Math.abs(a.diff - 5) - Math.abs(b.diff - 5);
    });

    const seen = new Set<string>();
    return results.filter((r) => {
      const key = `${r.monster.name}-${r.locationName}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [mode, playerLevel, regions]);

  return (
    <>
      <nav className="bg-white border-b border-gray-200">
        <div className="flex items-center gap-1.5 px-5 lg:px-6 py-2">
          <button
            type="button"
            onClick={() => setMode("browse")}
            className={`px-3.5 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-all duration-150 ${
              mode === "browse"
                ? "bg-accent-500 text-white shadow-sm shadow-accent-500/20"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-900"
            }`}
          >
            地图浏览
          </button>
          <button
            type="button"
            onClick={() => setMode("levelGuide")}
            className={`px-3.5 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-all duration-150 ${
              mode === "levelGuide"
                ? "bg-accent-500 text-white shadow-sm shadow-accent-500/20"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-900"
            }`}
          >
            练级推荐
          </button>
        </div>
      </nav>

      {mode === "browse" && (
        <>
          <nav className="bg-white border-b border-gray-200">
            <div className="flex px-5 lg:px-6 gap-0 border-b border-gray-100 overflow-x-auto scrollbar-hide">
              {regions.map((region, idx) => (
                <button
                  key={region.id}
                  type="button"
                  onClick={() => handleRegionChange(idx)}
                  className={`px-3 lg:px-4 py-2 text-xs lg:text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                    activeRegionIdx === idx
                      ? "border-accent-500 text-accent-600"
                      : "border-transparent text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {region.name}
                </button>
              ))}
            </div>
            {activeRegion && (
              <div className="flex items-center gap-1.5 px-5 lg:px-6 py-2 overflow-x-auto scrollbar-hide">
                {activeRegion.locations.map((loc) => (
                  <button
                    key={loc.id}
                    type="button"
                    onClick={() => {
                      setActiveLocationId(loc.id);
                      setSearchQuery("");
                    }}
                    className={`px-3.5 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-all duration-150 ${
                      activeLocation?.id === loc.id
                        ? "bg-accent-500 text-white shadow-sm shadow-accent-500/20"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-900"
                    }`}
                  >
                    {loc.name}
                  </button>
                ))}
              </div>
            )}
          </nav>

          <main className="flex-1 overflow-y-auto p-5 lg:p-6">
            <div className="flex items-center gap-3 pb-2">
              <div className="relative flex-1 max-w-xs">
                <input
                  type="text"
                  placeholder="搜索魔物名称..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-white border border-gray-200 rounded-lg pl-8 pr-3 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500"
                />
                <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              {activeLocation && (
                <span className="text-xs text-gray-400">{filteredMonsters.length} 个魔物</span>
              )}
            </div>

            {filteredMonsters.length === 0 ? (
              <div className="text-center text-slate-400 mt-16 text-sm">
                该地点没有魔物数据
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mt-2">
                {filteredMonsters.map((monster, idx) => (
                  <MonsterCard key={`${monster.name}-${idx}`} monster={monster} />
                ))}
              </div>
            )}
          </main>
        </>
      )}

      {mode === "levelGuide" && (
        <main className="flex-1 overflow-y-auto p-5 lg:p-6">
          <div className="flex items-center gap-3 pb-4 flex-wrap">
            <span className="text-sm text-gray-600">当前等级</span>
            <input
              type="number"
              min={1}
              max={160}
              value={playerLevel}
              onChange={(e) => setPlayerLevel(Math.max(1, Math.min(160, Number(e.target.value) || 1)))}
              className="w-20 bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-center font-mono shadow-sm focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500"
            />
            <span className="text-xs text-gray-400">推荐怪物等级高于自身5级可获最高经验</span>
          </div>

          <div className="flex items-center gap-2 mb-4">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-green-100 text-green-700">
              <span className="w-2 h-2 rounded-full bg-green-500" />
              最佳 (+3~+7)
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-yellow-100 text-yellow-700">
              <span className="w-2 h-2 rounded-full bg-yellow-500" />
              可选 (+1~+2, +8~+10)
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-500">
              <span className="w-2 h-2 rounded-full bg-gray-400" />
              偏低 (-1~-10)
            </span>
          </div>

          {levelRecommendations.length === 0 ? (
            <div className="text-center text-slate-400 mt-16 text-sm">
              没有找到适合当前等级的魔物
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {levelRecommendations.slice(0, 60).map((rec, idx) => {
                const diffColor =
                  rec.diff >= 3 && rec.diff <= 7 ? "border-green-300 ring-1 ring-green-200" :
                  rec.diff >= 1 ? "border-yellow-300 ring-1 ring-yellow-200" :
                  "border-gray-200";
                return (
                  <div key={`${rec.monster.name}-${rec.locationName}-${idx}`} className={`bg-white rounded-xl shadow-sm border overflow-hidden ${diffColor}`}>
                    <div className="px-3 pt-2 flex items-center justify-between">
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        rec.diff >= 3 && rec.diff <= 7 ? "bg-green-100 text-green-700" :
                        rec.diff >= 1 ? "bg-yellow-100 text-yellow-700" :
                        "bg-gray-100 text-gray-500"
                      }`}>
                        {rec.diff > 0 ? `+${rec.diff}` : rec.diff} 级
                      </span>
                      <span className="text-[10px] text-gray-400">{rec.regionName} · {rec.locationName}</span>
                    </div>
                    <MonsterCard monster={rec.monster} />
                  </div>
                );
              })}
            </div>
          )}
        </main>
      )}
    </>
  );
}
