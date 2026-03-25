# Supply Pricing Calculator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "补给估价" tool that calculates cooking/potion prices and blood-magic pool cost-per-point, behind a new top-level navigation split (生产系资料 / 工具).

**Architecture:** Extend Calculator.tsx with a top-level section toggle (生产系资料 vs 工具). The "工具" section gets its own sub-navigation for individual tools. First tool is SupplyPricing — a table-based calculator with per-item configurable ratio, persisted to localStorage.

**Tech Stack:** React 19, TypeScript, Tailwind CSS 4, Astro 5

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `src/lib/types.ts` | Add `recoveryValue` to Recipe interface |
| Modify | `src/lib/storage.ts` | Add supply pricing ratio load/save helpers |
| Modify | `src/data/cooking.json` | Add `recoveryValue` field to 1-10 level items |
| Modify | `src/data/pharmacy.json` | Add `recoveryValue` field to 1-10 level items |
| Create | `src/components/SupplyPricing.tsx` | Pricing calculator with tabs + table |
| Modify | `src/components/Calculator.tsx` | Add top-level nav (生产系资料/工具), render SupplyPricing |

---

### Task 1: Add `recoveryValue` field to data files

**Files:**
- Modify: `src/data/cooking.json`
- Modify: `src/data/pharmacy.json`
- Modify: `src/lib/types.ts`

- [ ] **Step 1: Add `recoveryValue` to Recipe type**

In `src/lib/types.ts`, add optional field to Recipe interface:

```typescript
export interface Recipe {
  id: string;
  name: string;
  category: Category;
  level: number;
  variant: string;
  image: string;
  materials: Material[];
  mpCost: number;
  stats?: string;
  recoveryValue?: number;
}
```

- [ ] **Step 2: Add `recoveryValue` to cooking.json**

For each cooking recipe at level 1-10 that has a stats field like "魔力值回復約XXX點", add a `recoveryValue` numeric field matching the value in stats. Examples:

- `cooking-1a` (蕃茄醬): stats "魔力值回復約30點" → `"recoveryValue": 30`
- `cooking-1b` (麵包): stats "魔力值回復約100點" → `"recoveryValue": 100`
- `cooking-1e` (美乃滋芝麻拌飯): stats "魔力值回復約300點" → `"recoveryValue": 300`

Parse the number from the stats field for each 1-10 level item. Items without magic recovery stats or with level > 10 should NOT get this field.

- [ ] **Step 3: Add `recoveryValue` to pharmacy.json**

For each pharmacy recipe at level 1-10 that has a stats field like "生命值回復約XXX點", add a `recoveryValue` numeric field. Examples:

- `pharmacy-1a`: stats "生命值回復約100點" → `"recoveryValue": 100`
- `pharmacy-2a`: stats "生命值回復約150點" → `"recoveryValue": 150`

Items without HP recovery stats (like 想泉丸, 猛毒的餌, 迷魂藥, etc.) or with level > 10 should NOT get this field.

- [ ] **Step 4: Verify data by running build**

Run: `cd /Volumes/T7/work/moli && npm run build`
Expected: Build succeeds with no type errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/types.ts src/data/cooking.json src/data/pharmacy.json
git commit -m "feat: add recoveryValue field to cooking and pharmacy data"
```

---

### Task 2: Add storage helpers for supply pricing ratios

**Files:**
- Modify: `src/lib/storage.ts`

- [ ] **Step 1: Add ratio load/save functions**

Append to `src/lib/storage.ts`:

```typescript
const RATIO_STORAGE_KEY = "moli-supply-pricing-ratios";

export function loadPricingRatios(): Record<string, number> {
  if (typeof window === "undefined") return {};
  try {
    const saved = localStorage.getItem(RATIO_STORAGE_KEY);
    if (!saved) return {};
    return JSON.parse(saved);
  } catch {
    return {};
  }
}

export function savePricingRatios(ratios: Record<string, number>): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(RATIO_STORAGE_KEY, JSON.stringify(ratios));
}
```

- [ ] **Step 2: Verify build**

Run: `cd /Volumes/T7/work/moli && npm run build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/lib/storage.ts
git commit -m "feat: add localStorage helpers for supply pricing ratios"
```

---

### Task 3: Create SupplyPricing component

**Files:**
- Create: `src/components/SupplyPricing.tsx`

- [ ] **Step 1: Create the component**

Create `src/components/SupplyPricing.tsx` with the following structure:

```tsx
import { useState, useEffect, useMemo, useCallback } from "react";
import type { Recipe } from "../lib/types";
import { loadPricingRatios, savePricingRatios } from "../lib/storage";

