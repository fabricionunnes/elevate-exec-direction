

# Adicionar campo "Direcionamento para Editor de Vídeo" no Card do Pipeline

## Resumo

Adicionar uma coluna `video_editor_notes` na tabela `social_content_cards` e exibir um campo de texto no detalhe do card para que o usuário possa escrever instruções/direcionamento para o editor de vídeo (ex: "colocar emoji de fogo quando falar de resultados", "adicionar legenda estilo Hormozi", etc.).

## Mudanças

### 1. Banco de dados
- Migration: `ALTER TABLE social_content_cards ADD COLUMN video_editor_notes TEXT DEFAULT NULL`

### 2. SocialCardDetailSheet.tsx
- Novo estado `videoEditorNotes`
- Novo campo `Textarea` com label "Direcionamento para o Editor de Vídeo" — visível quando o tipo de conteúdo for `reels`, `stories` ou `video` (tipos de vídeo)
- Campo com placeholder explicativo: "Ex: Colocar emoji de fogo quando falar de resultados, legendas estilo Hormozi..."
- Salvar junto com os outros campos no `handleSave`
- Carregar no `loadCardData`

### 3. SocialCardDialog.tsx (criação)
- Adicionar o campo de direcionamento também na criação do card, visível condicionalmente para tipos de vídeo

### 4. Interface ContentCard
- Adicionar `video_editor_notes: string | null` nas interfaces usadas no pipeline

