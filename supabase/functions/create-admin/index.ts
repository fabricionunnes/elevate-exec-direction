// DESATIVADA em 23/11/2026. Esta função criava um usuário com papel de administrador a partir de
// qualquer chamada, sem conferir quem chamava. Não é usada por nenhuma tela. Fica só respondendo
// que foi desligada, pra ninguém voltar a publicar a versão antiga por engano.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve((req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders, status: 200 });
  return new Response(JSON.stringify({ error: "Função desativada" }), {
    status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
