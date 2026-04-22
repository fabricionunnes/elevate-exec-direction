
UPDATE public.crm_leads l
SET stage_entered_at = COALESCE(
  (SELECT MAX(h.created_at) FROM public.crm_lead_history h
   WHERE h.lead_id = l.id AND h.field_changed = 'stage_id'),
  l.created_at
);

UPDATE public.client_crm_leads l
SET stage_entered_at = COALESCE(
  (SELECT MAX(h.created_at) FROM public.client_crm_lead_history h
   WHERE h.lead_id = l.id AND h.field_changed = 'stage_id'),
  l.created_at
);
