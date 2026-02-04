-- Fix the handle_unv_social_project function to use product_id/product_name instead of service_id
CREATE OR REPLACE FUNCTION public.handle_unv_social_project()
RETURNS TRIGGER AS $$
DECLARE
  v_board_id UUID;
BEGIN
  -- Check if this project is for the "UNV Social" product (using product_id or product_name)
  IF NEW.product_id = 'social' OR LOWER(NEW.product_name) LIKE '%social%' THEN
    -- Create board for this project
    INSERT INTO public.social_content_boards (project_id, name)
    VALUES (NEW.id, 'Pipeline de Conteúdo')
    ON CONFLICT (project_id) DO NOTHING
    RETURNING id INTO v_board_id;
    
    -- Create default stages
    IF v_board_id IS NOT NULL THEN
      PERFORM public.create_social_default_stages(v_board_id);
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;