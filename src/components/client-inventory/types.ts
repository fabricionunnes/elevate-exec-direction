// Types for Client Inventory Module

export interface InventoryCategory {
  id: string;
  project_id: string;
  name: string;
  description?: string;
  color: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface InventorySupplier {
  id: string;
  project_id: string;
  name: string;
  document?: string;
  contact_name?: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
  is_active: boolean;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface InventoryProduct {
  id: string;
  project_id: string;
  category_id?: string;
  name: string;
  sku?: string;
  description?: string;
  base_unit: string; // UN, KG, L, M
  sale_unit?: string; // UN, G, ML, CM
  conversion_factor: number;
  current_stock: number;
  min_stock: number;
  average_cost: number;
  sale_price: number;
  allow_fractional: boolean;
  allow_negative_stock: boolean;
  is_active: boolean;
  notes?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
  category?: InventoryCategory;
}

export interface InventoryPurchase {
  id: string;
  project_id: string;
  supplier_id?: string;
  purchase_date: string;
  due_date?: string;
  invoice_number?: string;
  total_amount: number;
  payment_method?: string;
  notes?: string;
  attachment_url?: string;
  status: string;
  payable_id?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
  supplier?: InventorySupplier;
  items?: InventoryPurchaseItem[];
}

export interface InventoryPurchaseItem {
  id: string;
  purchase_id: string;
  product_id: string;
  quantity: number;
  unit_cost: number;
  total_cost: number;
  created_at: string;
  product?: InventoryProduct;
}

export interface InventoryBudget {
  id: string;
  project_id: string;
  supplier_id?: string;
  budget_date: string;
  validity_date?: string;
  total_amount: number;
  notes?: string;
  status: string;
  converted_purchase_id?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
  supplier?: InventorySupplier;
  items?: InventoryBudgetItem[];
}

export interface InventoryBudgetItem {
  id: string;
  budget_id: string;
  product_id: string;
  quantity: number;
  estimated_unit_cost: number;
  estimated_total: number;
  created_at: string;
  product?: InventoryProduct;
}

export interface InventorySale {
  id: string;
  project_id: string;
  customer_name?: string;
  customer_document?: string;
  sale_date: string;
  total_amount: number;
  discount_amount: number;
  final_amount: number;
  payment_method?: string;
  notes?: string;
  status: string;
  receivable_id?: string;
  total_cost: number;
  gross_profit: number;
  profit_margin: number;
  created_by?: string;
  created_at: string;
  updated_at: string;
  items?: InventorySaleItem[];
}

export interface InventorySaleItem {
  id: string;
  sale_id: string;
  product_id: string;
  quantity: number;
  quantity_base: number;
  unit_price: number;
  total_price: number;
  unit_cost: number;
  total_cost: number;
  created_at: string;
  product?: InventoryProduct;
}

export interface InventoryMovement {
  id: string;
  project_id: string;
  product_id: string;
  movement_type: 'purchase' | 'sale' | 'adjustment' | 'loss' | 'return';
  quantity: number;
  quantity_before: number;
  quantity_after: number;
  reference_type?: string;
  reference_id?: string;
  notes?: string;
  created_by?: string;
  created_at: string;
  product?: InventoryProduct;
}

export interface InventorySettings {
  id: string;
  project_id: string;
  allow_negative_stock: boolean;
  alerts_enabled: boolean;
  purchase_category_id?: string;
  sale_category_id?: string;
  loss_category_id?: string;
  created_at: string;
  updated_at: string;
}

export type InventoryViewType =
  | 'dashboard'
  | 'products'
  | 'purchases'
  | 'suppliers'
  | 'budgets'
  | 'movements'
  | 'reports'
  | 'settings';

export const BASE_UNITS = [
  { value: 'UN', label: 'Unidade' },
  { value: 'KG', label: 'Quilograma' },
  { value: 'L', label: 'Litro' },
  { value: 'M', label: 'Metro' },
];

export const SALE_UNITS: Record<string, { value: string; label: string; factor: number }[]> = {
  UN: [{ value: 'UN', label: 'Unidade', factor: 1 }],
  KG: [
    { value: 'KG', label: 'Quilograma', factor: 1 },
    { value: 'G', label: 'Grama', factor: 1000 },
  ],
  L: [
    { value: 'L', label: 'Litro', factor: 1 },
    { value: 'ML', label: 'Mililitro', factor: 1000 },
  ],
  M: [
    { value: 'M', label: 'Metro', factor: 1 },
    { value: 'CM', label: 'Centímetro', factor: 100 },
  ],
};
