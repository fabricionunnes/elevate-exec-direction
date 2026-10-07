// academy-tutor — Tutor IA do UNV IA Academy.
// Responde dúvidas do aluno com base no roteiro/transcrição da aula, no
// entregável pedido e no Método CRESCER. Persiste o histórico em
// ia_academy_tutor_messages. Autenticado (verify_jwt = true).
//
//   POST { onboarding_user_id, lesson_id?, message }
//   → { reply }
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const j = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") || Deno.env.get("CLAUDE_API_KEY") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MODEL = Deno.env.get("ACADEMY_TUTOR_MODEL") || "claude-sonnet-5-5";

const SYSTEM_BASE = `Você é o Tutor do UNV IA Academy, programa da UNV (Universidade Nacional de Vendas) criado por Fabrício Nunnes, diretor comercial terceirizado para PMEs.

Seu papel: ajudar o empresário a IMPLEMENTAR o que a aula ensina na empresa dele, não dar aula de novo.

Método CRESCER (7 fases): Cenário, Resultado Ideal, Estrutura, Sistema de Captação, Conversão, Escala, Revisão.
Filosofia: venda é consequência, não pressão. Sistema escala, improviso não.
Filtro de toda sugestão: o que escala? o que gera previsibilidade? o que aumenta margem? o que reduz dependência?

Regras de resposta:
- Direto, sem enrolação, sem emoji. Frases curtas. Português do Brasil.
- Não use "perfeito", "ótimo", "entendi". Pode usar "Bora", "Cara", "Faz sentido?".
- Responda com passo a passo prático quando a dúvida for de execução.
- Se a dúvida for sobre o entregável, diga exatamente o que está faltando pra ficar aprovável.
- Se o aluno pedir algo fora do escopo da aula, responda em 2 linhas e aponte a trilha certa.
- Nunca prometa resultado. Nunca invente ferramenta ou preço.
- Se faltar informação da empresa dele, faça UMA pergunta por vez.
- Máximo ~250 palavras por resposta, salvo pedido de prompt ou script completo.`;

async function callClaude(system: string, messages: { role: "user" | "assistant"; content: string }[]) {
  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: MODEL, max_tokens: 1500, temperature: 0.4, system, messages }),
  });
  if (!resp.ok) {
    const text = await resp.text();
    if (resp.status === 429) throw new Error("RATE_LIMIT");
    if (resp.status === 402) throw new Error("PAYMENT_REQUIRED");
    throw new Error(`AI error ${resp.status}: ${text.slice(0, 300)}`);
  }
  const data = await resp.json();
  return (data.content?.[0]?.text as string) || "";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return j({ error: "Não autenticado" }, 401);
    if (!ANTHROPIC_API_KEY) return j({ error: "Tutor indisponível (chave de IA não configurada)" }, 500);

    const userClient = createClient(SUPABASE_URL, SERVICE_ROLE, { global: { headers: { Authorization: auth } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return j({ error: "Não autenticado" }, 401);

    const { onboarding_user_id, lesson_id, message } = await req.json();
    const text = String(message || "").trim();
    if (!onboarding_user_id || !text) return j({ error: "onboarding_user_id e message são obrigatórios" }, 400);
    if (text.length > 4000) return j({ error: "Mensagem muito longa" }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // o onboarding_user precisa ser do próprio usuário (ou o chamador ser staff)
    const { data: ou } = await admin.from("onboarding_users").select("id, user_id, name").eq("id", onboarding_user_id).maybeSingle();
    if (!ou) return j({ error: "Aluno não encontrado" }, 404);
    if (ou.user_id !== user.id) {
      const { data: staff } = await admin
        .from("onboarding_staff").select("id").eq("user_id", user.id).eq("is_active", true).limit(1).maybeSingle();
      if (!staff) return j({ error: "Sem permissão" }, 403);
    }

    // contexto da aula
    let lessonCtx = "";
    if (lesson_id) {
      const { data: lesson } = await admin
        .from("academy_lessons")
        .select("title, description, content_md, transcript, deliverable_prompt, academy_tracks!inner(name, crescer_phase)")
        .eq("id", lesson_id)
        .maybeSingle();
      if (lesson) {
        const track = (lesson as any).academy_tracks;
        lessonCtx = `\n\nAULA ATUAL: ${lesson.title} (Trilha: ${track?.name || "?"}${track?.crescer_phase ? `, fase ${track.crescer_phase}` : ""})`;
        if (lesson.description) lessonCtx += `\nResumo: ${lesson.description}`;
        if (lesson.content_md) lessonCtx += `\n\nROTEIRO DA AULA:\n${String(lesson.content_md).slice(0, 6000)}`;
        if (lesson.transcript) lessonCtx += `\n\nTRANSCRIÇÃO (trecho):\n${String(lesson.transcript).slice(0, 6000)}`;
        if (lesson.deliverable_prompt) lessonCtx += `\n\nENTREGÁVEL PEDIDO: ${lesson.deliverable_prompt}`;

        const { data: deliv } = await admin
          .from("academy_lesson_deliverables")
          .select("status, notes, proof_url, feedback")
          .eq("lesson_id", lesson_id)
          .eq("onboarding_user_id", onboarding_user_id)
          .maybeSingle();
        if (deliv) {
          lessonCtx += `\n\nSITUAÇÃO DO ENTREGÁVEL DO ALUNO: ${deliv.status}${deliv.notes ? ` — notas: ${deliv.notes}` : ""}${deliv.feedback ? ` — feedback do revisor: ${deliv.feedback}` : ""}`;
        }
      }
    }

    // contexto do assinante (empresa/segmento) quando existir
    const { data: sub } = await admin
      .from("ia_academy_subscriptions")
      .select("company_name, segment, plan, onboarding_call_plan_md")
      .eq("onboarding_user_id", onboarding_user_id)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();
    let studentCtx = `\n\nALUNO: ${ou.name}`;
    if (sub?.company_name) studentCtx += ` — empresa: ${sub.company_name}`;
    if (sub?.segment) studentCtx += ` — segmento: ${sub.segment}`;
    if (sub?.onboarding_call_plan_md) studentCtx += `\n\nPLANO DE IA DEFINIDO NA SESSÃO INDIVIDUAL COM O FABRÍCIO:\n${String(sub.onboarding_call_plan_md).slice(0, 3000)}`;

    // histórico recente (mesma aula, ou geral)
    let histQuery = admin
      .from("ia_academy_tutor_messages")
      .select("role, content")
      .eq("onboarding_user_id", onboarding_user_id)
      .order("created_at", { ascending: false })
      .limit(12);
    histQuery = lesson_id ? histQuery.eq("lesson_id", lesson_id) : histQuery.is("lesson_id", null);
    const { data: hist } = await histQuery;
    const history = (hist || []).reverse().map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

    const messages = [...history, { role: "user" as const, content: text }];
    const reply = await callClaude(SYSTEM_BASE + lessonCtx + studentCtx, messages);

    await admin.from("ia_academy_tutor_messages").insert([
      { onboarding_user_id, lesson_id: lesson_id || null, role: "user", content: text },
      { onboarding_user_id, lesson_id: lesson_id || null, role: "assistant", content: reply },
    ]);

    return j({ reply });
  } catch (e: any) {
    const msg = e?.message || "Erro";
    if (msg === "RATE_LIMIT") return j({ error: "Muitas perguntas ao mesmo tempo. Tenta de novo em alguns segundos." }, 429);
    if (msg === "PAYMENT_REQUIRED") return j({ error: "Créditos de IA esgotados." }, 402);
    console.error("academy-tutor", e);
    return j({ error: msg }, 500);
  }
});
