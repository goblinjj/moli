import type { Monster } from "../lib/types";

const ELEMENT_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  earth: { bg: "bg-green-500", text: "text-green-700", label: "地" },
  water: { bg: "bg-blue-500", text: "text-blue-700", label: "水" },
  fire: { bg: "bg-red-500", text: "text-red-700", label: "火" },
  wind: { bg: "bg-yellow-500", text: "text-yellow-700", label: "風" },
};

function ElementBar({ element, value }: { element: string; value: number }) {
  const { bg, text, label } = ELEMENT_COLORS[element];
  if (value === 0) return null;
  return (
    <div className="flex items-center gap-1.5">
      <span className={`text-[10px] font-bold ${text} w-3`}>{label}</span>
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full ${bg} rounded-full`} style={{ width: `${value * 10}%` }} />
      </div>
      <span className="text-[10px] text-gray-500 tabular-nums w-4 text-right">{value}</span>
    </div>
  );
}

interface MonsterCardProps {
  monster: Monster;
  locationName?: string;
  regionName?: string;
}

export default function MonsterCard({ monster, locationName, regionName }: MonsterCardProps) {
  const m = monster;
  const levelText = m.levelMin === m.levelMax ? `Lv${m.levelMin}` : `Lv${m.levelMin}-${m.levelMax}`;

  return (
    <div className={`bg-white rounded-xl shadow-sm border overflow-hidden ${m.isBoss ? "border-red-300 ring-1 ring-red-200" : "border-gray-100"}`}>
      <div className="flex gap-3 p-3">
        {m.image && (
          <div className={`flex-shrink-0 ${m.isBoss ? "w-16 h-16" : "w-12 h-12"} bg-gray-50 rounded-lg flex items-center justify-center overflow-hidden`}>
            <img
              src={`/monsters/${m.image}`}
              alt={m.name}
              className="max-w-full max-h-full object-contain"
              loading="lazy"
            />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm text-gray-900">{m.name}</span>
            {m.isBoss && (
              <span className="px-1.5 py-0.5 text-[10px] font-bold bg-red-100 text-red-600 rounded">BOSS</span>
            )}
            <span className="px-1.5 py-0.5 text-[10px] font-medium bg-slate-100 text-slate-600 rounded tabular-nums">{levelText}</span>
          </div>
          {(locationName || regionName) && (
            <div className="text-[10px] text-gray-400 mt-0.5">
              {regionName && <span>{regionName}</span>}
              {regionName && locationName && <span> · </span>}
              {locationName && <span>{locationName}</span>}
            </div>
          )}
          <div className="mt-1.5 space-y-0.5">
            <ElementBar element="earth" value={m.earth} />
            <ElementBar element="water" value={m.water} />
            <ElementBar element="fire" value={m.fire} />
            <ElementBar element="wind" value={m.wind} />
          </div>
        </div>
      </div>

      <div className="px-3 pb-3 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-gray-500">
        {m.type && (
          <span>
            <span className="text-gray-700 font-medium">{m.type}</span>
            {m.typeDetail && <span className="text-gray-400 ml-0.5">({m.typeDetail})</span>}
          </span>
        )}
        {m.cardGrade && <span>卡片: {m.cardGrade}</span>}
        {m.sealable ? (
          <span className="text-green-600">可封印</span>
        ) : m.cardGrade ? (
          <span className="text-red-500">不可封印</span>
        ) : null}
        {m.encounterCount && <span>出現: {m.encounterCount}隻</span>}
      </div>

      {m.crystals.length > 0 && (
        <div className="px-3 pb-3 flex flex-wrap gap-1">
          {m.crystals.map((c, i) => (
            <span key={i} className="px-1.5 py-0.5 text-[10px] bg-purple-50 text-purple-600 rounded font-medium">
              {c}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
