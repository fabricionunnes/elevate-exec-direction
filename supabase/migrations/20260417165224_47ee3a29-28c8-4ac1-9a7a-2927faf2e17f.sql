ALTER TABLE public.whitelabel_tenants
ADD COLUMN IF NOT EXISTS allowed_menus JSONB;

COMMENT ON COLUMN public.whitelabel_tenants.allowed_menus IS
'Whitelist granular de menus que o tenant WL pode habilitar.
Formato: { "staff": ["dashboard",...], "client": ["jornada_trilha",...] }.
NULL = todos os menus liberados (default).
Array vazio = nenhum daquele tipo liberado.';