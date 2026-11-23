// Entrada de visitante no UNV Office.
// O login anônimo do projeto foi desligado (qualquer pessoa na internet virava
// "usuário logado"). O visitante agora só entra com um convite válido, criado
// pela diretoria no próprio escritório: esta função confere o convite, cria um
// acesso de visitante e devolve a sessão pra página.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MAX_POR_CONVITE = 40;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

function senhaAleatoria() {
  const b = new Uint8Array(32);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    const token = typeof body?.token === "string" ? body.token.trim() : "";
    const name = typeof body?.name === "string" ? body.name.trim().slice(0, 32) : "";
    if (token.length < 8 || token.length > 200 || !name) {
      return json({ error: "Convite inválido ou expirado" }, 400);
    }

    const url = Deno.env.get("SUPABASE_URL")!;
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: invite } = await admin
      .from("office_guest_invites")
      .select("id")
      .eq("token", token)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();
    if (!invite) return json({ error: "Convite inválido ou expirado" }, 403);

    const { count } = await admin
      .from("office_guest_access")
      .select("id", { count: "exact", head: true })
      .eq("invite_id", invite.id);
    if ((count ?? 0) >= MAX_POR_CONVITE) {
      return json({ error: "Este convite já atingiu o limite de visitantes. Peça um link novo." }, 429);
    }

    const email = `visitante-${crypto.randomUUID()}@visitante.unvholdings.com.br`;
    const password = senhaAleatoria();
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { guest_name: name, invite_token: token },
      app_metadata: { office_guest: true, office_invite_id: invite.id },
    });
    if (createErr || !created?.user) {
      console.error("[office-guest-enter] createUser:", createErr?.message);
      return json({ error: "Não consegui criar o acesso de visitante" }, 500);
    }

    await admin.from("office_guest_access").insert({
      invite_id: invite.id,
      user_id: created.user.id,
      guest_name: name,
    });

    const pub = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: signed, error: signErr } = await pub.auth.signInWithPassword({ email, password });
    if (signErr || !signed?.session) {
      console.error("[office-guest-enter] signIn:", signErr?.message);
      return json({ error: "Não consegui abrir a sessão de visitante" }, 500);
    }

    return json({
      access_token: signed.session.access_token,
      refresh_token: signed.session.refresh_token,
    });
  } catch (e) {
    console.error("[office-guest-enter] erro:", (e as Error)?.message);
    return json({ error: "Erro ao entrar como visitante" }, 500);
  }
});
