// Types for Client Financial Module

export interface FinancialCategory {
  id: string;
  project_id: string;
  name: string;
  type: string;
  description?: string;
  color: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface FinancialCostCenter {
  id: string;
  project_id: string;
  name: string;
  description?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface FinancialPaymentMethod {
  id: string;
  project_id: string;
  name: string;
  is_active: boolean;
  created_at: string;
}

export interface FinancialReceivable {
  id: string;
  project_id: string;
  client_name: string;
  description?: string;
  category_id?: string;
  cost_center_id?: string;
  amount: number;
  due_date: string;
  status: string;
  payment_method_id?: string;
  paid_at?: string;
  paid_amount?: number;
  notes?: string;
  attachment_url?: string;
  created_at: string;
  updated_at: string;
  // Relations
  category?: FinancialCategory;
  cost_center?: FinancialCostCenter;
  payment_method?: FinancialPaymentMethod;
}

export interface FinancialPayable {
  id: string;
  project_id: string;
  supplier_name: string;
  description?: string;
  category_id?: string;
  cost_center_id?: string;
  amount: number;
  due_date: string;
  status: 'open' | 'paid' | 'overdue' | 'cancelled';
  payment_method_id?: string;
  paid_at?: string;
  paid_amount?: number;
  notes?: string;
  attachment_url?: string;
  installment_number?: number;
  total_installments?: number;
  parent_id?: string;
  created_at: string;
  updated_at: string;
  // Relations
  category?: FinancialCategory;
  cost_center?: FinancialCostCenter;
  payment_method?: FinancialPaymentMethod;
}

export interface FinancialRecurringRule {
  id: string;
  project_id: string;
  type: 'income' | 'expense';
  description: string;
  category_id?: string;
  cost_center_id?: string;
  amount: number;
  frequency: 'monthly' | 'quarterly' | 'semiannual' | 'annual';
  due_day: number;
  start_date: string;
  end_date?: string;
  is_active: boolean;
  last_generated_date?: string;
  client_or_supplier_name?: string;
  payment_method_id?: string;
  created_at: string;
  updated_at: string;
  // Relations
  category?: FinancialCategory;
  cost_center?: FinancialCostCenter;
  payment_method?: FinancialPaymentMethod;
}

export type FinancialViewType = 
  | 'dashboard' 
  | 'receivables' 
  | 'payables' 
  | 'recurring' 
  | 'cashflow' 
  | 'reports' 
  | 'settings';

export interface CashFlowProjection {
  date: string;
  openingBalance: number;
  income: number;
  expense: number;
  closingBalance: number;
}
