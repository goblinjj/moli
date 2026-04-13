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

import type { WarehouseItem } from "./types";

const WAREHOUSE_STORAGE_KEY = "moli-warehouse-items";

export function loadWarehouseItems(): WarehouseItem[] {
  if (typeof window === "undefined") return [];
  try {
    const saved = localStorage.getItem(WAREHOUSE_STORAGE_KEY);
    if (!saved) return [];
    return JSON.parse(saved);
  } catch {
    return [];
  }
}

export function saveWarehouseItems(items: WarehouseItem[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(WAREHOUSE_STORAGE_KEY, JSON.stringify(items));
}
