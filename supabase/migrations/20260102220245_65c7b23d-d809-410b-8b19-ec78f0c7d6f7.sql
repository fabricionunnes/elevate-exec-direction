
-- Função para calcular próximo dia útil (considera feriados nacionais brasileiros e fins de semana)
CREATE OR REPLACE FUNCTION public.get_next_business_day(start_date DATE, days_to_add INTEGER)
RETURNS DATE
LANGUAGE plpgsql
AS $$
DECLARE
  result_date DATE := start_date;
  days_added INTEGER := 0;
  current_year INTEGER;
  easter_date DATE;
  holidays DATE[];
BEGIN
  WHILE days_added < days_to_add LOOP
    result_date := result_date + INTERVAL '1 day';
    current_year := EXTRACT(YEAR FROM result_date);
    
    -- Calcular Páscoa (algoritmo de Meeus/Jones/Butcher)
    easter_date := (
      SELECT (DATE (current_year || '-03-01') + 
        (((19 * (current_year % 19) + 24) % 30) - ((19 * (current_year % 19) + 24) % 30) / 28 +
        current_year + current_year / 4 - 13 + 
        ((8 * ((current_year / 100) + 1)) / 25 - (current_year / 100) / 4 - 1) + 
        (19 * (current_year % 19) + ((8 * ((current_year / 100) + 1)) / 25 - (current_year / 100) / 4 - 1) - ((current_year / 100) - (current_year / 100) / 4 - ((8 * ((current_year / 100) + 1)) / 25 - 13) / 25 + 19 * (current_year % 19) + 15) % 30) % 30 - 
        ((current_year % 19) + 11 * (((19 * (current_year % 19) + 24) % 30) - ((19 * (current_year % 19) + 24) % 30) / 28)) / 319) * INTERVAL '1 day')::DATE
    );
    
    -- Feriados nacionais brasileiros (fixos + móveis baseados na Páscoa)
    holidays := ARRAY[
      (current_year || '-01-01')::DATE,  -- Ano Novo
      (current_year || '-04-21')::DATE,  -- Tiradentes
      (current_year || '-05-01')::DATE,  -- Dia do Trabalho
      (current_year || '-09-07')::DATE,  -- Independência
      (current_year || '-10-12')::DATE,  -- Nossa Senhora Aparecida
      (current_year || '-11-02')::DATE,  -- Finados
      (current_year || '-11-15')::DATE,  -- Proclamação da República
      (current_year || '-12-25')::DATE,  -- Natal
      easter_date - INTERVAL '47 days',  -- Carnaval (terça)
      easter_date - INTERVAL '48 days',  -- Carnaval (segunda)
      easter_date - INTERVAL '2 days',   -- Sexta-feira Santa
      easter_date + INTERVAL '60 days'   -- Corpus Christi
    ];
    
    -- Verificar se é dia útil (não é fim de semana nem feriado)
    IF EXTRACT(DOW FROM result_date) NOT IN (0, 6) AND result_date != ALL(holidays) THEN
      days_added := days_added + 1;
    END IF;
  END LOOP;
  
  RETURN result_date;
END;
$$;

-- Função para criar próxima tarefa recorrente
CREATE OR REPLACE FUNCTION public.create_next_recurring_task()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  days_offset INTEGER;
  next_due_date DATE;
  next_start_date DATE;
  new_task_id UUID;
BEGIN
  -- Só executar se a tarefa foi marcada como concluída e tem recorrência
  IF NEW.status = 'completed' AND OLD.status != 'completed' AND NEW.recurrence IS NOT NULL THEN
    
    -- Determinar offset baseado no tipo de recorrência
    CASE NEW.recurrence
      WHEN 'daily' THEN days_offset := 1;
      WHEN 'weekly' THEN days_offset := 5; -- 5 dias úteis = 1 semana
      WHEN 'monthly' THEN days_offset := 22; -- ~22 dias úteis = 1 mês
      ELSE days_offset := NULL;
    END CASE;
    
    IF days_offset IS NOT NULL THEN
      -- Calcular próxima data usando dias úteis
      next_due_date := get_next_business_day(COALESCE(NEW.due_date, CURRENT_DATE), days_offset);
      next_start_date := get_next_business_day(COALESCE(NEW.start_date, CURRENT_DATE), days_offset);
      
      -- Criar nova tarefa recorrente
      INSERT INTO public.onboarding_tasks (
        project_id,
        title,
        description,
        priority,
        status,
        due_date,
        start_date,
        recurrence,
        template_id,
        responsible_staff_id,
        assignee_id,
        sort_order,
        tags,
        estimated_hours
      ) VALUES (
        NEW.project_id,
        NEW.title,
        NEW.description,
        NEW.priority,
        'pending',
        next_due_date,
        next_start_date,
        NEW.recurrence,
        NEW.template_id,
        NEW.responsible_staff_id,
        NEW.assignee_id,
        NEW.sort_order,
        NEW.tags,
        NEW.estimated_hours
      ) RETURNING id INTO new_task_id;
      
      -- Registrar no histórico
      INSERT INTO public.onboarding_task_history (
        task_id,
        action,
        field_changed,
        new_value
      ) VALUES (
        new_task_id,
        'created',
        'recurrence',
        'Tarefa recorrente gerada automaticamente a partir de: ' || NEW.id::text
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Criar trigger para tarefas recorrentes
DROP TRIGGER IF EXISTS trigger_create_recurring_task ON public.onboarding_tasks;
CREATE TRIGGER trigger_create_recurring_task
  AFTER UPDATE ON public.onboarding_tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.create_next_recurring_task();
