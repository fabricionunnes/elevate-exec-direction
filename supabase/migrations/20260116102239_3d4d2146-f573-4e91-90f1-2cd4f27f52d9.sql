-- Create CEO check helper (security definer so it can read auth.users safely)
CREATE OR REPLACE FUNCTION public.is_ceo()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM auth.users u
    WHERE u.id = auth.uid()
      AND u.email = 'fabricio@universidadevendas.com.br'
  );
$$;

-- Recreate policies to avoid direct auth.users access from RLS expressions
-- Board sessions
DROP POLICY IF EXISTS "CEO can view board sessions" ON public.ceo_board_sessions;
DROP POLICY IF EXISTS "CEO can insert board sessions" ON public.ceo_board_sessions;
DROP POLICY IF EXISTS "CEO can update limited fields on board sessions" ON public.ceo_board_sessions;

CREATE POLICY "CEO can view board sessions"
ON public.ceo_board_sessions
FOR SELECT
TO public
USING (public.is_ceo());

CREATE POLICY "CEO can insert board sessions"
ON public.ceo_board_sessions
FOR INSERT
TO public
WITH CHECK (public.is_ceo());

CREATE POLICY "CEO can update limited fields on board sessions"
ON public.ceo_board_sessions
FOR UPDATE
TO public
USING (public.is_ceo());

-- Board opinions
DROP POLICY IF EXISTS "CEO can view board opinions" ON public.ceo_board_opinions;

CREATE POLICY "CEO can view board opinions"
ON public.ceo_board_opinions
FOR SELECT
TO public
USING (public.is_ceo());

-- Simulations
DROP POLICY IF EXISTS "CEO can view simulations" ON public.ceo_simulations;
DROP POLICY IF EXISTS "CEO can insert simulations" ON public.ceo_simulations;
DROP POLICY IF EXISTS "CEO can update simulations" ON public.ceo_simulations;

CREATE POLICY "CEO can view simulations"
ON public.ceo_simulations
FOR SELECT
TO public
USING (public.is_ceo());

CREATE POLICY "CEO can insert simulations"
ON public.ceo_simulations
FOR INSERT
TO public
WITH CHECK (public.is_ceo());

CREATE POLICY "CEO can update simulations"
ON public.ceo_simulations
FOR UPDATE
TO public
USING (public.is_ceo());

-- Simulation learning
DROP POLICY IF EXISTS "CEO can view simulation learning" ON public.ceo_simulation_learning;

CREATE POLICY "CEO can view simulation learning"
ON public.ceo_simulation_learning
FOR SELECT
TO public
USING (public.is_ceo());
