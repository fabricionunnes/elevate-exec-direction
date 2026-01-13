-- Drop the trigger that notifies consultants on KPI entries
DROP TRIGGER IF EXISTS notify_consultant_on_kpi_entry_trigger ON public.kpi_entries;

-- Optionally drop the function as well since it's no longer needed
DROP FUNCTION IF EXISTS public.notify_consultant_on_kpi_entry();