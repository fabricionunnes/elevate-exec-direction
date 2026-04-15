import { createClient } from "@supabase/supabase-js";
import * as React from "npm:react@18.3.1";
import { renderAsync } from "npm:@react-email/components@0.0.22";
import { RecoveryEmail } from "../_shared/email-templates/recovery.tsx";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SITE_NAME = "Universidade Nacional de Vendas";
const SENDER_DOMAIN = "noreply.unvholdings.com.br";
const FROM_DOMAIN = "unvholdings.com.br";
const ACCESS_EMAIL_TEMPLATE = "signup_access";
const ACCESS_EMAIL_SUBJECT = "Crie sua senha de acesso — UNV";

type ServiceSupabaseClient = ReturnType<typeof createClient>;

async function generatePasswordSetupLink(
  supabase: ServiceSupabaseClient,
  email: string,
  redirectTo: string,
) {
  const { data, error } = await supabase.auth.admin.generateLink({
    type: "recovery",
    email,
    options: { redirectTo },
  });

  if (error) throw error;

  const actionLink =
    (data as { properties?: { action_link?: string }; action_link?: string } | null)?.properties
      ?.action_link ??
    (data as { action_link?: string } | null)?.action_link;

  if (!actionLink) {
    throw new Error("Password setup link was not generated");
  }

  return actionLink;
}

function buildAccessEmailCopy(
  buyerName?: string | null,
  serviceName?: string | null,
) {
  const firstName = buyerName?.trim().split(/\s+/)[0];
  const greeting = firstName ? `Olá ${firstName},` : "Olá,";
  const serviceText = serviceName?.trim()
    ? ` para acessar o módulo ${serviceName}`
    : "";

  return {
    previewText: "Seu acesso foi liberado — Universidade Nacional de Vendas",
    title: "Seu acesso foi liberado",
    introText: `${greeting} seu acesso${serviceText} já está pronto. Clique no botão abaixo para criar sua senha e entrar no sistema.`,
    buttonLabel: "Criar senha de acesso",
    smallText:
      "Este link é pessoal e expira em breve. Se você não esperava este e-mail, pode ignorá-lo com segurança.",
  };
}

