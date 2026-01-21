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

// Client Customer types
export interface ClientCustomer {
  id: string;
  project_id: string;
  name: string;
  document?: string;
  document_type?: 'cpf' | 'cnpj';
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  credit_limit: number;
  current_balance: number;
  notes?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Sale Budget types
export interface SaleBudget {
  id: string;
  project_id: string;
  customer_id?: string;
  customer_name?: string;
  budget_number?: string;
  budget_date: string;
  validity_date?: string;
  total_amount: number;
  discount_amount: number;
  final_amount: number;
  notes?: string;
  status: 'pending' | 'approved' | 'rejected' | 'converted' | 'expired';
  converted_sale_id?: string;
  seller_id?: string;
  seller_name?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
  items?: SaleBudgetItem[];
  customer?: ClientCustomer;
}

export interface SaleBudgetItem {
  id: string;
  budget_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  created_at: string;
  product?: InventoryProduct;
}

// Inventory Alert types
export interface InventoryAlert {
  id: string;
  project_id: string;
  product_id: string;
  alert_type: 'low_stock' | 'out_of_stock';
  is_read: boolean;
  is_resolved: boolean;
  resolved_at?: string;
  created_at: string;
  product?: InventoryProduct;
}

export type InventoryViewType =
  | 'dashboard'
  | 'products'
  | 'customers'
  | 'purchases'
  | 'suppliers'
  | 'budgets'
  | 'sale_budgets'
  | 'movements'
  | 'reports'
  | 'settings'
  | 'alerts';

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

// Brazilian states
export const BRAZILIAN_STATES = [
  { value: 'AC', label: 'Acre' },
  { value: 'AL', label: 'Alagoas' },
  { value: 'AP', label: 'Amapá' },
  { value: 'AM', label: 'Amazonas' },
  { value: 'BA', label: 'Bahia' },
  { value: 'CE', label: 'Ceará' },
  { value: 'DF', label: 'Distrito Federal' },
  { value: 'ES', label: 'Espírito Santo' },
  { value: 'GO', label: 'Goiás' },
  { value: 'MA', label: 'Maranhão' },
  { value: 'MT', label: 'Mato Grosso' },
  { value: 'MS', label: 'Mato Grosso do Sul' },
  { value: 'MG', label: 'Minas Gerais' },
  { value: 'PA', label: 'Pará' },
  { value: 'PB', label: 'Paraíba' },
  { value: 'PR', label: 'Paraná' },
  { value: 'PE', label: 'Pernambuco' },
  { value: 'PI', label: 'Piauí' },
  { value: 'RJ', label: 'Rio de Janeiro' },
  { value: 'RN', label: 'Rio Grande do Norte' },
  { value: 'RS', label: 'Rio Grande do Sul' },
  { value: 'RO', label: 'Rondônia' },
  { value: 'RR', label: 'Roraima' },
  { value: 'SC', label: 'Santa Catarina' },
  { value: 'SP', label: 'São Paulo' },
  { value: 'SE', label: 'Sergipe' },
  { value: 'TO', label: 'Tocantins' },
];
