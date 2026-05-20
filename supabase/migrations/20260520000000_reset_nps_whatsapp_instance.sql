-- Reset NPS survey WhatsApp instance to system default
-- Reason: NPS was accidentally configured to use 'fabricionunnes' (personal number).
-- Setting to NULL causes the survey-sender to use the system default instance instead.
UPDATE survey_send_configs
SET whatsapp_instance_name = NULL
WHERE survey_type = 'nps';