async function enqueueAccessEmail({
  supabase,
  email,
  buyerName,
  serviceName,
  confirmationUrl,
  purchaseId,
}: {
  supabase: ServiceSupabaseClient;
  email: string;
  buyerName?: string | null;
  serviceName?: string | null;
  confirmationUrl: string;
  purchaseId: string;
}) {
  const emailCopy = buildAccessEmailCopy(buyerName, serviceName);
  const templateProps = {
    siteName: SITE_NAME,
    confirmationUrl,
    ...emailCopy,
  };

  const html = await renderAsync(React.createElement(RecoveryEmail, templateProps));
  const text = await renderAsync(React.createElement(RecoveryEmail, templateProps), {
    plainText: true,
  });

  const messageId = crypto.randomUUID();

  await supabase.from("email_send_log").insert({
    message_id: messageId,
    template_name: ACCESS_EMAIL_TEMPLATE,
    recipient_email: email,
    status: "pending",
  });

  const { error: enqueueError } = await supabase.rpc("enqueue_email", {
    queue_name: "auth_emails",
    payload: {
      message_id: messageId,
      to: email,
      from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
      sender_domain: SENDER_DOMAIN,
      subject: ACCESS_EMAIL_SUBJECT,
      html,
      text,
      purpose: "transactional",
      label: ACCESS_EMAIL_TEMPLATE,
      queued_at: new Date().toISOString(),
      idempotency_key: `${ACCESS_EMAIL_TEMPLATE}-${purchaseId}-${messageId}`,
    },
  });

  if (enqueueError) {
    await supabase.from("email_send_log").insert({
      message_id: messageId,
      template_name: ACCESS_EMAIL_TEMPLATE,
      recipient_email: email,
      status: "failed",
      error_message: enqueueError.message,
    });
    throw new Error(enqueueError.message);
  }

  return messageId;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { purchase_id, force_resend_email } = await req.json();
    if (!purchase_id) {
      return new Response(JSON.stringify({ error: "purchase_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Get purchase record
    const { data: purchase, error: pErr } = await supabase
      .from("public_service_purchases")
      .select("*, service:service_catalog(*)")
      .eq("id", purchase_id)
      .single();

    if (pErr || !purchase) {
      return new Response(JSON.stringify({ error: "Purchase not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { buyer_email, buyer_name, buyer_phone, buyer_document, company_id, project_id, service } = purchase;
    const menuKey = purchase.menu_key || service?.menu_key;

    // 2. Check if already provisioned
    if (purchase.user_provisioned && !force_resend_email) {
      console.log(`[provision-service-buyer] Already provisioned for purchase ${purchase_id}`);
      return new Response(JSON.stringify({ success: true, already_provisioned: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // If force_resend_email, skip to email sending
    if (purchase.user_provisioned && force_resend_email) {
      const { buyer_email: email, buyer_name: name, service } = purchase;
      const siteUrl = Deno.env.get("SITE_URL") || "https://elevate-exec-direction.lovable.app";
      try {
        const confirmationUrl = await generatePasswordSetupLink(
          supabase,
          email,
          `${siteUrl}/reset-password`,
        );

        await enqueueAccessEmail({
          supabase,
          email,
          buyerName: name,
          serviceName: service?.name,
          confirmationUrl,
          purchaseId: purchase_id,
        });
      } catch (emailErr: any) {
        console.error("[provision-service-buyer] Resend access email error:", emailErr);
        return new Response(JSON.stringify({ error: emailErr.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      console.log(`[provision-service-buyer] Resent branded access email to ${email}`);
      return new Response(JSON.stringify({ success: true, email_resent: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Find or create auth user
    let userId: string | null = null;
    let isNewUser = false;

    // Try to create user first — if it already exists, we catch the error
    const randomPass = crypto.randomUUID() + "Aa1!";
    const { data: newUser, error: createErr } = await supabase.auth.admin.createUser({
      email: buyer_email,
      password: randomPass,
      email_confirm: true,
    });

    if (createErr && createErr.message?.includes("already been registered")) {
      // User exists — find by listing with email filter
      const { data: usersPage } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1 });
      // Use a workaround: query onboarding_users or profiles for the user_id
      const { data: existingOU } = await supabase
        .from("onboarding_users")
        .select("user_id")
        .eq("email", buyer_email)
        .limit(1)
        .maybeSingle();

      if (existingOU?.user_id) {
        userId = existingOU.user_id;
      } else {
        // Fallback: search through pages
        let page = 1;
        let found = false;
        while (!found && page <= 10) {
          const { data: batch } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
          const match = batch?.users?.find((u: any) => u.email?.toLowerCase() === buyer_email.toLowerCase());
          if (match) { userId = match.id; found = true; }
          if (!batch?.users?.length || batch.users.length < 1000) break;
          page++;
        }
      }
      console.log(`[provision-service-buyer] Found existing auth user: ${userId}`);
    } else if (createErr) {
      console.error("[provision-service-buyer] Create user error:", createErr);
      return new Response(JSON.stringify({ error: createErr.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } else {
      userId = newUser.user.id;
      isNewUser = true;
      console.log(`[provision-service-buyer] Created auth user: ${userId}`);
    }

    // 4. Find or create company + project if they don't exist
    let resolvedCompanyId = company_id;
    let resolvedProjectId = project_id;

    if (!resolvedCompanyId) {
      // Try to find by email
      const { data: existingCo } = await supabase
        .from("onboarding_companies")
        .select("id")
        .eq("email", buyer_email)
        .maybeSingle();

      if (existingCo) {
        resolvedCompanyId = existingCo.id;
      } else {
        // Create new company
        const { data: newCo, error: coErr } = await supabase
          .from("onboarding_companies")
          .insert({
            name: buyer_name,
            email: buyer_email,
            phone: buyer_phone || null,
            cnpj: buyer_document || null,
            status: "active",
          })
          .select("id")
          .single();

        if (coErr) {
          console.error("[provision-service-buyer] Company create error:", coErr);
        } else {
          resolvedCompanyId = newCo.id;
        }
      }
    }

    if (!resolvedProjectId && resolvedCompanyId) {
      // Find existing project
      const { data: existingProj } = await supabase
        .from("onboarding_projects")
        .select("id")
        .or(`company_id.eq.${resolvedCompanyId},onboarding_company_id.eq.${resolvedCompanyId}`)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingProj) {
        resolvedProjectId = existingProj.id;
      } else {
        // Create a project for the service
        const serviceName = service?.name || "Módulo Extra";
        const { data: newProj, error: projErr } = await supabase
          .from("onboarding_projects")
          .insert({
            onboarding_company_id: resolvedCompanyId,
            product_name: `${buyer_name} - ${serviceName}`,
            product_id: "modulo_extra",
            status: "active",
          })
          .select("id")
          .single();

        if (projErr) {
          console.error("[provision-service-buyer] Project create error:", projErr);
        } else {
          resolvedProjectId = newProj.id;
        }
      }
    }

    // 5. Create onboarding_user if not exists
    if (resolvedProjectId && userId) {
      const { data: existingOU } = await supabase
        .from("onboarding_users")
        .select("id")
        .eq("user_id", userId)
        .eq("project_id", resolvedProjectId)
        .maybeSingle();

      if (!existingOU) {
        await supabase.from("onboarding_users").insert({
          user_id: userId,
          email: buyer_email,
          name: buyer_name,
          project_id: resolvedProjectId,
          role: "client",
          password_changed: false,
        });
        console.log(`[provision-service-buyer] Created onboarding_user for project ${resolvedProjectId}`);
      }
    }

    // 6. Enable permissions for the purchased service
    if (resolvedProjectId && menuKey) {
      const keysToEnable = menuKey === "gestao_clientes"
        ? ["gestao_clientes", "gestao_vendas", "gestao_financeiro", "gestao_estoque", "gestao_agendamentos"]
        : [menuKey];

      for (const key of keysToEnable) {
        const { data: existingPerm } = await supabase
          .from("project_menu_permissions")
          .select("id")
          .eq("project_id", resolvedProjectId)
          .eq("menu_key", key)
          .maybeSingle();

        if (existingPerm) {
          await supabase
            .from("project_menu_permissions")
            .update({ is_enabled: true })
            .eq("id", existingPerm.id);
        } else {
          await supabase.from("project_menu_permissions").insert({
            project_id: resolvedProjectId,
            menu_key: key,
            is_enabled: true,
          });
        }
      }
      console.log(`[provision-service-buyer] Permissions enabled: ${keysToEnable.join(", ")}`);
    }

    // 7. Create portal_user if not exists
    if (userId && resolvedCompanyId) {
      const { data: existingPortal } = await supabase
        .from("portal_users")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();

      if (!existingPortal) {
        await supabase.from("portal_users").insert({
          user_id: userId,
          company_id: resolvedCompanyId,
          role: "admin_company",
          name: buyer_name,
          email: buyer_email,
        });
        console.log(`[provision-service-buyer] Created portal_user`);
      }
    }

    // 8. Send password reset email so user can set their password
    if (userId) {
      const siteUrl = Deno.env.get("SITE_URL") || "https://elevate-exec-direction.lovable.app";
      let accessEmailSent = false;
      try {
        const confirmationUrl = await generatePasswordSetupLink(
          supabase,
          buyer_email,
          `${siteUrl}/reset-password`,
        );

        await enqueueAccessEmail({
          supabase,
          email: buyer_email,
          buyerName,
          serviceName: service?.name,
          confirmationUrl,
          purchaseId: purchase_id,
        });
        accessEmailSent = true;
      } catch (emailErr) {
        console.error("[provision-service-buyer] Access email error:", emailErr);
      }

      if (accessEmailSent) {
        console.log(`[provision-service-buyer] Branded access email sent to ${buyer_email}`);
      }
    }

    // 9. Mark purchase as provisioned
    await supabase
      .from("public_service_purchases")
      .update({
        user_provisioned: true,
        company_id: resolvedCompanyId,
        project_id: resolvedProjectId,
      })
      .eq("id", purchase_id);

    // 10. Send WhatsApp notification with portal access instructions
    try {
      if (buyer_phone) {
        const phoneClean = buyer_phone.replace(/\D/g, "");
        if (phoneClean.length >= 10) {
          const { data: settings } = await supabase
            .from("crm_settings")
            .select("setting_key, setting_value")
            .in("setting_key", ["won_notification_instance_id"]);

          const instanceId = settings?.find((s: any) => s.setting_key === "won_notification_instance_id")?.setting_value;

          if (instanceId) {
            const jid = phoneClean.startsWith("55") ? `${phoneClean}@s.whatsapp.net` : `55${phoneClean}@s.whatsapp.net`;

            await supabase.functions.invoke("evolution-api", {
              body: {
                action: "sendText",
                instanceId,
                jid,
                message: `🎉 *Pagamento confirmado!*\n\n` +
                  `Olá ${buyer_name}, seu acesso ao módulo *${service?.name || "Extra"}* foi liberado!\n\n` +
                  `📧 Enviamos um email para *${buyer_email}* com um link para definir sua senha e acessar o portal.\n\n` +
                  `Qualquer dúvida, estamos à disposição! 🚀`,
              },
            });
          }
        }
      }
    } catch (whatsErr) {
      console.error("[provision-service-buyer] WhatsApp notification error:", whatsErr);
    }

    return new Response(JSON.stringify({
      success: true,
      user_id: userId,
      company_id: resolvedCompanyId,
      project_id: resolvedProjectId,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("[provision-service-buyer] Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
