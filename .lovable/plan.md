

# Plano: Configurar PWA Completo (Instalavel + Offline + Prompt)

O projeto ja tem um `manifest.json` basico e icones. Faltam: Service Worker, cache offline, e prompt de instalacao.

## O que sera feito

### 1. Criar Service Worker (`public/sw.js`)
- Cache de assets estaticos (JS, CSS, imagens, fontes) no evento `install`
- Estrategia "network-first" para navegacao e API, com fallback para cache
- Estrategia "cache-first" para assets estaticos
- Pagina offline de fallback quando sem conexao

### 2. Criar pagina offline (`public/offline.html`)
- Pagina simples com visual coerente (fundo escuro #0a1628) informando que o usuario esta sem conexao

### 3. Registrar o Service Worker (`src/registerSW.ts`)
- Registro do SW no `main.tsx` apos o render
- Tratamento de atualizacoes

### 4. Criar componente de Prompt de Instalacao (`src/components/PWAInstallPrompt.tsx`)
- Interceptar evento `beforeinstallprompt`
- Exibir banner/toast convidando o usuario a instalar o app
- Botao "Instalar" que aciona o prompt nativo
- Dismissavel e so aparece uma vez por sessao
- Detectar iOS e mostrar instrucoes manuais ("Adicionar a Tela Inicio")

### 5. Adicionar o prompt no Layout
- Incluir `<PWAInstallPrompt />` no componente `Layout.tsx`

### 6. Atualizar `manifest.json`
- Corrigir `start_url` para usar hash router (`/#/onboarding-tasks`)
- Adicionar `scope`, `orientation`, e `categories`

---

**Tecnico**: Nao sera usada nenhuma dependencia adicional. O Service Worker sera vanilla JS. O prompt usara a Web API `beforeinstallprompt`. Compativel com Chrome, Edge, Samsung Internet (prompt nativo) e iOS Safari (instrucoes manuais).

