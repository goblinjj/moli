# 魔力宝贝生产计算器 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a production cost and selling price calculator for 魔力宝贝 (Cross Gate) covering bow crafting and cooking, with recursive cost calculation and full customization.

**Architecture:** Astro static site with React interactive components. Recipe data stored as JSON, images downloaded locally. Cost calculation is pure client-side with localStorage persistence for all user customizations.

**Tech Stack:** Astro, React, TypeScript, Tailwind CSS, Cloudflare Pages

---

### Task 1: Project Scaffolding

**Files:**
- Create: `package.json`, `astro.config.mjs`, `tsconfig.json`, `src/layouts/Layout.astro`, `src/pages/index.astro`

**Step 1: Initialize Astro project**

```bash
cd /Volumes/T7/work/moli
npm create astro@latest . -- --template minimal --typescript strict --install --no-git
```

**Step 2: Add React and Tailwind integrations**

```bash
npx astro add react tailwind -y
```

**Step 3: Verify dev server starts**

```bash
npm run dev &
sleep 3
curl -s http://localhost:4321 | head -5
kill %1
```

Expected: HTML output from Astro dev server.

**Step 4: Initialize git and commit**

```bash
git init
echo "node_modules\ndist\n.astro" > .gitignore
git add -A
git commit -m "chore: initialize Astro project with React and Tailwind"
```

---

### Task 2: Data Extraction Script — Scrape Recipe Data and Images

**Files:**
- Create: `scripts/scrape.py`
- Create: `src/data/bow.json`
- Create: `src/data/cooking.json`
- Create: `public/items/*.png` (downloaded images)

**Step 1: Write the scraping script**

Create `scripts/scrape.py` that:
1. Fetches `https://cgs.hk/produce4.htm` and `https://cgs.hk/produce17.htm`
2. Parses each `<tbody id="N">` block to extract:
   - Row 1: product variant (e.g. "1A"), product image `data-src`, material images `data-src` with `title` (等級N), quantities from `<span>x N</span>`
   - Row 2: product name, material names
   - Row 3: product type, material `data-set` values
3. Builds JSON with structure:
```json
[
  {
    "id": "bow-1a",
    "name": "輕型弓",
    "category": "bow",
    "level": 1,
    "variant": "A",
    "image": "8d9f8bd75c370e01c056c3efb5705e4f.png",
    "mpCost": 20,
    "materials": [
      {
        "name": "銅條",
        "quantity": 3,
        "image": "f0f365d099852428840747a73a839216.png",
        "materialLevel": 1
      }
    ]
  }
]
```
4. Downloads all unique images from `https://ig2.cgs.hk/g/{hash[:2]}/{hash}.png` to `public/items/`
5. Saves JSON to `src/data/bow.json` and `src/data/cooking.json`

**HTML structure reference (per tbody):**
```html
<tbody id="0">
  <!-- Row 1: images + quantities -->
  <tr>
    <td rowspan="3">1A</td>                           <!-- variant -->
    <td><img data-src="{product_hash}"></td>           <!-- product image -->
    <td class="quantity"><span>x 3</span><img data-src="{mat_hash}" title="等級1"></td>
    <!-- ... more materials ... -->
  </tr>
  <!-- Row 2: names -->
  <tr>
    <td>輕型弓</td>    <!-- product name -->
    <td>銅條</td>      <!-- material 1 name -->
    <td>印度輕木</td>   <!-- material 2 name -->
  </tr>
  <!-- Row 3: type + data-set -->
  <tr>
    <td>弓</td>
    <td data-set="40">3</td>   <!-- base quantity -->
  </tr>
</tbody>
```

**Image URL pattern:** `https://ig2.cgs.hk/g/{hash[:2]}/{hash}.png`

**mpCost defaults:** level × 20

**Step 2: Run the script**

```bash
pip3 install beautifulsoup4 requests
python3 scripts/scrape.py
```

Expected: JSON files created, images downloaded.

**Step 3: Verify data**

```bash
cat src/data/bow.json | python3 -m json.tool | head -30
cat src/data/cooking.json | python3 -m json.tool | head -30
ls public/items/ | wc -l
```

Expected: Valid JSON with all recipes, images directory populated.

**Step 4: Commit**

```bash
git add src/data/ public/items/ scripts/
git commit -m "feat: add recipe data and item images for bow and cooking"
```

---

### Task 3: TypeScript Types and Calculator Logic

**Files:**
- Create: `src/lib/types.ts`
- Create: `src/lib/calculator.ts`
- Create: `src/lib/defaults.ts`

**Step 1: Define types in `src/lib/types.ts`**

