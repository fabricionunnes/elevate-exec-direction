-- Update function to create default stages WITH default checklist tasks
CREATE OR REPLACE FUNCTION public.create_social_default_stages(p_board_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stage_id uuid;
BEGIN
  -- 1. Integração
  INSERT INTO social_content_stages (board_id, stage_type, name, color, sort_order)
  VALUES (p_board_id, 'integration', 'Integração', '#8B5CF6', 0)
  RETURNING id INTO v_stage_id;
  
  INSERT INTO social_stage_tasks (stage_id, name, sort_order) VALUES
    (v_stage_id, 'Entrada do cliente', 0),
    (v_stage_id, 'Pesquisa e análise', 1),
    (v_stage_id, 'Estratégia de conteúdo', 2),
    (v_stage_id, 'Apresentação', 3),
    (v_stage_id, 'Criação de conteúdo', 4),
    (v_stage_id, 'Publicação', 5);

  -- 2. Informações da empresa
  INSERT INTO social_content_stages (board_id, stage_type, name, color, sort_order)
  VALUES (p_board_id, 'company_info', 'Informações da empresa', '#3B82F6', 1)
  RETURNING id INTO v_stage_id;
  
  INSERT INTO social_stage_tasks (stage_id, name, sort_order) VALUES
    (v_stage_id, 'Briefing', 0),
    (v_stage_id, 'Identidade visual e logo', 1),
    (v_stage_id, 'Login e acessos', 2),
    (v_stage_id, 'Persona', 3);

  -- 3. Pesquisas e inspirações
  INSERT INTO social_content_stages (board_id, stage_type, name, color, sort_order)
  VALUES (p_board_id, 'research', 'Pesquisas e inspirações', '#06B6D4', 2)
  RETURNING id INTO v_stage_id;

  -- 4. Em desenvolvimento
  INSERT INTO social_content_stages (board_id, stage_type, name, color, sort_order)
  VALUES (p_board_id, 'development', 'Em desenvolvimento', '#F59E0B', 3)
  RETURNING id INTO v_stage_id;

  -- 5. Aprovação do cliente
  INSERT INTO social_content_stages (board_id, stage_type, name, color, sort_order)
  VALUES (p_board_id, 'client_approval', 'Aprovação do cliente', '#EC4899', 4)
  RETURNING id INTO v_stage_id;

  -- 6. Ajustes solicitados
  INSERT INTO social_content_stages (board_id, stage_type, name, color, sort_order)
  VALUES (p_board_id, 'adjustments', 'Ajustes solicitados', '#EF4444', 5)
  RETURNING id INTO v_stage_id;

  -- 7. Aprovado
  INSERT INTO social_content_stages (board_id, stage_type, name, color, sort_order)
  VALUES (p_board_id, 'approved', 'Aprovado', '#10B981', 6)
  RETURNING id INTO v_stage_id;

  -- 8. Programado no Instagram
  INSERT INTO social_content_stages (board_id, stage_type, name, color, sort_order)
  VALUES (p_board_id, 'scheduled', 'Programado no Instagram', '#6366F1', 7)
  RETURNING id INTO v_stage_id;

  -- 9. Publicado
  INSERT INTO social_content_stages (board_id, stage_type, name, color, sort_order)
  VALUES (p_board_id, 'published', 'Publicado', '#059669', 8)
  RETURNING id INTO v_stage_id;
END;
$$;