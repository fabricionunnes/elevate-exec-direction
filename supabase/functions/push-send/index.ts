// Envia o push de UMA notificação (chamado pelo gatilho zz_notification_push com { notification_id }).
// Sem segredo na chamada: só envia se a notificação existir, for recente (15 min) e ainda não tiver push_status.
// Aparelho que o navegador diz que não existe mais (404/410) sai da lista sozinho.
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const json = (p: unknown, s = 200) => new Response(JSON.stringify(p), { status: s, headers: { "Content-Type": "application/json" } });
const PUB = Deno.env.get("VAPID_PUBLIC_KEY") || "", PRIV = Deno.env.get("VAPID_PRIVATE_KEY") || "";
if (PUB && PRIV) webpush.setVapidDetails(Deno.env.get("VAPID_SUBJECT") || "mailto:contato@unvholdings.com.br", PUB, PRIV);

Deno.serve(async (req) => {
  try {
    if (!PUB || !PRIV) return json({ skip: "push não configurado" });
    const { notification_id } = await req.json().catch(() => ({}));
    if (!/^[0-9a-f-]{36}$/i.test(String(notification_id || ""))) return json({ skip: "id inválido" });
    const { data: n } = await supabase.from("onboarding_notifications")
      .select("id, staff_id, user_id, type, title, message, action_url, reference_id, reference_type, project_id, created_at, push_status").eq("id", notification_id).maybeSingle();
    if (!n || n.push_status) return json({ skip: "nada a enviar" });
    if (Date.now() - new Date(n.created_at).getTime() > 15 * 60000) return json({ skip: "antiga" });

    let authId: string | null = null;
    if (n.staff_id) authId = (await supabase.from("onboarding_staff").select("user_id").eq("id", n.staff_id).maybeSingle()).data?.user_id || null;
    else if (n.user_id) authId = (await supabase.from("onboarding_users").select("user_id").eq("id", n.user_id).maybeSingle()).data?.user_id || null;
    if (!authId) return json({ skip: "sem login" });

    const { data: subs } = await supabase.from("push_subscriptions").select("id, endpoint, p256dh, auth, failed_count").eq("auth_user_id", authId);
    if (!subs?.length) { await supabase.from("onboarding_notifications").update({ push_status: "sem_aparelho" }).eq("id", n.id); return json({ skip: "sem aparelho" }); }

    const payload = JSON.stringify({ id: n.id, title: n.title, body: n.message || "", url: n.action_url || (n.staff_id ? "/#/onboarding-tasks" : "/#/onboarding-client"), tag: `${n.type}:${n.reference_id || n.id}` });
    let ok = 0, removidos = 0;
    for (const s of subs) {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 60 * 60 * 12, urgency: "normal" });
        ok++;
        await supabase.from("push_subscriptions").update({ last_ok_at: new Date().toISOString(), failed_count: 0 }).eq("id", s.id);
      } catch (e: any) {
        const code = Number(e?.statusCode || 0);
        if (code === 404 || code === 410) { await supabase.from("push_subscriptions").delete().eq("id", s.id); removidos++; }
        else await supabase.from("push_subscriptions").update({ failed_count: (s.failed_count || 0) + 1 }).eq("id", s.id);
      }
    }
    await supabase.from("onboarding_notifications").update({ push_status: ok ? `enviado:${ok}` : "falhou" }).eq("id", n.id);
    return json({ ok: true, enviados: ok, removidos });
  } catch (e) { return json({ error: String(e).slice(0, 200) }, 500); }
});