```ts
export type Category = "bow" | "cooking";

export interface Material {
  name: string;
  quantity: number;
  image: string;
  materialLevel: number;
}

export interface Recipe {
  id: string;
  name: string;
  category: Category;
  level: number;
  variant: string;
  image: string;
  materials: Material[];
  mpCost: number;
}

export interface PriceConfig {
  materialPrices: Record<string, number>;
  mpPrice: number;
  recipeMpCosts: Record<string, number>;
  markupRates: Record<Category, number>;
}

export interface CostBreakdown {
  materialCosts: { name: string; quantity: number; unitPrice: number; total: number; image: string }[];
  mpCost: number;
  mpTotal: number;
  totalCost: number;
  sellingPrice: number;
}
```

**Step 2: Create default price generator in `src/lib/defaults.ts`**

This file reads the recipe JSON data and generates default `PriceConfig`:
- Iterates all unique material names across all recipes
- Determines material level from `materialLevel` field
- Normal materials: level × 1 per unit
- Ore bars (names ending in 條): level × 20 per bar
- Special materials (誓言之證, 魔族的水晶, 鋼騎之礦, etc.): assign reasonable defaults based on level
- mpPrice: 1
- markupRates: { bow: 20, cooking: 20 }
- recipeMpCosts: generated from recipe data (level × 20)

**Step 3: Implement calculator in `src/lib/calculator.ts`**

```ts
import type { Recipe, PriceConfig, CostBreakdown, Category } from "./types";

export function calculateCost(
  recipe: Recipe,
  allRecipes: Recipe[],
  config: PriceConfig,
  visited: Set<string> = new Set()
): CostBreakdown {
  const mpCostPoints = config.recipeMpCosts[recipe.id] ?? recipe.mpCost;
  const mpTotal = mpCostPoints * config.mpPrice;

  // Build a map of product names → recipes for recursive lookup
  const recipeByName = new Map<string, Recipe>();
  for (const r of allRecipes) {
    recipeByName.set(r.name, r);
  }

  visited.add(recipe.id);

  const materialCosts = recipe.materials.map((mat) => {
    let unitPrice: number;
    const subRecipe = recipeByName.get(mat.name);

    if (subRecipe && !visited.has(subRecipe.id)) {
      // Recursive: material is a product in same system
      const subCost = calculateCost(subRecipe, allRecipes, config, new Set(visited));
      unitPrice = subCost.totalCost;
    } else {
      // Base material or circular dependency fallback
      unitPrice = config.materialPrices[mat.name] ?? 1;
    }

    return {
      name: mat.name,
      quantity: mat.quantity,
      unitPrice,
      total: unitPrice * mat.quantity,
      image: mat.image,
    };
  });

  const materialTotal = materialCosts.reduce((sum, m) => sum + m.total, 0);
  const totalCost = materialTotal + mpTotal;
  const markupRate = config.markupRates[recipe.category] ?? 0;
  const sellingPrice = Math.ceil(totalCost * (1 + markupRate / 100));

  return { materialCosts, mpCost: mpCostPoints, mpTotal, totalCost, sellingPrice };
}
```

**Step 4: Verify with a quick test**

```bash
npx astro check
```

Expected: No type errors.

**Step 5: Commit**

```bash
git add src/lib/
git commit -m "feat: add types, default prices, and recursive cost calculator"
```

---

### Task 4: localStorage Persistence

**Files:**
- Create: `src/lib/storage.ts`

**Step 1: Implement storage helper**

```ts
import type { PriceConfig } from "./types";

const STORAGE_KEY = "moli-price-config";

export function loadConfig(defaultConfig: PriceConfig): PriceConfig {
  if (typeof window === "undefined") return defaultConfig;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return defaultConfig;
    const parsed = JSON.parse(saved);
    // Merge with defaults so new materials get default prices
    return {
      materialPrices: { ...defaultConfig.materialPrices, ...parsed.materialPrices },
      mpPrice: parsed.mpPrice ?? defaultConfig.mpPrice,
      recipeMpCosts: { ...defaultConfig.recipeMpCosts, ...parsed.recipeMpCosts },
      markupRates: { ...defaultConfig.markupRates, ...parsed.markupRates },
    };
  } catch {
    return defaultConfig;
  }
}

export function saveConfig(config: PriceConfig): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}
```

**Step 2: Commit**

```bash
git add src/lib/storage.ts
git commit -m "feat: add localStorage persistence for price config"
```

---

### Task 5: React Components — PriceSettings Panel

**Files:**
- Create: `src/components/PriceSettings.tsx`

**Step 1: Build the settings panel**

Left sidebar component with:
- **补魔单价**: number input for `mpPrice`
- **加价比例**: number inputs per category (bow %, cooking %)
- **材料价格**: collapsible list of all materials grouped by level, each with number input
  - Show material image + name + editable price
  - Group by material level (1级, 2级, ...)
- **耗魔量**: section showing per-recipe MP costs, editable
- **重置按钮**: reset all to defaults

All inputs call `onChange` callback that triggers `saveConfig` and recalculation.

**Step 2: Commit**

```bash
git add src/components/PriceSettings.tsx
git commit -m "feat: add price settings panel component"
```

---

