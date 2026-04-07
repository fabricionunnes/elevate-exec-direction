
# Módulo WhatsApp — Plano de Implementação

## Fase 1: Banco de Dados e Infraestrutura
1. **Tabelas novas:**
   - `staff_whatsapp_instances` — instância pessoal de cada usuário (vinculada ao staff, status, dados Stevo)
   - `staff_whatsapp_conversations` — conversas do módulo global (contato, última msg, unread, tags, projeto vinculado, staff dono)
   - `staff_whatsapp_messages` — mensagens individuais (texto, mídia, status leitura, timestamps)
   - `staff_whatsapp_tags` — tags disponíveis (lead, cliente, proposta enviada, etc.)
   - `staff_whatsapp_conversation_tags` — vínculo conversa↔tag
   - `staff_whatsapp_access_grants` — acesso ampliado (admin libera staff X ver conversas de staff Y)
   - `staff_whatsapp_connection_logs` — histórico de conexão/desconexão/falhas
   - RLS policies para isolamento por usuário e bypass para admin/master

2. **Edge Function:**
   - `staff-whatsapp-api` — proxy para Stevo (criar instância, QR code, enviar msg, enviar mídia, status conexão)

## Fase 2: Interface — Páginas e Rotas
3. **Rota global:** `/whatsapp` no menu principal do OnboardingStaffLayout
4. **Sub-rotas:**
   - `/whatsapp` — hub principal (3 colunas: lista conversas | chat | dados contato)
   - `/whatsapp/connect` — gerenciar conexão da instância pessoal

5. **Dentro do projeto:** Novo item no menu lateral "Conversas (WhatsApp)" mostrando conversas vinculadas ao projeto

## Fase 3: Componentes UI
6. **WhatsAppHub** — layout 3 colunas responsivo (mobile: navegação por abas)
7. **ConversationList** — lista com busca, filtros (projeto, usuário, tags, status)
8. **ChatView** — mensagens, envio de texto/áudio/imagem/arquivo
9. **ContactPanel** — dados do contato, vincular/alterar projeto
10. **ConnectWhatsApp** — QR code, status da conexão
11. **ConnectionHistory** — log de conexão/desconexão

## Fase 4: Funcionalidades Avançadas
12. **Notificações** — badge no menu, contador de não lidas
13. **Tags** — CRUD e filtros
14. **Integração com Ações/Jornada** — botão "Criar ação a partir da conversa"
15. **Permissões** — admin vê tudo, consultor vê só suas conversas + projetos vinculados
16. **Envio em massa** — (opcional, fase posterior)

## Fase 5: Responsividade
17. Mobile-first: lista conversas em tela cheia → toque abre chat → botão para painel de contato

---

**Obs:** Vou implementar em etapas, começando pela Fase 1 (banco) e avançando progressivamente. Posso iniciar?
