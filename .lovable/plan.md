
# Plano: Publicação Direta no Instagram

## Resumo

Com a conexão do Instagram funcionando, vamos implementar a funcionalidade de **agendar e publicar conteúdos diretamente no Instagram** a partir do Kanban do UNV Social. O sistema utilizará a API do Instagram Graph para enviar fotos e vídeos automaticamente.

---

## Como Vai Funcionar

### Fluxo do Usuário

1. **Criar conteúdo no Kanban** - O usuário cria um card com imagem/vídeo, legenda e hashtags
2. **Aprovar com cliente** - O conteúdo passa pelo fluxo de aprovação existente
3. **Mover para "Aprovado"** - Após aprovação, o card vai para a etapa aprovado
4. **Agendar ou Publicar** - O usuário pode:
   - **Publicar Agora**: Posta imediatamente no Instagram
   - **Agendar**: Define data/hora para publicação automática (requer Creator Studio ou solução de polling)

### Botão na Interface

Quando um card estiver na etapa **"Aprovado"**, aparecerá um botão "Publicar no Instagram" no painel de detalhes do card.

---

## Etapas de Implementação

### 1. Edge Function para Publicação (`social-instagram-publish`)
Criar uma nova função que:
- Recebe o ID do card
- Busca os dados do card (imagem, legenda, hashtags)
- Busca o token de acesso da conta Instagram conectada
- Faz o upload da mídia para o Instagram (Container API)
- Publica o conteúdo
- Registra o resultado em `social_publish_logs`
- Atualiza o card com `instagram_post_id` e `instagram_post_url`

### 2. Atualizar Interface do Card
Adicionar botão "Publicar no Instagram" no `SocialCardDetailSheet.tsx` quando:
- O card está na etapa "Aprovado" (stage_type = "approved")
- A conta Instagram está conectada ao projeto
- O card tem mídia (`creative_url`)

### 3. Publicação Agendada (Opcional)
Para agendamento automático, há duas opções:
- **Opção A**: Usar o Creator Studio da Meta (recomendado para produção)
- **Opção B**: Criar um cron job com Supabase pg_cron que verifica periodicamente cards com `scheduled_at` no passado

---

## Detalhes Técnicos

### Edge Function: `social-instagram-publish`

```text
POST /functions/v1/social-instagram-publish
Body: { cardId: string, projectId: string }

Fluxo:
1. Buscar card e conta Instagram
2. Validar que mídia existe
3. Criar container de mídia (POST /media)
4. Aguardar processamento
5. Publicar container (POST /media_publish)
6. Salvar resposta em social_publish_logs
7. Atualizar card com URL do post
8. Mover card para etapa "Publicado"
```

### Estrutura da API do Instagram

```text
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  1. Criar       │     │  2. Verificar    │     │  3. Publicar    │
│  Container      │ ──> │  Status          │ ──> │  Container      │
│  POST /{id}/    │     │  GET /{container}│     │  POST /{id}/    │
│  media          │     │  ?fields=status  │     │  media_publish  │
└─────────────────┘     └──────────────────┘     └─────────────────┘
```

### Botão na UI

Localização: `SocialCardDetailSheet.tsx` na seção de ações, próximo ao botão "Salvar"

---

## Limitações da API do Instagram

| Tipo | Suportado | Notas |
|------|-----------|-------|
| Imagem única | ✅ Sim | JPEG recomendado |
| Vídeo (Reels) | ✅ Sim | MP4, até 90s |
| Carrossel | ✅ Sim | 2-10 itens |
| Stories | ❌ Não | Não suportado pela API |

---

## Arquivos a Serem Modificados

1. **Novo**: `supabase/functions/social-instagram-publish/index.ts`
2. **Editar**: `src/components/social/SocialCardDetailSheet.tsx` - adicionar botão de publicação
3. **Editar**: `supabase/config.toml` - registrar nova função

---

## Resultado Final

Após a implementação, o usuário poderá:
- ✅ Aprovar conteúdo com o cliente
- ✅ Clicar em "Publicar no Instagram" 
- ✅ Ver o post aparecer automaticamente no Instagram
- ✅ Acessar o link direto do post publicado
- ✅ Visualizar histórico de publicações com logs de sucesso/erro
