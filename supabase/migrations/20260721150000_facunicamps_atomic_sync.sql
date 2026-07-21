-- Sync da Facunicamps fazia delete-all + insert em lotes (~20s): quem abria o
-- dashboard durante a sync via tudo zerado. Staging + swap em transação única
-- elimina a janela vazia. (Aplicado direto em prod em 2026-07-21.)

CREATE TABLE IF NOT EXISTS public.facunicamps_matriculas_staging
  (LIKE public.facunicamps_matriculas INCLUDING DEFAULTS INCLUDING CONSTRAINTS);

ALTER TABLE public.facunicamps_matriculas_staging ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.facunicamps_matriculas_staging FROM anon, authenticated;
GRANT ALL ON public.facunicamps_matriculas_staging TO service_role;

-- WHERE true: as sessões da API têm safeupdate, que rejeita DELETE sem WHERE
CREATE OR REPLACE FUNCTION public.facunicamps_swap_matriculas()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE n integer;
BEGIN
  DELETE FROM public.facunicamps_matriculas WHERE true;
  INSERT INTO public.facunicamps_matriculas SELECT * FROM public.facunicamps_matriculas_staging;
  GET DIAGNOSTICS n = ROW_COUNT;
  DELETE FROM public.facunicamps_matriculas_staging WHERE true;
  RETURN n;
END $fn$;

REVOKE EXECUTE ON FUNCTION public.facunicamps_swap_matriculas() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.facunicamps_swap_matriculas() TO service_role;
