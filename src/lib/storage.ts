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
