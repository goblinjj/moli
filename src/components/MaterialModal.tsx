import materialSources from "../data/materialSources.json";

interface MaterialModalProps {
  name: string;
  image: string;
  onClose: () => void;
}

interface LocationEntry {
  name: string;
  coord: string;
}

interface MaterialSource {
  type: string;
  level: number;
  locations?: LocationEntry[];
  ore?: string;
}

const sources = materialSources as Record<string, MaterialSource>;

const TYPE_COLORS: Record<string, string> = {
  "木材": "bg-green-100 text-green-700",
  "礦石": "bg-orange-100 text-orange-700",
  "礦條": "bg-amber-100 text-amber-700",
  "香草": "bg-emerald-100 text-emerald-700",
  "布料": "bg-blue-100 text-blue-700",
  "布料成品": "bg-indigo-100 text-indigo-700",
};

function LocationList({ locations }: { locations: LocationEntry[] }) {
  return (
    <div className="space-y-1">
      {locations.map((loc, i) => (
        <div key={i} className="flex items-start gap-2 text-sm">
          <span className="text-accent-500 mt-0.5 flex-shrink-0">•</span>
          <div className="min-w-0">
            <span className="text-gray-700">{loc.name}</span>
            {loc.coord && (
              <span className="ml-1.5 text-xs text-gray-400 font-mono">({loc.coord})</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function MaterialModal({ name, image, onClose }: MaterialModalProps) {
  const source = sources[name];
  const oreSource = source?.ore ? sources[source.ore] : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative bg-white rounded-xl shadow-xl max-w-sm w-full max-h-[80vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 flex-shrink-0">
          <img src={`/items/${image}`} alt={name} className="w-8 h-8 object-contain" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="font-bold text-gray-900 text-sm truncate">{name}</span>
              {source && (
                <span className={`text-[11px] px-1.5 py-0.5 rounded-md font-medium flex-shrink-0 ${TYPE_COLORS[source.type] || "bg-gray-100 text-gray-600"}`}>
                  {source.type}
                </span>
              )}
            </div>
            {source && (
              <div className="text-xs text-gray-400 mt-0.5">等級 {source.level}</div>
            )}
          </div>
          <button
            type="button"
            className="text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"
            onClick={onClose}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-4 py-3 overflow-y-auto">
          {!source ? (
            <div className="text-sm text-gray-400 text-center py-4">暫無採集資訊</div>
          ) : source.ore ? (
            /* 矿条：显示冶炼信息 + 矿石采集地 */
            <div className="space-y-3">
              <div className="text-xs text-gray-500 bg-amber-50 rounded-lg px-3 py-2">
                由 20 個 <span className="font-semibold text-amber-700">{source.ore}</span> 冶煉而成
              </div>
              {oreSource?.locations && (
                <div>
                  <div className="text-xs text-gray-400 mb-2 font-medium">{source.ore} 採集地點</div>
                  <LocationList locations={oreSource.locations} />
                </div>
              )}
            </div>
          ) : source.locations ? (
            <div>
              <div className="text-xs text-gray-400 mb-2 font-medium">
                {source.type === "布料成品" ? "購買地點" : "採集地點"}
              </div>
              <LocationList locations={source.locations} />
            </div>
          ) : (
            <div className="text-sm text-gray-400 text-center py-4">暫無採集資訊</div>
          )}
        </div>
      </div>
    </div>
  );
}
