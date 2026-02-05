
# Plano: Corrigir Autenticação entre Edge Functions

## Problema Detectado
O cron job (`social-scheduled-publish`) está tentando publicar o post agendado para 16:46, mas recebe erro **401 Unauthorized** porque a função `social-instagram-publish` exige autenticação e o token não está sendo passado corretamente.

Logs mostram:
- Card detectado corretamente: `1a0ec5cc-5cb4-4739-a0c9-024d71aff423`
- Horário: `scheduled_at=2026-02-05T19:46:00+00:00` (16:46 no horário de São Paulo)
- Erro: `status: 401, statusText: "Unauthorized"`
- Já está na **tentativa 2 de 3**

## Solução

Passar explicitamente o header `Authorization` com a Service Role Key na chamada `functions.invoke()`.

## Alterações Técnicas

### Arquivo: `supabase/functions/social-scheduled-publish/index.ts`

Modificar a chamada `invoke()` para incluir o header de autorização:

```typescript
// ANTES (linha 135-143):
const { data: publishResult, error: publishInvokeError } = await supabase.functions.invoke(
  "social-instagram-publish",
  {
    body: {
      cardId: card.id,
      projectId: board.project_id,
    },
  }
);

// DEPOIS:
const { data: publishResult, error: publishInvokeError } = await supabase.functions.invoke(
  "social-instagram-publish",
  {
    body: {
      cardId: card.id,
      projectId: board.project_id,
    },
    headers: {
      Authorization: `Bearer ${supabaseKey}`,
    },
  }
);
```

## Ação Imediata

Após o deploy, também vou resetar o contador de tentativas do card atual para que ele tente novamente:

```sql
UPDATE social_content_cards 
SET publish_attempts = 0, publish_error = NULL 
WHERE id = '1a0ec5cc-5cb4-4739-a0c9-024d71aff423';
```

## Resultado Esperado

1. A função `social-scheduled-publish` passará o Service Role Key corretamente
2. A função `social-instagram-publish` reconhecerá como chamada autorizada (linha 42-52)
3. O post será publicado automaticamente no próximo ciclo do cron (dentro de 1 minuto)
