

# Atualizar Chave Secreta do Pagar.me

## O que será feito

Vou solicitar que você insira a nova chave secreta v5 do Pagar.me (que começa com `sk_test_` ou `sk_live_`) para substituir a chave atual que está causando o erro 401.

## Passos

1. **Solicitar a nova chave** - Usar a ferramenta de segredos para pedir que você cole a nova Secret Key v5 criada no painel do Pagar.me
2. **Testar a integração** - Após a atualização, executar um teste automático chamando a função de checkout em modo de teste para validar que a autenticação funciona corretamente

## Detalhes Técnicos

- O segredo `PAGARME_API_KEY` será atualizado nas variáveis de ambiente do backend
- A função `pagarme-checkout` já possui um modo de teste (`test_key: true`) que valida a chave contra a API do Pagar.me
- Nenhuma alteração de código é necessária - apenas a atualização do segredo

