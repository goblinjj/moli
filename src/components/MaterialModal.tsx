import materialSources from "../data/materialSources.json";

interface MaterialModalProps {
  name: string;
  image: string;
  onClose: () => void;
}

const TYPE_COLORS: Record<string, string> = {
  "木材": "bg-green-100 text-green-700",
  "礦石": "bg-orange-100 text-orange-700",
  "礦條": "bg-amber-100 text-amber-700",
  "香草": "bg-emerald-100 text-emerald-700",
  "布料": "bg-blue-100 text-blue-700",
  "布料成品": "bg-indigo-100 text-indigo-700",
};

export default function MaterialModal({ name, image, onClose }: MaterialModalProps) {
  const source = (materialSources as Record<string, { type: string; level: number; locations: string[] }>)[name];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative bg-white rounded-xl shadow-xl max-w-sm w-full overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
          <img src={`/items/${image}`} alt={name} className="w-8 h-8 object-contain" />
          <span className="font-bold text-gray-900 text-sm">{name}</span>
          {source && (
            <span className={`text-[11px] px-1.5 py-0.5 rounded-md font-medium ${TYPE_COLORS[source.type] || "bg-gray-100 text-gray-600"}`}>
              {source.type}
            </span>
          )}
          <button
            type="button"
            className="ml-auto text-gray-400 hover:text-gray-600 transition-colors"
            onClick={onClose}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-4 py-3">
          {source ? (
            <div>
              <div className="text-xs text-gray-400 mb-2">採集 / 取得地點</div>
              <div className="space-y-1.5">
                {source.locations.map((loc) => (
                  <div key={loc} className="flex items-start gap-2 text-sm text-gray-700">
                    <span className="text-accent-500 mt-0.5 flex-shrink-0">•</span>
                    <span>{loc}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-sm text-gray-400 text-center py-4">
              暫無採集資訊
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
