export type Category =
  | "sword" | "axe" | "spear" | "bow" | "staff" | "dagger" | "throw" | "bomb"
  | "helmet" | "hat" | "armor" | "cloth" | "robe" | "boots" | "shoes" | "shield"
  | "cooking" | "pharmacy" | "accessory"
  | "dragon" | "fiveC" | "scroll"
  | "collar" | "crystal" | "petArmor" | "petAccessory" | "petCloth";

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
  stats?: string;
}

export interface PriceConfig {
  materialPrices: Record<string, number>;
  recipeMpCosts: Record<string, number>;
  markupRates: Record<string, number>;
}

export interface CostBreakdown {
  materialCosts: { name: string; quantity: number; unitPrice: number; total: number; image: string; isSubRecipe: boolean }[];
  mpCost: number;
  mpTotal: number;
  totalCost: number;
  sellingPrice: number;
}

export type GemCategory = "generalGem" | "taskGem" | "rubyGem" | "petGem";

export interface GemEffect {
  target: "weapon" | "armor" | "accessory";
  description: string;
}

export interface GemLevel {
  level: number;
  grade: string;
  effects: GemEffect[];
}

export interface Gem {
  id: string;
  name: string;
  category: GemCategory;
  image: string;
  levels: GemLevel[];
}
