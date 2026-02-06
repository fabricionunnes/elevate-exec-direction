
-- =============================================================================
-- MIGRAÇÃO: Padronizar estrutura UNV Social com template Maria Edna
-- =============================================================================

-- 1. ATUALIZAR FUNÇÃO create_social_default_stages
CREATE OR REPLACE FUNCTION public.create_social_default_stages(p_board_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stage_id uuid;
BEGIN
  -- 1. Entrada do cliente (cinza)
  INSERT INTO social_content_stages (board_id, stage_type, name, color, sort_order)
  VALUES (p_board_id, 'idea', 'Entrada do cliente', '#9CA3AF', 1)
  RETURNING id INTO v_stage_id;
  
  INSERT INTO social_stage_checklists (stage_id, title, sort_order) VALUES
    (v_stage_id, 'Criar grupo no WhatsApp', 0),
    (v_stage_id, 'Enviar o formulário de Briefing', 1),
    (v_stage_id, 'Fazer reunião de onboarding', 2);

  -- 2. Ideias (azul claro)
  INSERT INTO social_content_stages (board_id, stage_type, name, color, sort_order)
  VALUES (p_board_id, 'script', 'Ideias', '#60A5FA', 2);

  -- 3. Desenvolvimento & Ajustes (roxo)
  INSERT INTO social_content_stages (board_id, stage_type, name, color, sort_order)
  VALUES (p_board_id, 'design', 'Desenvolvimento & Ajustes', '#A78BFA', 3);

  -- 4. Revisão Interna (amarelo)
  INSERT INTO social_content_stages (board_id, stage_type, name, color, sort_order)
  VALUES (p_board_id, 'internal_review', 'Revisão Interna', '#FBBF24', 4);

  -- 5. Aprovação do Cliente (laranja)
  INSERT INTO social_content_stages (board_id, stage_type, name, color, sort_order)
  VALUES (p_board_id, 'client_approval', 'Aprovação do Cliente', '#F97316', 5);

  -- 6. Ajustes Solicitados (vermelho)
  INSERT INTO social_content_stages (board_id, stage_type, name, color, sort_order)
  VALUES (p_board_id, 'adjustments', 'Ajustes Solicitados', '#EF4444', 6);

  -- 7. Aprovado (verde)
  INSERT INTO social_content_stages (board_id, stage_type, name, color, sort_order)
  VALUES (p_board_id, 'approved', 'Aprovado', '#10B981', 7);

  -- 8. Programado (azul)
  INSERT INTO social_content_stages (board_id, stage_type, name, color, sort_order)
  VALUES (p_board_id, 'scheduled', 'Programado', '#3B82F6', 8);

  -- 9. Publicado (verde escuro)
  INSERT INTO social_content_stages (board_id, stage_type, name, color, sort_order)
  VALUES (p_board_id, 'published', 'Publicado', '#059669', 9);
END;
$$;

-- 2. MIGRAR PROJETOS EXISTENTES (exceto o modelo Maria Edna)
DO $$
DECLARE
  v_board RECORD;
  v_first_stage_id uuid;
  v_old_stages uuid[];
BEGIN
  FOR v_board IN 
    SELECT b.id as board_id
    FROM social_content_boards b
    JOIN onboarding_projects p ON b.project_id = p.id
    WHERE p.product_name = 'UNV Social'
    AND p.id != 'c90efc9f-5e18-4d44-8454-c22f153c8155'
  LOOP
    SELECT array_agg(id) INTO v_old_stages 
    FROM social_content_stages 
    WHERE board_id = v_board.board_id;
    
    IF v_old_stages IS NOT NULL THEN
      -- Deletar histórico, checklists, cards, depois etapas
      DELETE FROM social_content_history 
      WHERE from_stage_id = ANY(v_old_stages) OR to_stage_id = ANY(v_old_stages);
      
      DELETE FROM social_stage_checklists 
      WHERE stage_id = ANY(v_old_stages);
      
      DELETE FROM social_content_cards 
      WHERE stage_id = ANY(v_old_stages);
      
      DELETE FROM social_content_stages 
      WHERE id = ANY(v_old_stages);
    END IF;
    
    -- Criar novas etapas com template Maria Edna
    INSERT INTO social_content_stages (board_id, stage_type, name, color, sort_order)
    VALUES (v_board.board_id, 'idea', 'Entrada do cliente', '#9CA3AF', 1)
    RETURNING id INTO v_first_stage_id;
    
    INSERT INTO social_stage_checklists (stage_id, title, sort_order) VALUES
      (v_first_stage_id, 'Criar grupo no WhatsApp', 0),
      (v_first_stage_id, 'Enviar o formulário de Briefing', 1),
      (v_first_stage_id, 'Fazer reunião de onboarding', 2);

    INSERT INTO social_content_stages (board_id, stage_type, name, color, sort_order)
    VALUES (v_board.board_id, 'script', 'Ideias', '#60A5FA', 2);

    INSERT INTO social_content_stages (board_id, stage_type, name, color, sort_order)
    VALUES (v_board.board_id, 'design', 'Desenvolvimento & Ajustes', '#A78BFA', 3);

    INSERT INTO social_content_stages (board_id, stage_type, name, color, sort_order)
    VALUES (v_board.board_id, 'internal_review', 'Revisão Interna', '#FBBF24', 4);

    INSERT INTO social_content_stages (board_id, stage_type, name, color, sort_order)
    VALUES (v_board.board_id, 'client_approval', 'Aprovação do Cliente', '#F97316', 5);

    INSERT INTO social_content_stages (board_id, stage_type, name, color, sort_order)
    VALUES (v_board.board_id, 'adjustments', 'Ajustes Solicitados', '#EF4444', 6);

    INSERT INTO social_content_stages (board_id, stage_type, name, color, sort_order)
    VALUES (v_board.board_id, 'approved', 'Aprovado', '#10B981', 7);

    INSERT INTO social_content_stages (board_id, stage_type, name, color, sort_order)
    VALUES (v_board.board_id, 'scheduled', 'Programado', '#3B82F6', 8);

    INSERT INTO social_content_stages (board_id, stage_type, name, color, sort_order)
    VALUES (v_board.board_id, 'published', 'Publicado', '#059669', 9);
  END LOOP;
END $$;

-- 3. CRIAR BOARDS PARA PROJETOS SEM BOARD
DO $$
DECLARE
  v_project RECORD;
  v_new_board_id uuid;
  v_first_stage_id uuid;
BEGIN
  FOR v_project IN 
    SELECT p.id as project_id
    FROM onboarding_projects p
    LEFT JOIN social_content_boards b ON b.project_id = p.id
    WHERE p.product_name = 'UNV Social'
    AND b.id IS NULL
  LOOP
    INSERT INTO social_content_boards (project_id, name)
    VALUES (v_project.project_id, 'Pipeline de Conteúdo')
    RETURNING id INTO v_new_board_id;
    
    -- Criar etapas diretamente (não usar a função para evitar problemas de transação)
    INSERT INTO social_content_stages (board_id, stage_type, name, color, sort_order)
    VALUES (v_new_board_id, 'idea', 'Entrada do cliente', '#9CA3AF', 1)
    RETURNING id INTO v_first_stage_id;
    
    INSERT INTO social_stage_checklists (stage_id, title, sort_order) VALUES
      (v_first_stage_id, 'Criar grupo no WhatsApp', 0),
      (v_first_stage_id, 'Enviar o formulário de Briefing', 1),
      (v_first_stage_id, 'Fazer reunião de onboarding', 2);

    INSERT INTO social_content_stages (board_id, stage_type, name, color, sort_order)
    VALUES (v_new_board_id, 'script', 'Ideias', '#60A5FA', 2);

    INSERT INTO social_content_stages (board_id, stage_type, name, color, sort_order)
    VALUES (v_new_board_id, 'design', 'Desenvolvimento & Ajustes', '#A78BFA', 3);

    INSERT INTO social_content_stages (board_id, stage_type, name, color, sort_order)
    VALUES (v_new_board_id, 'internal_review', 'Revisão Interna', '#FBBF24', 4);

    INSERT INTO social_content_stages (board_id, stage_type, name, color, sort_order)
    VALUES (v_new_board_id, 'client_approval', 'Aprovação do Cliente', '#F97316', 5);

    INSERT INTO social_content_stages (board_id, stage_type, name, color, sort_order)
    VALUES (v_new_board_id, 'adjustments', 'Ajustes Solicitados', '#EF4444', 6);

    INSERT INTO social_content_stages (board_id, stage_type, name, color, sort_order)
    VALUES (v_new_board_id, 'approved', 'Aprovado', '#10B981', 7);

    INSERT INTO social_content_stages (board_id, stage_type, name, color, sort_order)
    VALUES (v_new_board_id, 'scheduled', 'Programado', '#3B82F6', 8);

    INSERT INTO social_content_stages (board_id, stage_type, name, color, sort_order)
    VALUES (v_new_board_id, 'published', 'Publicado', '#059669', 9);
  END LOOP;
END $$;
