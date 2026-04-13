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
  recoveryValue?: number;
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

export interface Monster {
  name: string;
  levelMin: number;
  levelMax: number;
  earth: number;
  water: number;
  fire: number;
  wind: number;
  type: string;
  typeDetail: string;
  cardGrade: string;
  sealable: boolean;
  isBoss: boolean;
  image: string;
  frameWidth: number;
  frameHeight: number;
  frameCount: number;
  animTime: number;
}

export interface MonsterArea {
  id: string;
  name: string;
  crystals: string[];
  encounterCount: string;
  monsters: Monster[];
}

export interface MonsterSubMap {
  name: string;
  areas: MonsterArea[];
}

export interface MonsterIsland {
  id: string;
  name: string;
  subMaps: MonsterSubMap[];
}

export type ItemType = "食材" | "木材" | "花" | "矿" | "装备" | "其他";
export type ItemUnit = "个" | "组" | "箱";

export interface WarehouseItem {
  id: string;
  characterName: string;
  itemType: ItemType;
  itemName: string;
  quantity: number;
  unit: ItemUnit;
  slots: number;
}

export interface CharacterConfig {
  name: string;
  totalSlots: number;
}
