import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type CreateStaffUserBody = {
  email: string;
  password: string;
  name: string;
  role: "admin" | "cs" | "consultant";
  phone?: string | null;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAuth = createClient(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: userData, error: userError } = await supabaseAuth.auth.getUser();
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const callerUserId = userData.user.id;

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Only onboarding admins can create/link staff users
    const { data: callerStaff, error: callerStaffError } = await supabaseAdmin
      .from("onboarding_staff")
      .select("id")
      .eq("user_id", callerUserId)
      .eq("role", "admin")
      .eq("is_active", true)
      .maybeSingle();

    if (callerStaffError || !callerStaff) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as Partial<CreateStaffUserBody>;
    const email = body.email?.trim().toLowerCase();
    const password = body.password;
    const name = body.name?.trim();
    const role = body.role;
    const phone = body.phone ?? null;

    if (!email || !password || !name || !role) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find existing auth user by email (fast path: list users and find email)
    // NOTE: For small internal user bases this is OK.
    const { data: usersList, error: listError } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    if (listError) {
      return new Response(JSON.stringify({ error: listError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const existingUser = usersList.users.find((u) => (u.email ?? "").toLowerCase() === email);

    let userId: string;

    if (existingUser) {
      userId = existingUser.id;
      const { error: updateAuthError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        password,
      });
      if (updateAuthError) {
        return new Response(JSON.stringify({ error: updateAuthError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      const { data: created, error: createAuthError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (createAuthError || !created.user) {
        return new Response(JSON.stringify({ error: createAuthError?.message ?? "Failed to create user" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      userId = created.user.id;
    }

    // Atualizar ou criar staff por email (sem depender de constraint única)
    const { data: existingStaff, error: existingStaffError } = await supabaseAdmin
      .from("onboarding_staff")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (existingStaffError) {
      return new Response(JSON.stringify({ error: existingStaffError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let staffId: string;

    if (existingStaff?.id) {
      staffId = existingStaff.id;
      const { error: updateStaffError } = await supabaseAdmin
        .from("onboarding_staff")
        .update({ name, role, phone, user_id: userId, is_active: true })
        .eq("id", staffId);

      if (updateStaffError) {
        return new Response(JSON.stringify({ error: updateStaffError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      const { data: inserted, error: insertStaffError } = await supabaseAdmin
        .from("onboarding_staff")
        .insert({ email, name, role, phone, user_id: userId, is_active: true })
        .select("id")
        .single();

      if (insertStaffError || !inserted?.id) {
        return new Response(JSON.stringify({ error: insertStaffError?.message ?? "Failed to create staff" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      staffId = inserted.id;
    }

    return new Response(JSON.stringify({ success: true, user_id: userId, staff_id: staffId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
