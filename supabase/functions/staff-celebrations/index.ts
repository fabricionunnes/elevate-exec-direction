import { createClient } from "https://esm.sh/@supabase/supabase-js@2.110.2";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;
const j = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const firstName = (n: string) => (n || "").trim().split(/\s+/)[0] || n;

async function aiMessage(prompt: string, fallback: string): Promise<string> {
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: "claude-sonnet-5", max_tokens: 300, messages: [{ role: "user", content: prompt }] }),
    });
    if (!r.ok) return fallback;
    const d = await r.json();
    const t = (d?.content || []).filter((b: any) => b?.type === "text").map((b: any) => b.text).join("").trim();
    return t || fallback;
  } catch { return fallback; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
  try {
    const force = (await req.json().catch(() => ({}))).force_staff_id as string | undefined;
    const br = new Date(Date.now() - 3 * 3600000);
    const mmdd = `${String(br.getUTCMonth() + 1).padStart(2, "0")}-${String(br.getUTCDate()).padStart(2, "0")}`;
    const year = br.getUTCFullYear();
    const todayISO = br.toISOString().slice(0, 10);

    const { data: staff } = await supabase.from("onboarding_staff")
      .select("id, user_id, name, role, birth_date, hire_date").eq("is_active", true);
    const active = staff || [];
    const others = (celebrantId: string) => active.filter((s) => s.id !== celebrantId);

    // já celebrou hoje? (idempotência por pessoa)
    const alreadyDone = async (celebrantId: string) => {
      const { count } = await supabase.from("onboarding_notifications")
        .select("id", { count: "exact", head: true })
        .eq("reference_id", celebrantId).eq("reference_type", "staff_celebration")
        .gte("created_at", `${todayISO}T00:00:00-03:00`);
      return (count ?? 0) > 0;
    };

    const insertNotif = async (rows: any[]) => { if (!rows.length) return; const { error } = await supabase.from("onboarding_notifications").insert(rows); if (error) console.error("insert notif erro:", error.message); };

    const results: any[] = [];

    for (const s of active) {
      const isBirthday = force === s.id || (s.birth_date && s.birth_date.slice(5) === mmdd);
      const anosEmpresa = s.hire_date && s.hire_date.slice(5) === mmdd ? (year - parseInt(s.hire_date.slice(0, 4), 10)) : 0;
      const isAnniversary = (force === s.id && s.hire_date) || anosEmpresa >= 1;
      if (!isBirthday && !isAnniversary) continue;
      if (force !== s.id && await alreadyDone(s.id)) { results.push({ name: s.name, skip: "já celebrado hoje" }); continue; }

      const fn = firstName(s.name);

      if (isBirthday) {
        const msg = await aiMessage(
          `Escreva uma mensagem de FELIZ ANIVERSÁRIO curta (3 a 4 frases), calorosa, personalizada e MOTIVADORA para ${s.name}, que é ${s.role} na UNV (Universidade Nacional de Vendas). Tom humano, brasileiro, verdadeiro — nada de clichê corporativo. Pode usar 1 ou 2 emojis. Fale diretamente com a pessoa. Não assine.`,
          `Feliz aniversário, ${fn}! 🎉 Que esse novo ano venha cheio de conquistas e realizações. Obrigado por fazer parte da UNV — seu trabalho faz diferença todos os dias. Comemore muito hoje! 🎂`
        );
        await insertNotif(others(s.id).map((o) => ({
          staff_id: o.id, type: "birthday",
          title: `🎂 Hoje é aniversário de ${fn}!`,
          message: `Hoje é aniversário do(a) ${s.name}. Que tal mandar um parabéns? 🎉`,
          reference_id: s.id, reference_type: "staff_celebration", is_read: false,
        })));
        await insertNotif([{
          staff_id: s.id, type: "birthday",
          title: `🎂 Feliz aniversário, ${fn}!`, message: msg,
          reference_id: s.id, reference_type: "staff_celebration", is_read: false,
        }]);
        results.push({ name: s.name, birthday: true });
      }

      if (isAnniversary) {
        const anos = anosEmpresa >= 1 ? anosEmpresa : (year - parseInt((s.hire_date || `${year}`).slice(0, 4), 10)) || 1;
        const label = anos === 1 ? "1 ano" : `${anos} anos`;
        const msg = await aiMessage(
          `Escreva uma mensagem curta (3 a 4 frases) celebrando ${label} de ${s.name} (${s.role}) na UNV (Universidade Nacional de Vendas). Calorosa, personalizada, MOTIVADORA, reconhecendo a trajetória e o impacto da pessoa. Tom humano e brasileiro, sem clichê. 1 ou 2 emojis. Fale diretamente com a pessoa. Não assine.`,
          `Parabéns pelos ${label} de UNV, ${fn}! 🎊 Sua dedicação e trajetória são parte do que faz essa empresa crescer. Que venham muitos outros ciclos de conquista. Obrigado por tanto! 🙌`
        );
        await insertNotif(others(s.id).map((o) => ({
          staff_id: o.id, type: "work_anniversary",
          title: `🎊 ${fn} completa ${label} de UNV hoje!`,
          message: `Hoje o(a) ${s.name} completa ${label} de empresa. Vamos comemorar juntos! 🙌`,
          reference_id: s.id, reference_type: "staff_celebration", is_read: false,
        })));
        await insertNotif([{
          staff_id: s.id, type: "work_anniversary",
          title: `🎊 ${label} de UNV, ${fn}!`, message: msg,
          reference_id: s.id, reference_type: "staff_celebration", is_read: false,
        }]);
        results.push({ name: s.name, anniversary: label });
      }
    }

    return j({ ok: true, date: todayISO, celebrations: results });
  } catch (e) {
    console.error("staff-celebrations", e);
    return j({ ok: false, error: String((e as Error).message || e) }, 500);
  }
});
