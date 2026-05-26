-- Grant access to facunicamps tables for service_role and authenticated
GRANT ALL ON TABLE public.facunicamps_matriculas TO service_role;
GRANT ALL ON TABLE public.facunicamps_sync_runs TO service_role;

GRANT SELECT ON TABLE public.facunicamps_matriculas TO authenticated;
GRANT SELECT ON TABLE public.facunicamps_sync_runs TO authenticated;

-- Disable RLS (admin-only tables, no row-level policies needed)
ALTER TABLE public.facunicamps_matriculas DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.facunicamps_sync_runs DISABLE ROW LEVEL SECURITY;
