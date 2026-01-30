
# Correção de Permissões para Criação de Dispositivos WhatsApp

## Problema Identificado

O usuário com role **master** não consegue criar dispositivos WhatsApp porque as políticas de segurança (RLS) da tabela `whatsapp_instances` permitem apenas usuários com role **admin**.

**Erro atual:**
```
new row violates row-level security policy for table "whatsapp_instances"
```

**Usuário afetado:** Fabricio (role: `master`)

## Solução

Atualizar as políticas RLS para incluir tanto `admin` quanto `master` nas permissões de gerenciamento de dispositivos.

## Alterações no Banco de Dados

Serão atualizadas 3 políticas na tabela `whatsapp_instances`:

1. **INSERT**: Permitir `admin` E `master` criarem dispositivos
2. **UPDATE**: Permitir `admin` E `master` atualizarem dispositivos  
3. **DELETE**: Permitir `admin` E `master` excluírem dispositivos

```sql
-- Remover políticas antigas
DROP POLICY IF EXISTS "Admins can insert instances" ON whatsapp_instances;
DROP POLICY IF EXISTS "Admins can update instances" ON whatsapp_instances;
DROP POLICY IF EXISTS "Admins can delete instances" ON whatsapp_instances;

-- Criar novas políticas incluindo master
CREATE POLICY "Admins and masters can insert instances" 
ON whatsapp_instances FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM onboarding_staff
    WHERE onboarding_staff.user_id = auth.uid()
    AND onboarding_staff.role IN ('admin', 'master')
  )
);

CREATE POLICY "Admins and masters can update instances" 
ON whatsapp_instances FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM onboarding_staff
    WHERE onboarding_staff.user_id = auth.uid()
    AND onboarding_staff.role IN ('admin', 'master')
  )
);

CREATE POLICY "Admins and masters can delete instances" 
ON whatsapp_instances FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM onboarding_staff
    WHERE onboarding_staff.user_id = auth.uid()
    AND onboarding_staff.role IN ('admin', 'master')
  )
);
```

## Impacto

- Usuários **master** poderão gerenciar dispositivos WhatsApp
- Usuários **admin** continuarão com as mesmas permissões
- Não afeta a visualização (SELECT) que já é liberada para todos os autenticados
- Não requer alterações no código frontend

## Observação sobre o VPS

Após corrigir as permissões RLS, ainda há o problema da Evolution API (servidor externo) que está offline:
- Erro: `Connection refused (os error 111)` para `104.236.13.238:8080`
- O dispositivo será criado no banco, mas a conexão com WhatsApp precisará ser feita quando o servidor estiver online novamente
