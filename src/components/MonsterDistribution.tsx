import { useState, useMemo, useCallback } from "react";
import type { MonsterIsland, MonsterArea } from "../lib/types";
import MonsterCard from "./MonsterCard";

interface Props {
  islands: MonsterIsland[];
}

type Mode = "browse" | "levelGuide";

function LevelGuideCard({ area, diff, avgLevel }: { area: MonsterArea & { islandName?: string; subMapName?: string }; diff: number; avgLevel: number }) {
  const [expanded, setExpanded] = useState(false);
  const nonBoss = area.monsters.filter(m => !m.isBoss);
  const bosses = area.monsters.filter(m => m.isBoss);
  const levelMin = nonBoss.length > 0 ? Math.min(...nonBoss.map(m => m.levelMin)) : 0;
  const levelMax = nonBoss.length > 0 ? Math.max(...nonBoss.map(m => m.levelMax)) : 0;
  const levelText = levelMin === levelMax ? `Lv${levelMin}` : `Lv${levelMin}-${levelMax}`;

  const borderColor =
    diff >= 3 && diff <= 7 ? "border-green-300 ring-1 ring-green-200" :
    diff >= 1 ? "border-yellow-300 ring-1 ring-yellow-200" :
    "border-gray-200";
  const badgeClass =
    diff >= 3 && diff <= 7 ? "bg-green-100 text-green-700" :
    diff >= 1 ? "bg-yellow-100 text-yellow-700" :
    "bg-gray-100 text-gray-500";

  return (
    <div className={`bg-white rounded-xl shadow-sm overflow-hidden ${borderColor}`}>
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left px-3 py-2.5"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${badgeClass}`}>
                {diff > 0 ? `+${diff}` : diff} 级
              </span>
              <span className="font-semibold text-sm text-gray-900 truncate">{area.name}</span>
              {levelMin > 0 && (
                <span className="px-1.5 py-0.5 text-[10px] font-medium bg-slate-100 text-slate-600 rounded tabular-nums">{levelText}</span>
              )}
            </div>
            <div className="text-[10px] text-gray-400 mt-0.5">
              {area.islandName}{area.subMapName && area.subMapName !== area.islandName ? ` · ${area.subMapName}` : ''}
              <span className="ml-2">平均 Lv{avgLevel}</span>
              <span className="ml-2">{nonBoss.length}只魔物{bosses.length > 0 ? ` + ${bosses.length} BOSS` : ''}</span>
            </div>
          </div>
          <svg className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
        {!expanded && area.crystals.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            <span className="text-[10px] text-gray-400">推荐水晶:</span>
            {area.crystals.map((c, i) => (
              <span key={i} className="px-1.5 py-0.5 text-[10px] bg-purple-50 text-purple-600 rounded font-medium">{c}</span>
            ))}
          </div>
        )}
      </button>
      {expanded && (
        <div className="border-t border-gray-100">
          <div className="px-3 py-1">
            {area.crystals.length > 0 && (
              <div className="flex flex-wrap gap-1 py-1.5 border-b border-gray-50">
                <span className="text-[10px] text-gray-400">推荐水晶:</span>
                {area.crystals.map((c, i) => (
                  <span key={i} className="px-1.5 py-0.5 text-[10px] bg-purple-50 text-purple-600 rounded font-medium">{c}</span>
                ))}
              </div>
            )}
            {nonBoss.map((monster, idx) => (
              <MonsterCard key={`${monster.name}-${idx}`} monster={monster} />
            ))}
            {bosses.length > 0 && (
              <>
                <div className="text-[10px] font-bold text-red-500 mt-1 mb-0.5 border-t border-red-100 pt-1">BOSS</div>
                {bosses.map((monster, idx) => (
                  <MonsterCard key={`boss-${monster.name}-${idx}`} monster={monster} />
                ))}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function AreaCard({ area, showLocation }: { area: MonsterArea & { islandName?: string; subMapName?: string }; showLocation?: boolean }) {
  const nonBoss = area.monsters.filter(m => !m.isBoss);
  const bosses = area.monsters.filter(m => m.isBoss);
  const levelMin = nonBoss.length > 0 ? Math.min(...nonBoss.map(m => m.levelMin)) : 0;
  const levelMax = nonBoss.length > 0 ? Math.max(...nonBoss.map(m => m.levelMax)) : 0;
  const levelText = levelMin === levelMax ? `Lv${levelMin}` : `Lv${levelMin}-${levelMax}`;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="px-3 pt-3 pb-2 border-b border-gray-100">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-sm text-gray-900">{area.name}</span>
          {levelMin > 0 && (
            <span className="px-1.5 py-0.5 text-[10px] font-medium bg-slate-100 text-slate-600 rounded tabular-nums">{levelText}</span>
          )}
          {area.encounterCount && (
            <span className="text-[10px] text-gray-400">出現 {area.encounterCount}隻</span>
          )}
        </div>
        {showLocation && area.islandName && (
          <div className="text-[10px] text-gray-400 mt-0.5">
            {area.islandName}{area.subMapName && area.subMapName !== area.islandName ? ` · ${area.subMapName}` : ''}
          </div>
        )}
        {area.crystals.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            <span className="text-[10px] text-gray-400">推荐水晶:</span>
            {area.crystals.map((c, i) => (
              <span key={i} className="px-1.5 py-0.5 text-[10px] bg-purple-50 text-purple-600 rounded font-medium">{c}</span>
            ))}
          </div>
        )}
      </div>
      <div className="px-3 py-1">
        {nonBoss.map((monster, idx) => (
          <MonsterCard key={`${monster.name}-${idx}`} monster={monster} />
        ))}
        {bosses.length > 0 && (
          <>
            <div className="text-[10px] font-bold text-red-500 mt-1 mb-0.5 border-t border-red-100 pt-1">BOSS</div>
            {bosses.map((monster, idx) => (
              <MonsterCard key={`boss-${monster.name}-${idx}`} monster={monster} />
            ))}
          </>
        )}
      </div>
    </div>
  );
}

export default function MonsterDistribution({ islands }: Props) {
  const [mode, setMode] = useState<Mode>("browse");
  const [islandIdx, setIslandIdx] = useState(0);
  const [subMapIdx, setSubMapIdx] = useState(0);
  const [areaIdx, setAreaIdx] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [playerLevel, setPlayerLevel] = useState<number>(1);

  const island = islands[islandIdx];
  const subMap = island?.subMaps[subMapIdx];
  const area = subMap?.areas[areaIdx];

  const handleIslandChange = useCallback((idx: number) => {
    setIslandIdx(idx);
    setSubMapIdx(0);
    setAreaIdx(0);
    setSearchQuery("");
  }, []);

  const handleSubMapChange = useCallback((idx: number) => {
    setSubMapIdx(idx);
    setAreaIdx(0);
    setSearchQuery("");
  }, []);

  // For browse mode: search across all areas of current subMap
  const filteredAreas = useMemo(() => {
    if (!subMap) return [];
    if (!searchQuery.trim()) return subMap.areas;
    const q = searchQuery.trim().toLowerCase();
    return subMap.areas.filter(a =>
      a.name.toLowerCase().includes(q) ||
      a.monsters.some(m => m.name.toLowerCase().includes(q))
    );
  }, [subMap, searchQuery]);

  // For level guide: collect all areas across all islands
  const levelRecommendations = useMemo(() => {
    if (mode !== "levelGuide") return [];
    const lv = playerLevel;
    const results: (MonsterArea & { islandName: string; subMapName: string; avgLevel: number; diff: number })[] = [];

    for (const isl of islands) {
      for (const sm of isl.subMaps) {
        for (const a of sm.areas) {
          const nonBoss = a.monsters.filter(m => !m.isBoss);
          if (nonBoss.length === 0) continue;
          const avgLevel = Math.round(
            nonBoss.reduce((sum, m) => sum + (m.levelMin + m.levelMax) / 2, 0) / nonBoss.length
          );
          const diff = avgLevel - lv;
          if (diff >= -10 && diff <= 10) {
            results.push({ ...a, islandName: isl.name, subMapName: sm.name, avgLevel, diff });
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

    return results;
  }, [mode, playerLevel, islands]);

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
            {/* Level 1: Islands */}
            <div className="flex px-5 lg:px-6 gap-0 border-b border-gray-100 overflow-x-auto scrollbar-hide">
              {islands.map((isl, idx) => (
                <button
                  key={isl.id}
                  type="button"
                  onClick={() => handleIslandChange(idx)}
                  className={`px-3 lg:px-4 py-2 text-xs lg:text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                    islandIdx === idx
                      ? "border-accent-500 text-accent-600"
                      : "border-transparent text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {isl.name}
                </button>
              ))}
            </div>
            {/* Level 2: SubMaps */}
            {island && (
              <div className="flex items-center gap-1.5 px-5 lg:px-6 py-2 overflow-x-auto scrollbar-hide border-b border-gray-100">
                {island.subMaps.map((sm, idx) => (
                  <button
                    key={`${sm.name}-${idx}`}
                    type="button"
                    onClick={() => handleSubMapChange(idx)}
                    className={`px-3.5 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-all duration-150 ${
                      subMapIdx === idx
                        ? "bg-accent-500 text-white shadow-sm shadow-accent-500/20"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-900"
                    }`}
                  >
                    {sm.name}
                  </button>
                ))}
              </div>
            )}
            {/* Level 3: Areas (only if subMap has >1 area) */}
            {subMap && subMap.areas.length > 1 && (
              <div className="flex items-center gap-1.5 px-5 lg:px-6 py-2 overflow-x-auto scrollbar-hide">
                {subMap.areas.map((a, idx) => (
                  <button
                    key={`${a.id}-${idx}`}
                    type="button"
                    onClick={() => { setAreaIdx(idx); setSearchQuery(""); }}
                    className={`px-3 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap transition-all duration-150 ${
                      areaIdx === idx
                        ? "bg-slate-700 text-white"
                        : "bg-gray-50 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                    }`}
                  >
                    {a.name}
                  </button>
                ))}
              </div>
            )}
          </nav>

          <main className="flex-1 overflow-y-auto p-5 lg:p-6">
            <div className="flex items-center gap-3 pb-3">
              <div className="relative flex-1 max-w-xs">
                <input
                  type="text"
                  placeholder="搜索魔物或区域名称..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-white border border-gray-200 rounded-lg pl-8 pr-3 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500"
                />
                <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>

            {searchQuery.trim() ? (
              filteredAreas.length === 0 ? (
                <div className="text-center text-slate-400 mt-16 text-sm">没有找到匹配的魔物或区域</div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                  {filteredAreas.map((a, idx) => (
                    <AreaCard key={`${a.id}-${idx}`} area={a} />
                  ))}
                </div>
              )
            ) : area ? (
              <div className="max-w-2xl">
                <AreaCard area={area} />
              </div>
            ) : (
              <div className="text-center text-slate-400 mt-16 text-sm">该地点没有魔物数据</div>
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
            <span className="text-xs text-gray-400">击杀高于自身5级的怪物可获最高经验</span>
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
            <div className="text-center text-slate-400 mt-16 text-sm">没有找到适合当前等级的区域</div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {levelRecommendations.slice(0, 40).map((rec, idx) => (
                <LevelGuideCard
                  key={`${rec.id}-${rec.islandName}-${idx}`}
                  area={rec}
                  diff={rec.diff}
                  avgLevel={rec.avgLevel}
                />
              ))}
            </div>
          )}
        </main>
      )}
    </>
  );
}
