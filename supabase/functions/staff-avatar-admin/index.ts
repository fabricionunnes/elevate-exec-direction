import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Admin/master define ou remove a foto de OUTRO membro do time.
// O AvatarUpload de autoatendimento só grava a foto do próprio usuário (RLS +
// staff_set_my_avatar), então editar a foto de alguém aqui precisa do service role.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseAuth = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: userData, error: userError } = await supabaseAuth.auth.getUser();
  if (userError || !userData?.user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: callerStaff } = await supabaseAdmin
    .from("onboarding_staff").select("role").eq("user_id", userData.user.id).eq("is_active", true).maybeSingle();
  if (!callerStaff || !["admin", "master"].includes(callerStaff.role)) {
    return new Response(JSON.stringify({ error: "Forbidden - insufficient permissions" }), {
      status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const form = await req.formData();
    const staffId = String(form.get("staff_id") || "");
    if (!staffId) {
      return new Response(JSON.stringify({ error: "Missing staff_id" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: target, error: targetErr } = await supabaseAdmin
      .from("onboarding_staff").select("id, user_id, avatar_url").eq("id", staffId).single();
    if (targetErr || !target) {
      return new Response(JSON.stringify({ error: "Membro não encontrado" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!target.user_id) {
      return new Response(JSON.stringify({ error: "Esse membro ainda não tem acesso criado (sem user_id)" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const remove = form.get("remove") === "true";
    const oldPath = target.avatar_url?.split("/avatars/")[1]?.split("?")[0];

    if (remove) {
      if (oldPath) await supabaseAdmin.storage.from("avatars").remove([oldPath]);
      await supabaseAdmin.from("onboarding_staff").update({ avatar_url: null }).eq("id", staffId);
      return new Response(JSON.stringify({ success: true, avatar_url: null }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const file = form.get("file") as File | null;
    if (!file) {
      return new Response(JSON.stringify({ error: "Nenhum arquivo enviado" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!file.type.startsWith("image/")) {
      return new Response(JSON.stringify({ error: "O arquivo precisa ser uma imagem" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (file.size > 5 * 1024 * 1024) {
      return new Response(JSON.stringify({ error: "A imagem deve ter no máximo 5MB" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const path = `${target.user_id}/avatar.${ext}`;
    if (oldPath && oldPath !== path) await supabaseAdmin.storage.from("avatars").remove([oldPath]);

    const bytes = new Uint8Array(await file.arrayBuffer());
    const { error: uploadErr } = await supabaseAdmin.storage
      .from("avatars").upload(path, bytes, { upsert: true, contentType: file.type });
    if (uploadErr) {
      return new Response(JSON.stringify({ error: uploadErr.message }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: { publicUrl } } = supabaseAdmin.storage.from("avatars").getPublicUrl(path);
    await supabaseAdmin.from("onboarding_staff").update({ avatar_url: publicUrl }).eq("id", staffId);

    return new Response(JSON.stringify({ success: true, avatar_url: `${publicUrl}?t=${Date.now()}` }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