interface SupplyPricingProps {
  recipes: Recipe[];
}

const DEFAULT_RATIO = 1.5;

// Blood-magic pool discount rates by level (1-10)
const POOL_DISCOUNT: Record<number, number> = {
  1: 0.45, 2: 0.50, 3: 0.55, 4: 0.60, 5: 0.65,
  6: 0.70, 7: 0.75, 8: 0.80, 9: 0.85, 10: 0.90,
};

type Tab = "cooking" | "pharmacy";

export default function SupplyPricing({ recipes }: SupplyPricingProps) {
  const [activeTab, setActiveTab] = useState<Tab>("cooking");
  const [ratios, setRatios] = useState<Record<string, number>>(() => loadPricingRatios());

  useEffect(() => {
    savePricingRatios(ratios);
  }, [ratios]);

  const items = useMemo(() => {
    return recipes.filter(
      (r) =>
        r.category === activeTab &&
        r.level >= 1 &&
        r.level <= 10 &&
        r.recoveryValue != null &&
        r.recoveryValue > 0
    ).sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
  }, [recipes, activeTab]);

  const getRatio = useCallback(
    (id: string) => ratios[id] ?? DEFAULT_RATIO,
    [ratios]
  );

  const handleRatioChange = useCallback((id: string, value: number) => {
    setRatios((prev) => ({ ...prev, [id]: value }));
  }, []);

  const formatNumber = (n: number) =>
    Number.isInteger(n) ? n.toLocaleString() : n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div>
      {/* Tab switch: 料理 / 血瓶 */}
      <div className="flex gap-1.5 mb-4">
        {([
          { id: "cooking" as Tab, label: "料理" },
          { id: "pharmacy" as Tab, label: "血瓶" },
        ]).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`px-3.5 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-all duration-150 ${
              activeTab === tab.id
                ? "bg-accent-500 text-white shadow-sm shadow-accent-500/20"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-900"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Pricing table */}
      {items.length === 0 ? (
        <div className="text-center text-slate-400 mt-16 text-sm">没有找到数据</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-left text-gray-500 text-xs border-b border-gray-200">
                <th className="py-2 px-2 font-medium">图标</th>
                <th className="py-2 px-2 font-medium">名称</th>
                <th className="py-2 px-2 font-medium text-center">等级</th>
                <th className="py-2 px-2 font-medium text-right">回复值</th>
                <th className="py-2 px-2 font-medium text-center">比例</th>
                <th className="py-2 px-2 font-medium text-right">单价</th>
                <th className="py-2 px-2 font-medium text-right">一组(×5)</th>
                <th className="py-2 px-2 font-medium text-right">一箱(×50)</th>
                <th className="py-2 px-2 font-medium text-right">血魔池每点成本</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const ratio = getRatio(item.id);
                const unitPrice = item.recoveryValue! * ratio;
                const groupPrice = unitPrice * 5;
                const boxPrice = unitPrice * 50;
                const discount = POOL_DISCOUNT[item.level] ?? 1;
                const poolCost = unitPrice / (item.recoveryValue! * discount);

                return (
                  <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-2 px-2">
                      <img
                        src={`/images/${item.image}`}
                        alt={item.name}
                        className="w-8 h-8 object-contain"
                      />
                    </td>
                    <td className="py-2 px-2 font-medium text-gray-800">{item.name}</td>
                    <td className="py-2 px-2 text-center text-gray-600">{item.level}</td>
                    <td className="py-2 px-2 text-right tabular-nums text-gray-700">
                      {item.recoveryValue!.toLocaleString()}
                    </td>
                    <td className="py-2 px-2 text-center">
                      <input
                        type="number"
                        className="w-16 bg-white border border-gray-200 rounded-lg px-2 py-1 text-right text-gray-700 text-xs font-mono shadow-sm focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500"
                        value={ratio}
                        min={0}
                        step={0.1}
                        onChange={(e) =>
                          handleRatioChange(item.id, Number(e.target.value) || 0)
                        }
                      />
                    </td>
                    <td className="py-2 px-2 text-right tabular-nums text-gray-700">
                      {formatNumber(unitPrice)}
                    </td>
                    <td className="py-2 px-2 text-right tabular-nums text-gray-700">
                      {formatNumber(groupPrice)}
                    </td>
                    <td className="py-2 px-2 text-right tabular-nums text-gray-700">
                      {formatNumber(boxPrice)}
                    </td>
                    <td className="py-2 px-2 text-right tabular-nums text-gray-700">
                      {formatNumber(poolCost)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `cd /Volumes/T7/work/moli && npm run build`
Expected: Build succeeds (component not yet mounted, just compiled).

- [ ] **Step 3: Commit**

```bash
git add src/components/SupplyPricing.tsx
git commit -m "feat: add SupplyPricing calculator component"
```

---

### Task 4: Add top-level navigation and integrate SupplyPricing

**Files:**
- Modify: `src/components/Calculator.tsx`

- [ ] **Step 1: Add top-level section state and navigation**

In `Calculator.tsx`, add a new state for the top-level section:

```typescript
type Section = "production" | "tools";
```

Add state:
```typescript
const [activeSection, setActiveSection] = useState<Section>("production");
```

Add import:
```typescript
import SupplyPricing from "./SupplyPricing";
```

- [ ] **Step 2: Add top-level nav UI in the header area**

Replace the existing `<nav>` block. Insert a new top-level navigation bar between the header and the existing category nav. The top-level bar shows "生产系资料" and "工具" buttons. The existing category nav (group tabs + sub-category pills) only renders when `activeSection === "production"`.

New structure inside the `<div>` after `</header>`:

```tsx
{/* Top-level section navigation */}
<div className="bg-white border-b border-gray-200">
  <div className="flex px-5 lg:px-6 gap-0">
    {([
      { id: "production" as Section, label: "生产系资料" },
      { id: "tools" as Section, label: "工具" },
    ]).map((section) => (
      <button
        key={section.id}
        type="button"
        onClick={() => setActiveSection(section.id)}
        className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
          activeSection === section.id
            ? "border-accent-500 text-accent-600"
            : "border-transparent text-gray-500 hover:text-gray-700"
        }`}
      >
        {section.label}
      </button>
    ))}
  </div>
</div>
```

- [ ] **Step 3: Conditionally render category nav and main content**

Wrap the existing `<nav className="bg-white border-b border-gray-200">` and `<main>` content inside `{activeSection === "production" && ( ... )}`.

When `activeSection === "tools"`, render the tools section:

```tsx
{activeSection === "tools" && (
  <>
    {/* Tools sub-navigation */}
    <nav className="bg-white border-b border-gray-200">
      <div className="flex items-center gap-1.5 px-5 lg:px-6 py-2">
        <button
          type="button"
          className="px-3.5 py-1 rounded-full text-xs font-medium bg-accent-500 text-white shadow-sm shadow-accent-500/20"
        >
          补给估价
        </button>
      </div>
    </nav>
    <main className="flex-1 overflow-y-auto p-5 lg:p-6">
      <SupplyPricing recipes={recipes} />
    </main>
  </>
)}
```

Note: The tools sub-nav currently has only one item ("补给估价") which is always active. When more tools are added in the future, this will become a stateful tab bar similar to the production category groups.

- [ ] **Step 4: Verify build and test in browser**

Run: `cd /Volumes/T7/work/moli && npm run build`
Expected: Build succeeds.

Run: `cd /Volumes/T7/work/moli && npm run dev`
Manually verify:
1. Page loads with "生产系资料" selected by default
2. Existing production calculator works as before
3. Clicking "工具" shows the tools section with "补给估价" tab
4. 料理/血瓶 toggle works
5. Table shows correct items with recovery values
6. Ratio input is editable and persists on page reload
7. All calculated values (单价, 一组, 一箱, 血魔池成本) update when ratio changes

- [ ] **Step 5: Commit**

```bash
git add src/components/Calculator.tsx
git commit -m "feat: add top-level navigation and integrate supply pricing tool"
```

---

### Task 5: Deploy

- [ ] **Step 1: Push and deploy**

```bash
git push && bash deploy.sh
```
