# Gemstone Module Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a pure reference data gemstone module with card-based display, as a new top-level navigation tab.

**Architecture:** New `Gem` type system separate from `Recipe`. Gemstone data stored in JSON files under `src/data/gems/`. A new `GemCard` component renders each gemstone as a collapsible card showing effects per level. The existing `Calculator.tsx` gains a 6th tab group "宝石" that switches the main content area to render gem cards instead of recipe cards.

**Tech Stack:** React, TypeScript, Tailwind CSS (same as existing)

---

### Task 1: Define Gem Types

**Files:**
- Modify: `src/lib/types.ts`

**Step 1: Add gem type definitions to types.ts**

Add after the existing types:

```typescript
export type GemCategory = "generalGem" | "taskGem" | "rubyGem" | "petGem";

export interface GemEffect {
  target: "weapon" | "armor" | "accessory";
  description: string;
}

export interface GemLevel {
  level: number;
  grade: string; // 碎片, 嚴重損壞, etc.
  effects: GemEffect[];
}

export interface Gem {
  id: string;
  name: string;
  category: GemCategory;
  image: string;
  levels: GemLevel[];
}
```

**Step 2: Commit**

```bash
git add src/lib/types.ts
git commit -m "feat: add gem type definitions"
```

---

### Task 2: Create Gemstone Data Files

**Files:**
- Create: `src/data/gems/generalGem.json` — 一般宝石 (石榴石, 黃寶石, 綠寶石, 藍寶石, 冒險之星, 紫水晶, 騎士寶石) + 第二套 (玻隕石, 錫石, 黑玉, 菫青石, 深藍寶石, 尖晶石, 賽黃晶) + 第三套 (黃水晶, 錳紅柱石, 橄欖石, 石英, 珍珠, 蛋白石, 貓眼石)
- Create: `src/data/gems/taskGem.json` — 任务宝石 (砂漠紅星, 流星, 冰原之晶, 聖魔石)
- Create: `src/data/gems/rubyGem.json` — 紅寶石 (Lv1-10)
- Create: `src/data/gems/petGem.json` — 宠物宝石 (地水火风 × 小中大)

Each JSON is an array of `Gem` objects. Example structure:

```json
[
  {
    "id": "generalGem-garnet",
    "name": "石榴石",
    "category": "generalGem",
    "image": "gem-garnet.png",
    "levels": [
      {
        "level": 1,
        "grade": "碎片",
        "effects": [
          { "target": "weapon", "description": "耐久+5%" },
          { "target": "armor", "description": "耐久+5%" },
          { "target": "accessory", "description": "耐久+5%" }
        ]
      }
    ]
  }
]
```

Data source: https://cg.skyey.tw/made/03/20.htm

**Step 1: Create `src/data/gems/` directory and all 4 JSON files with complete data**

**Step 2: Commit**

```bash
git add src/data/gems/
git commit -m "feat: add gemstone data files"
```

---

### Task 3: Create GemCard Component

**Files:**
- Create: `src/components/GemCard.tsx`

**Step 1: Create GemCard component**

Card design matches RecipeCard style:
- Collapsed: gem image + name + category badge + level range (e.g. "Lv.1~10")
- Expanded: table showing each level's grade name and effects for weapon/armor/accessory
- Same Tailwind classes, transitions, and card styling as RecipeCard

```tsx
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

  // Get unique targets from effects
  const targets = [...new Set(gem.levels.flatMap(l => l.effects.map(e => e.target)))];
  const targetLabels: Record<string, string> = { weapon: "武器", armor: "防具", accessory: "飾品" };

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md hover:border-gray-200 transition-all duration-200 select-none">
      {/* Header */}
      <div className="flex items-center gap-3 p-3.5 cursor-pointer" onClick={() => setExpanded(prev => !prev)}>
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
          {/* Preview: first level's first effect */}
          <div className="text-[11px] text-gray-400 mt-0.5 truncate">
            {gem.levels[0]?.effects[0]?.description}
            {gem.levels.length > 1 && " ~ "}
            {gem.levels.length > 1 && gem.levels[gem.levels.length - 1]?.effects[0]?.description}
          </div>
        </div>
        <svg className={`w-4 h-4 text-gray-300 flex-shrink-0 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {/* Expanded detail */}
      <div className={`card-expand overflow-hidden ${expanded ? "max-h-[600px] opacity-100" : "max-h-0 opacity-0"}`}>
        <div className="border-t border-gray-100 px-4 py-3 text-sm">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-400">
                <th className="text-left py-1 font-medium">等級</th>
                {targets.map(t => (
                  <th key={t} className="text-left py-1 font-medium">{targetLabels[t] || t}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {gem.levels.map(lv => (
                <tr key={lv.level} className="border-t border-gray-50">
                  <td className="py-1.5 text-gray-500 font-mono">Lv.{lv.level} <span className="text-gray-300">{lv.grade}</span></td>
                  {targets.map(t => {
                    const effect = lv.effects.find(e => e.target === t);
                    return <td key={t} className="py-1.5 text-gray-600">{effect?.description || "-"}</td>;
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
```

**Step 2: Commit**

```bash
git add src/components/GemCard.tsx
git commit -m "feat: add GemCard component"
```

---

### Task 4: Integrate Gem Tab into Calculator

**Files:**
- Modify: `src/components/Calculator.tsx`
- Modify: `src/pages/index.astro`

**Step 1: Update index.astro to import gem data and pass to Calculator**

Add gem imports and pass as a new `gems` prop:

```astro
import generalGemData from "../data/gems/generalGem.json";
import taskGemData from "../data/gems/taskGem.json";
import rubyGemData from "../data/gems/rubyGem.json";
import petGemData from "../data/gems/petGem.json";

const gems = [...generalGemData, ...taskGemData, ...rubyGemData, ...petGemData];
```

Pass `gems={gems}` to `<Calculator>`.

**Step 2: Update Calculator.tsx**

Changes needed:
1. Import `Gem` type and `GemCard` component
2. Add `gems` to props interface
3. Add a 6th entry to `CATEGORY_GROUPS` for 宝石 with sub-categories: `generalGem`, `taskGem`, `rubyGem`, `petGem`
4. Add `GemCategory` items to a separate gem groups constant (since gem categories use `GemCategory` not `Category`)
5. Track whether current tab is a gem tab via a boolean derived from `activeGroup`
6. When gem tab is active:
   - Filter gems by category instead of recipes
   - Render `GemCard` instead of `RecipeCard`
   - Hide the markup rate input (not applicable)
   - Still show search + level filter

Key logic: Use a `isGemMode` boolean. When `activeGroup === 5` (the gem tab index), render gem cards. Otherwise render recipe cards as before.

**Step 3: Commit**

```bash
git add src/pages/index.astro src/components/Calculator.tsx
git commit -m "feat: integrate gemstone tab into calculator"
```

---

### Task 5: Verify and Deploy

**Step 1: Run dev server and verify**

```bash
npm run dev
```

Check:
- 宝石 tab appears in navigation
- Sub-categories (一般寶石, 任務寶石, 紅寶石, 寵物寶石) work
- Gem cards display correctly with expand/collapse
- Search filter works on gem names
- Level filter works on gem levels
- Existing recipe tabs still work correctly

**Step 2: Build and deploy**

```bash
npm run build && bash deploy.sh
```

**Step 3: Final commit and push**

```bash
git push
```
