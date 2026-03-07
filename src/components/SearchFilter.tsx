interface SearchFilterProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  levelFilter: number | null;
  onLevelChange: (level: number | null) => void;
  maxLevel: number;
}

export default function SearchFilter({
  searchQuery,
  onSearchChange,
  levelFilter,
  onLevelChange,
  maxLevel,
}: SearchFilterProps) {
  const levelOptions: (number | null)[] = [null, ...Array.from({ length: maxLevel }, (_, i) => i + 1)];

  return (
    <div className="w-full flex items-center gap-3 py-2">
      {/* Search input */}
      <div className="relative flex-1 max-w-xs">
        <svg
          className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z"
          />
        </svg>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="搜索物品名称..."
          className="w-full bg-slate-700 border border-slate-600 rounded-full pl-8 pr-3 py-1.5 text-sm text-slate-100 placeholder-slate-400 focus:outline-none focus:border-blue-400"
        />
      </div>

      {/* Level filter buttons */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {levelOptions.map((level) => {
          const isActive = levelFilter === level;
          return (
            <button
              key={level ?? "all"}
              type="button"
              onClick={() => onLevelChange(level)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                isActive
                  ? "bg-blue-500 text-white"
                  : "bg-slate-700 text-slate-300 hover:bg-slate-600"
              }`}
            >
              {level === null ? "全部" : `${level}级`}
            </button>
          );
        })}
      </div>
    </div>
  );
}
