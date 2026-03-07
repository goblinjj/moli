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
    <div className="w-full flex flex-col sm:flex-row items-start sm:items-center gap-3 pb-2">
      {/* Search input */}
      <div className="relative flex-1 max-w-sm w-full">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
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
          className="w-full bg-white border border-gray-200 rounded-lg pl-9 pr-3 py-2 text-sm text-gray-900 placeholder-gray-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500 transition-shadow"
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
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-150 ${
                isActive
                  ? "bg-accent-500 text-white shadow-sm shadow-accent-500/20"
                  : "bg-white text-gray-600 border border-gray-200 hover:border-gray-300 hover:text-gray-900 shadow-sm"
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
