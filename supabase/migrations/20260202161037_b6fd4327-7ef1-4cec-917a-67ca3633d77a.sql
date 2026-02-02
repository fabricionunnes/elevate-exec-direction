-- Add OTE (On-Target Earnings) commission fields to crm_goal_values
ALTER TABLE crm_goal_values 
ADD COLUMN IF NOT EXISTS ote_base NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS ote_variable NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS ote_accelerator NUMERIC DEFAULT NULL;

-- Add flag to goal types to indicate if it supports OTE
ALTER TABLE crm_goal_types
ADD COLUMN IF NOT EXISTS has_ote BOOLEAN DEFAULT false;

-- Update existing "Vendas" goal type to support OTE
UPDATE crm_goal_types SET has_ote = true WHERE name = 'Vendas';

COMMENT ON COLUMN crm_goal_values.ote_base IS 'Base salary component of OTE';
COMMENT ON COLUMN crm_goal_values.ote_variable IS 'Variable/commission component of OTE at 100% target';
COMMENT ON COLUMN crm_goal_values.ote_accelerator IS 'Multiplier for commission above 100% target (e.g., 1.5 = 150% commission rate)';