
-- Move lead "Fabrício Teste Isca de baleia" do pipeline "Scanner de Vendas UNV" para "Isca de baleia"
UPDATE public.crm_leads
SET pipeline_id = 'b3645f0f-a57b-4edd-839c-c4a21a477dcf',
    stage_id = '99c4f246-8d03-4a32-b649-d87eaa3f22be'
WHERE id = 'c10be882-b5f6-4df8-9335-65881dd2e9c0';
