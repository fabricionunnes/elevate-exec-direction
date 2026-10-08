# YasFood

Sistema de pedidos tipo iFood para a **Yas Delícias** (bolos caseiros da Yasmim).

- **Cliente** (sem login): cardápio, carrinho, escolhe a data com vagas, entrega ou retirada, paga por Pix/dinheiro/cartão, acompanha o pedido em tempo real (estilo Mercado Livre) e avalia com 1 a 5 estrelas + comentário.
- **Painel da Yasmim** (login com e-mail e senha): pedidos, agenda de produção com capacidade por dia, cardápio com fotos, zonas de entrega e frete, clientes e leads (CRM com histórico de compras), estoque com receita e baixa automática, financeiro, avaliações com pedido automático após a entrega, configurações.

## Stack

React + Vite + TypeScript + Tailwind, Supabase (Postgres, Auth, Storage, RLS, pg_cron, pg_net). Mesmo stack do UNV Nexus e compatível com Lovable.

## Subir em 15 minutos

1. **Criar o projeto no Supabase** (região São Paulo).
2. **Aplicar as migrations** (na ordem) no SQL Editor ou via CLI:
   - `supabase/migrations/20261008200000_yasfood_schema.sql`
   - `supabase/migrations/20261008200100_yasfood_seed.sql` (produtos, zonas, insumos, agenda de 30 dias)
3. **Criar o usuário da Yasmim e torná-lo admin**:
   ```bash
   SUPABASE_URL=https://xxx.supabase.co SUPABASE_SERVICE_ROLE_KEY=... \
   ADMIN_EMAIL=email@dela.com ADMIN_PASSWORD='senha-forte' \
   node scripts/create-admin.mjs
   ```
   Alternativa: criar o usuário em Authentication → Users e rodar `insert into admins (user_id, name) values ('<uuid>', 'Yasmim');`.
4. **Configurar o front**: copie `.env.example` para `.env` e preencha `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.
5. **Rodar**: `npm install && npm run dev` → http://localhost:8081. Painel em `/admin`.
6. **Publicar**: `npm run build` e hospedar a pasta `dist` (Vercel/Netlify/Cloudflare Pages) com fallback de SPA para `index.html`. Depois, no painel → Configurações, preencha **Endereço do site** (usado nos links de rastreio enviados por WhatsApp) e suba a logo da loja.

## Avaliação automática após a entrega

Ao marcar um pedido como **Entregue**, o sistema agenda o pedido de avaliação para X horas depois (padrão 3h, ajustável no painel).

- **Automático**: um job do `pg_cron` roda a cada 10 min e faz POST no webhook configurado (N8N → WhatsApp API) com `{ event, order_id, code, name, phone, link, message }`. O N8N só precisa mandar `message` para `phone`.
- **Manual**: sem webhook, a fila aparece em Painel → Avaliações com botão "Enviar no Whats" (abre o WhatsApp com a mensagem pronta).

## WhatsApp

Todo contato com o cliente sai do painel com mensagem pronta (confirmação, Pix, saiu pra entrega, pedir avaliação, abordar lead, reativar cliente sumido). Usa links `wa.me`, então funciona no WhatsApp da Yasmim sem API. Para envio 100% automático, conectar o N8N + WhatsApp API no webhook acima.

## Segurança

- Preços, frete, capacidade e datas são validados **no banco** (`place_order`), nunca no front.
- Clientes não precisam de login: cada pedido tem um token único de rastreio.
- Tabelas privadas (pedidos, clientes, estoque, financeiro) só são lidas por quem está na tabela `admins`.
- A `service_role` key é usada só no script de criação de admin, nunca no front.

## Estrutura

```
src/
  lib/          supabase, tipos, formatação, carrinho, auth, mensagens WhatsApp
  components/   ui (botões, inputs, modal, toast, estrelas), timeline de status, marca
  pages/cliente Cardápio, Checkout, Pedido (rastreio + avaliação), Meus pedidos
  pages/admin   Login, Dashboard, Pedidos, Agenda, Cardápio, Entregas, Clientes, Estoque, Financeiro, Avaliações, Configurações
supabase/migrations   schema + seed
scripts/create-admin.mjs
```
