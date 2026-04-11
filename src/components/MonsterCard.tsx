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

function SpriteAnimation({ image, frameWidth, frameHeight, frameCount, animTime }: {
  image: string; frameWidth: number; frameHeight: number; frameCount: number; animTime: number;
}) {
  if (!image || !frameWidth || !frameHeight) return null;

  const totalWidth = frameWidth * frameCount;
  const animName = `sprite-${image.replace('.png', '')}`;
  const duration = animTime / 1000;

  return (
    <div
      className="flex-shrink-0 overflow-hidden"
      style={{ width: frameWidth, height: frameHeight, maxWidth: 64, maxHeight: 64 }}
    >
      <div
        style={{
          width: frameWidth,
          height: frameHeight,
          backgroundImage: `url(/monsters/${image})`,
          backgroundRepeat: 'no-repeat',
          backgroundSize: `${totalWidth}px ${frameHeight}px`,
          animation: `${animName} ${duration}s steps(${frameCount}) infinite`,
          transform: frameWidth > 64 ? `scale(${64 / frameWidth})` : undefined,
          transformOrigin: 'top left',
        }}
      />
      <style>{`@keyframes ${animName} { from { background-position: 0 0; } to { background-position: -${totalWidth}px 0; } }`}</style>
    </div>
  );
}

export default function MonsterCard({ monster }: { monster: Monster }) {
  const m = monster;
  const levelText = m.levelMin === m.levelMax ? `Lv${m.levelMin}` : `Lv${m.levelMin}-${m.levelMax}`;

  return (
    <div className="flex gap-2.5 py-2 border-b border-gray-50 last:border-0">
      <div className="w-16 h-16 bg-gray-50 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0">
        <SpriteAnimation
          image={m.image}
          frameWidth={m.frameWidth}
          frameHeight={m.frameHeight}
          frameCount={m.frameCount}
          animTime={m.animTime}
        />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-sm text-gray-900">{m.name}</span>
          {m.isBoss && (
            <span className="px-1.5 py-0.5 text-[10px] font-bold bg-red-100 text-red-600 rounded">BOSS</span>
          )}
          <span className="px-1.5 py-0.5 text-[10px] font-medium bg-slate-100 text-slate-600 rounded tabular-nums">{levelText}</span>
        </div>
        <div className="mt-1 space-y-0.5">
          <ElementBar element="earth" value={m.earth} />
          <ElementBar element="water" value={m.water} />
          <ElementBar element="fire" value={m.fire} />
          <ElementBar element="wind" value={m.wind} />
        </div>
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-gray-500">
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
        </div>
      </div>
    </div>
  );
}
