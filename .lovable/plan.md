

## Plano: Corrigir Links Públicos para Vagas e Banco de Talentos

### Problema Identificado

Os dois links públicos estão conflitando por causa das políticas de segurança do banco de dados:

| Link | Página | Comportamento Atual |
|------|--------|---------------------|
| `?public=vagas&job=...` ou `/#/job-application?job=...` | Candidatura em Vaga | Exige `source='website'` + vaga aberta |
| `?public=banco-talentos` ou `/#/banco-talentos` | Banco de Talentos | Usa `source='public_link'` + sem vaga |

A política RLS atual só aceita candidaturas com `source='website'` E uma vaga válida. O Banco de Talentos não atende nenhum desses critérios.

---

### Solução

Ajustar as políticas de segurança para permitir **ambos os cenários** de forma independente:

1. **Candidatura em Vaga**: `source='website'` + `job_opening_id` válido
2. **Banco de Talentos**: `source='public_link'` + `job_opening_id IS NULL` + `project_id` do projeto mestre

---

### Implementação

#### Parte 1: Atualizar Política RLS para `candidates`

Modificar a política "Public can submit job applications" para aceitar dois cenários:

```sql
-- Cenário 1: Candidatura para vaga específica
(EXISTS (SELECT 1 FROM job_openings jo 
         WHERE jo.id = candidates.job_opening_id 
         AND jo.status = 'open') 
 AND source = 'website')

-- OU Cenário 2: Banco de Talentos
(job_opening_id IS NULL 
 AND source = 'public_link' 
 AND project_id = '00000000-0000-0000-0000-000000000001')
```

#### Parte 2: Atualizar Política RLS para `candidate_resumes`

Garantir que currículos possam ser enviados em ambos os cenários:

```sql
-- Aceitar upload de currículos tanto para vagas quanto banco de talentos
EXISTS (SELECT 1 FROM candidates c
        LEFT JOIN job_openings jo ON jo.id = c.job_opening_id
        WHERE c.id = candidate_resumes.candidate_id
        AND (
          -- Cenário 1: Candidatura em vaga
          (c.source = 'website' AND jo.status = 'open')
          OR
          -- Cenário 2: Banco de Talentos
          (c.source = 'public_link' AND c.job_opening_id IS NULL)
        ))
```

#### Parte 3: Atualizar Política de Verificação de Duplicatas

Permitir verificação de duplicatas para ambos os cenários:

```sql
-- Verificar duplicatas em vagas
(EXISTS (SELECT 1 FROM job_openings jo 
         WHERE jo.id = candidates.job_opening_id AND jo.status = 'open'))
OR
-- Verificar duplicatas no banco de talentos
(job_opening_id IS NULL AND current_stage = 'talent_pool')
```

---

### Resultado Esperado

| Ação | Link Vagas | Link Banco Talentos |
|------|------------|---------------------|
| Criar candidato | Funciona | Funciona |
| Upload currículo | Funciona | Funciona |
| Verificar duplicatas | Funciona | Funciona |
| Visualizar (staff) | Funciona | Funciona |

---

### Arquivos Modificados

1. **Migração SQL** - Novas políticas RLS para `candidates` e `candidate_resumes`

Nenhuma mudança de código será necessária, pois as páginas já estão implementadas corretamente:
- `PublicJobApplicationPage.tsx` usa `source: 'website'`
- `PublicTalentPoolPage.tsx` usa `source: 'public_link'`