### Task 6: React Components — SearchFilter

**Files:**
- Create: `src/components/SearchFilter.tsx`

**Step 1: Build search and filter bar**

- Text input for name search (filters recipes by name, case-insensitive)
- Dropdown/button group for level filter (全部, 1级, 2级, ... 15级)
- Callbacks: `onSearchChange(query: string)`, `onLevelChange(level: number | null)`

**Step 2: Commit**

```bash
git add src/components/SearchFilter.tsx
git commit -m "feat: add search and filter component"
```

---

### Task 7: React Components — RecipeCard

**Files:**
- Create: `src/components/RecipeCard.tsx`

**Step 1: Build the recipe card**

Card component showing:
- **Collapsed state**: item image, name, level+variant badge, cost, selling price
- **Expanded state** (click to toggle): full material breakdown table
  - Each row: material image, name, quantity, unit price, subtotal
  - MP cost row: points × price = total
  - Separator line
  - Total cost
  - Selling price with markup percentage shown

Uses `CostBreakdown` from calculator.

**Step 2: Commit**

```bash
git add src/components/RecipeCard.tsx
git commit -m "feat: add recipe card component with expandable details"
```

---

### Task 8: React Components — Main Calculator

**Files:**
- Create: `src/components/Calculator.tsx`

**Step 1: Build the main calculator component**

This is the root React component that:
1. Loads recipe data (bow.json, cooking.json) passed as props
2. Initializes `PriceConfig` from defaults + localStorage
3. Manages state: `activeCategory`, `searchQuery`, `levelFilter`, `config`
4. Renders:
   - **Top tabs**: category switcher (造弓 / 料理)
   - **Layout**: left sidebar (PriceSettings) + right main area
   - **Main area**: SearchFilter + grid of RecipeCards
5. On config change: recalculates all costs, saves to localStorage
6. Filters recipes by active category, search query, and level

**Step 2: Commit**

```bash
git add src/components/Calculator.tsx
git commit -m "feat: add main calculator component with state management"
```

---

### Task 9: Astro Pages and Layout

**Files:**
- Modify: `src/layouts/Layout.astro`
- Modify: `src/pages/index.astro`

**Step 1: Update Layout.astro**

Set page title, meta tags, import Tailwind, set Chinese language.

**Step 2: Update index.astro**

- Import bow.json and cooking.json
- Import Calculator component
- Render `<Calculator client:load recipes={[...bowData, ...cookingData]} />`

**Step 3: Test locally**

```bash
npm run dev
```

Open http://localhost:4321 and verify:
- Category tabs work
- Cards display with images
- Search and filter work
- Price settings update costs in real-time
- Expanded card shows full breakdown
- Refresh preserves settings

**Step 4: Commit**

```bash
git add src/layouts/ src/pages/
git commit -m "feat: wire up Astro pages with Calculator component"
```

---

### Task 10: Styling and Polish

**Files:**
- Modify: `src/components/*.tsx` (add Tailwind classes)

**Step 1: Apply modern Dashboard styling**

- Color scheme: clean dark sidebar, light main area
- Card hover effects and transitions
- Responsive grid (1 col mobile, 2 col tablet, 3-4 col desktop)
- Settings panel collapsible on mobile
- Proper spacing, typography, rounded corners
- Item images sized consistently (48×48 in cards, 24×24 in material lists)

**Step 2: Test responsiveness**

Verify layout at 375px, 768px, and 1440px widths.

**Step 3: Commit**

```bash
git add src/
git commit -m "feat: apply dashboard styling and responsive layout"
```

---

### Task 11: Build and Cloudflare Pages Config

**Files:**
- Modify: `astro.config.mjs`

**Step 1: Configure for Cloudflare Pages static output**

```ts
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwind from '@astrojs/tailwind';

export default defineConfig({
  integrations: [react(), tailwind()],
  output: 'static',
});
```

**Step 2: Build and verify**

```bash
npm run build
ls dist/
```

Expected: Static files in `dist/` ready for deployment.

**Step 3: Commit**

```bash
git add astro.config.mjs
git commit -m "chore: configure static build for Cloudflare Pages"
```

---

### Task 12: Final Verification

**Step 1: Full build test**

```bash
npm run build && npx astro preview
```

**Step 2: Manual verification checklist**

- [ ] Category tabs switch between 造弓 and 料理
- [ ] All recipes display with correct images
- [ ] Search filters by name
- [ ] Level filter works
- [ ] Clicking a card expands/collapses details
- [ ] Material costs calculate correctly
- [ ] Recursive cost calculation works (e.g. 炒麵麵包)
- [ ] MP cost included in total
- [ ] Selling price = cost × (1 + markup%)
- [ ] Changing any price in settings updates all cards
- [ ] All settings persist after page refresh
- [ ] Responsive layout works on mobile

**Step 3: Final commit**

```bash
git add -A
git commit -m "chore: final verification complete"
```
