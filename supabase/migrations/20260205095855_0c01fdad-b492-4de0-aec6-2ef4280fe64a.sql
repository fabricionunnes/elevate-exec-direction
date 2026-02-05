-- Update the function to create default stages with the correct names
CREATE OR REPLACE FUNCTION public.create_social_default_stages(p_board_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO social_content_stages (board_id, stage_type, name, color, sort_order)
  VALUES
    (p_board_id, 'integration', 'Integração', '#8B5CF6', 0),
    (p_board_id, 'company_info', 'Informações da empresa', '#3B82F6', 1),
    (p_board_id, 'research', 'Pesquisas e inspirações', '#06B6D4', 2),
    (p_board_id, 'development', 'Em desenvolvimento', '#F59E0B', 3),
    (p_board_id, 'client_approval', 'Aprovação do cliente', '#EC4899', 4),
    (p_board_id, 'adjustments', 'Ajustes solicitados', '#EF4444', 5),
    (p_board_id, 'approved', 'Aprovado', '#10B981', 6),
    (p_board_id, 'scheduled', 'Programado no Instagram', '#6366F1', 7),
    (p_board_id, 'published', 'Publicado', '#059669', 8);
END;
$$;