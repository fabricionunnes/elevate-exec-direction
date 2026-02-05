
# Correção do Webhook Tactiq - Validação de UUID

## Problema Identificado
O erro "invalid input syntax for type uuid: 'Lead'" ocorre porque o campo `lead_id` no Zapier está mapeado para o nome do participante do Tactiq, não para um UUID válido.

## Solução Proposta
Atualizar a edge function `tactiq-webhook` para:

1. **Validar se o `lead_id` é um UUID válido** antes de usar
2. **Buscar lead pelo nome** se o valor não for UUID (fallback inteligente)
3. **Ignorar valores inválidos** graciosamente

## Alterações Técnicas

### Arquivo: `supabase/functions/tactiq-webhook/index.ts`

**Adicionar função de validação UUID:**
```typescript
// Helper function to validate UUID format
function isValidUUID(str: string): boolean {
  if (!str || typeof str !== 'string') return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}
```

**Modificar a lógica de normalização do lead_id:**
```typescript
// Validate and normalize lead_id - only use if it's a valid UUID
const rawLeadId = lead_id || leadId || null;
const rawLeadName = lead_name || leadName || null;

const normalizedData = {
  // ... outros campos
  lead_id: rawLeadId && isValidUUID(rawLeadId) ? rawLeadId : null,
  lead_name_hint: !isValidUUID(rawLeadId) ? rawLeadId : rawLeadName, // Use invalid UUID as name hint
  // ... outros campos
};
```

**Adicionar busca por nome do lead:**
```typescript
// If lead_id is not set but we have a name hint, try to find the lead by name
if (!linkedLeadId && normalizedData.lead_name_hint) {
  const { data: leadByName } = await supabase
    .from("crm_leads")
    .select("id, pipeline_id")
    .ilike("name", `%${normalizedData.lead_name_hint}%`)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (leadByName) {
    linkedLeadId = leadByName.id;
    console.log(`Found lead by name hint: ${leadByName.id}`);
  }
}
```

## Fluxo Atualizado

```text
Webhook recebe payload do Zapier
           │
           ▼
   lead_id é UUID válido?
        /      \
      Sim       Não
       │         │
       │         ▼
       │   Usar como "name hint"
       │   e buscar lead pelo nome
       │         │
       ▼         ▼
    Usar UUID   Encontrou?
                 /    \
               Sim    Não
                │      │
                ▼      ▼
          Usar lead  Salvar sem
          encontrado vinculação
```

## Benefícios

1. **Compatibilidade retroativa**: Continua funcionando com UUIDs válidos
2. **Fallback inteligente**: Tenta encontrar o lead pelo nome se receber texto
3. **Sem erros**: Valores inválidos são ignorados graciosamente
4. **Logs melhorados**: Registra quando encontra lead por nome

## Instruções para o Zapier

Após a correção, você pode:
- **Opção A**: Remover o campo `lead_id` do mapeamento (recomendado - o auto-link por URL já funciona)
- **Opção B**: Manter o mapeamento - o sistema tentará encontrar o lead pelo nome automaticamente
