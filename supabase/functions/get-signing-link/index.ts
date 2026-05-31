import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, createErrorResponse, createSuccessResponse, generateToken, hashString } from "../_shared/utils.ts";

const APP_URL = Deno.env.get("APP_URL") ?? "https://unvholdings.com.br";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return createErrorResponse("Não autorizado", 401);

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) return createErrorResponse("Não autorizado", 401);

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { signer_id } = await req.json() as { signer_id?: string };
    if (!signer_id) return createErrorResponse("signer_id obrigatório", 400);

    // Verifica que o signer pertence a um envelope do usuário
    const { data: signer } = await supabaseAdmin
      .from("signers")
      .select("id, name, email, status, envelope_id")
      .eq("id", signer_id)
      .maybeSingle();

    if (!signer) return createErrorResponse("Signatário não encontrado", 404);

    const { data: envelope } = await supabaseAdmin
      .from("envelopes")
      .select("id, owner_user_id, status, expires_at")
      .eq("id", signer.envelope_id)
      .maybeSingle();

    if (!envelope) return createErrorResponse("Envelope não encontrado", 404);
    if (envelope.owner_user_id !== user.id) return createErrorResponse("Acesso negado", 403);
    if (signer.status === "signed") return createErrorResponse("Signatário já assinou", 400);
    if (signer.status === "declined") return createErrorResponse("Signatário recusou a assinatura", 400);

    // Gera novo token (apaga os antigos não usados)
    await supabaseAdmin.from("signing_tokens").delete().eq("signer_id", signer_id).is("used_at", null);

    const rawToken = generateToken();
    const tokenHash = await hashString(rawToken);
    const expiresAt = new Date(Date.now() + 7 * 86_400_000).toISOString();

    const { error: tokErr } = await supabaseAdmin.from("signing_tokens").insert({
      signer_id,
      token_hash: tokenHash,
      expires_at: expiresAt,
    });

    if (tokErr) return createErrorResponse("Erro ao gerar link", 500);

    const signingUrl = `${APP_URL}/#/assinar/${rawToken}`;

    return createSuccessResponse({
      signing_url: signingUrl,
      signer_name: signer.name,
      signer_email: signer.email,
      expires_at: expiresAt,
    });
  } catch (err) {
    console.error(err);
    return createErrorResponse("Erro interno", 500);
  }
});
