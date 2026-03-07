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
