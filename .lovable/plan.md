

## Diagnóstico

O post agendado não foi publicado por **duas razões combinadas**:

1. **Card fora do estágio correto**: O card `53f7e9f1` está no estágio "Entrada do cliente" (`stage_type: idea`), mas o cron job (`social-scheduled-publish`) só busca cards no estágio `scheduled`. Provavelmente foi movido manualmente de volta após as falhas.

2. **Tentativas esgotadas**: O card já atingiu 3 tentativas (máximo), e não existe mecanismo para resetar automaticamente o contador quando o Instagram é reconectado.

3. **Sem reativação automática**: Quando o token é atualizado (reconexão), nenhum código limpa `publish_attempts` e `publish_error` dos cards que falharam por token inválido.

---

## Plano de Correção

### 1. Resetar cards falhados ao reconectar Instagram
No `social-instagram-auth` Edge Function, após salvar o novo token com sucesso (ações `select_account` e o fluxo de conta única), adicionar lógica que:
- Busca todos os cards do projeto que têm `publish_error` contendo "access token" ou `publish_attempts >= 3`
- Reseta `publish_attempts = 0`, `publish_error = null`
- Move esses cards de volta para o estágio `scheduled` (caso estejam em outro estágio)

### 2. Corrigir o card existente via migração SQL
Executar uma query para:
- Resetar `publish_attempts = 0` e `publish_error = null` do card `53f7e9f1`
- Mover o card de volta para o estágio `scheduled` do board correspondente

### 3. Adicionar botão "Retentar publicação" na UI
No `SocialCardDetailSheet.tsx`, quando um card tem `publish_error`, mostrar um botão que:
- Reseta `publish_attempts` e `publish_error`
- Move o card para o estágio `scheduled`
- Permite retentar sem depender exclusivamente do cron

---

## Detalhes Técnicos

### Arquivo: `supabase/functions/social-instagram-auth/index.ts`
Após o upsert bem-sucedido nas ações `select_account` (linha ~315) e fluxo de conta única (linha ~244), adicionar:

```typescript
// Reset failed cards for this project
const { data: scheduledStage } = await supabase
  .from("social_content_stages")
  .select("id")
  .eq("stage_type", "scheduled")
  .eq("board_id", /* board do projeto */)
  .single();

if (scheduledStage) {
  await supabase
    .from("social_content_cards")
    .update({
      publish_attempts: 0,
      publish_error: null,
      stage_id: scheduledStage.id,
    })
    .eq("board_id", /* board do projeto */)
    .eq("is_locked", true)
    .not("creative_url", "is", null)
    .is("published_at", null)
    .gte("publish_attempts", 1);
}
```

### Arquivo: `src/components/social/SocialCardDetailSheet.tsx`
Adicionar botão "Retentar publicação" visível quando `card.publish_error` existe, que chama update para resetar `publish_attempts` e `publish_error`, e move para `scheduled`.

### Migração SQL (one-time fix)
Resetar o card atual e movê-lo de volta para `scheduled`.

