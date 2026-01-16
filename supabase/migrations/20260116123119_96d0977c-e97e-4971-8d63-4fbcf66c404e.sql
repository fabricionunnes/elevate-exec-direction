-- Recriar a função is_ceo() com SECURITY DEFINER para poder acessar auth.users
CREATE OR REPLACE FUNCTION public.is_ceo()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM auth.users u
    WHERE u.id = auth.uid()
      AND u.email = 'fabricio@universidadevendas.com.br'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Recriar a política de ceo_scores usando a função is_ceo()
DROP POLICY IF EXISTS "Only fabricio can access ceo_scores" ON public.ceo_scores;

CREATE POLICY "CEO can manage ceo_scores"
ON public.ceo_scores
FOR ALL
USING (public.is_ceo())
WITH CHECK (public.is_ceo());