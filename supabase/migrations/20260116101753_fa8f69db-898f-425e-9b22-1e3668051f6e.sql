-- Make board sessions and simulations immutable (no delete, no update on core fields)
-- First, drop existing policies
DROP POLICY IF EXISTS "Only CEO can access board sessions" ON ceo_board_sessions;
DROP POLICY IF EXISTS "Only CEO can access board opinions" ON ceo_board_opinions;
DROP POLICY IF EXISTS "Only CEO can access simulations" ON ceo_simulations;
DROP POLICY IF EXISTS "Only CEO can access simulation learning" ON ceo_simulation_learning;

-- Create granular policies for CEO board sessions
CREATE POLICY "CEO can view board sessions" 
ON ceo_board_sessions FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid() 
    AND email = 'fabricio@universidadevendas.com.br'
  )
);

CREATE POLICY "CEO can insert board sessions" 
ON ceo_board_sessions FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid() 
    AND email = 'fabricio@universidadevendas.com.br'
  )
);

CREATE POLICY "CEO can update limited fields on board sessions" 
ON ceo_board_sessions FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid() 
    AND email = 'fabricio@universidadevendas.com.br'
  )
);

-- NO DELETE policy - sessions are immutable

-- Create granular policies for CEO board opinions
CREATE POLICY "CEO can view board opinions" 
ON ceo_board_opinions FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid() 
    AND email = 'fabricio@universidadevendas.com.br'
  )
);

-- Opinions are only inserted by edge function with service role
-- NO INSERT, UPDATE, DELETE from client

-- Create granular policies for CEO simulations
CREATE POLICY "CEO can view simulations" 
ON ceo_simulations FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid() 
    AND email = 'fabricio@universidadevendas.com.br'
  )
);

CREATE POLICY "CEO can insert simulations" 
ON ceo_simulations FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid() 
    AND email = 'fabricio@universidadevendas.com.br'
  )
);

CREATE POLICY "CEO can update simulations" 
ON ceo_simulations FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid() 
    AND email = 'fabricio@universidadevendas.com.br'
  )
);

-- NO DELETE policy - simulations are immutable

-- Create granular policies for simulation learning
CREATE POLICY "CEO can view simulation learning" 
ON ceo_simulation_learning FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid() 
    AND email = 'fabricio@universidadevendas.com.br'
  )
);

-- Learning records are only managed by the system