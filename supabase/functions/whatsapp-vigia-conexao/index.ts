// Vigia de conexão dos números de WhatsApp do Nexus (27/10/2026). Fabrício: "desconectou do
// nexus o whatsapp, quando acontecer isso tem que ter um aviso pra mim". O "Fabrício Nunnes"
// ficou desconectado de 26/10 10h31 a 27/10 sem aviso: cobrança, aviso de lead chegando e
// cobrança de contrato pro closer não saíram.
//
// Cron de 5 em 5 min. Consulta o estado REAL no servidor (Evolution /instance/connectionState),
// não o status do banco (que já mentiu). Caiu em 2 checagens seguidas → avisa no WhatsApp do
// Fabrício por outro número que esteja no ar + sino do Nexus. Segue fora → lembra a cada 3h
// (7h–22h). Voltou → manda "voltou". Números com monitorar_conexao=false ficam de fora (GP).
// POST {"teste": true} → só devolve o diagnóstico, não avisa nem grava.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const FONE = "5531989840003"; // Fabrício
const FABRICIO_STAFF = "b1a918b1-8776-4962-898e-5d97c7cc80c1";
const ENVIO_PREFERIDO = ["marceloalmeida", "financeirounv", "ricardo-santos-2", "fabricionunnes"];
const LEMBRETE_HORAS = 3;
const j = (b: unknown, s = 200) => new Response(JSON.stringify(b, null, 1), { status: s, headers: { "Content-Type": "application/json" } });

async function estadoReal(inst: any): Promise<string> {
  try {
    const r = await fetch(`${String(inst.api_url).replace(/\/+$/, "")}/instance/connectionState/${inst.instance_name}`, {
      headers: { apikey: inst.api_key }, signal: AbortSignal.timeout(15000),
    });
    if (!r.ok) return `erro ${r.status}`;
    const d = await r.json();
    return String(d?.instance?.state || d?.state || "desconhecido");
  } catch (e) {
    return "sem resposta: " + String((e as Error).message || e).slice(0, 60);
  }
}

async function avisar(sb: any, texto: string, abertos: Set<string>, instancias: any[], fora: string) {
  const ordem = [...ENVIO_PREFERIDO, ...instancias.map((i) => i.instance_name)];
  for (const nome of [...new Set(ordem)]) {
    if (nome === fora || !abertos.has(nome)) continue;
    const inst = instancias.find((i) => i.instance_name === nome);
    if (!inst || inst.is_personal) continue;
    try {
      const r = await fetch(`${String(inst.api_url).replace(/\/+$/, "")}/message/sendText/${inst.instance_name}`, {
        method: "POST", headers: { "Content-Type": "application/json", apikey: inst.api_key },
        body: JSON.stringify({ number: FONE, text: texto }), signal: AbortSignal.timeout(20000),
      });
      if (r.ok) return `enviado por ${nome}`;
    } catch { /* tenta o próximo */ }
  }
  return "nenhum número no ar pra avisar";
}

Deno.serve(async (req) => {
  const body = await req.json().catch(() => ({}));
  const teste = !!body.teste;
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: instancias } = await sb.from("whatsapp_instances")
    .select("id, instance_name, display_name, api_url, api_key, status, is_personal, monitorar_conexao")
    .is("tenant_id", null).not("api_url", "is", null);
  const lista = (instancias || []) as any[];
  const vigiadas = lista.filter((i) => i.monitorar_conexao);

  // estado real de todas (as não vigiadas também servem de canal de envio se estiverem no ar)
  const estados = new Map<string, string>();
  await Promise.all(lista.map(async (i) => estados.set(i.instance_name, await estadoReal(i))));
  const abertos = new Set([...estados.entries()].filter(([, s]) => s === "open").map(([n]) => n));

  const { data: regs } = await sb.from("whatsapp_conexao_vigia").select("*");
  const reg = new Map(((regs || []) as any[]).map((r) => [r.instance_id, r]));
  const agora = new Date();
  const horaBR = new Date(agora.getTime() - 3 * 3600000).getUTCHours();
  const hhmm = (d: Date) => new Date(d.getTime() - 3 * 3600000).toISOString().slice(11, 16);
  const ddhh = (d: Date) => { const x = new Date(d.getTime() - 3 * 3600000).toISOString(); return `${x.slice(8, 10)}/${x.slice(5, 7)} ${x.slice(11, 16)}`; };
  const saida: any[] = [];

  for (const inst of vigiadas) {
    const estado = estados.get(inst.instance_name) || "desconhecido";
    const r: any = reg.get(inst.id) || { instance_id: inst.id, falhas_seguidas: 0 };
    const aberto = estado === "open";
    const item: any = { numero: inst.display_name, estado };

    if (aberto) {
      if (r.avisado_em && !teste) {
        const desde = r.caiu_em ? ` (fora desde ${ddhh(new Date(r.caiu_em))})` : "";
        item.aviso = await avisar(sb, `Nexus — WhatsApp VOLTOU: ${inst.display_name} está conectado de novo${desde}.`, abertos, lista, inst.instance_name);
      }
      if (!teste) {
        await sb.from("whatsapp_conexao_vigia").upsert({ instance_id: inst.id, estado, falhas_seguidas: 0, caiu_em: null, avisado_em: null, checado_em: agora.toISOString() });
        if (inst.status !== "connected") await sb.from("whatsapp_instances").update({ status: "connected" }).eq("id", inst.id);
      }
    } else {
      const falhas = Number(r.falhas_seguidas || 0) + 1;
      const caiu = r.caiu_em ? new Date(r.caiu_em) : agora;
      item.falhas_seguidas = falhas;
      const lembrar = r.avisado_em && agora.getTime() - new Date(r.avisado_em).getTime() >= LEMBRETE_HORAS * 3600000 && horaBR >= 7 && horaBR < 22;
      let avisadoEm = r.avisado_em;
      if (falhas >= 2 && (!r.avisado_em || lembrar)) {
        // última mensagem que passou pelo número: mostra há quanto tempo ele está mudo de verdade
        const { data: ult } = await sb.from("crm_whatsapp_messages").select("created_at, crm_whatsapp_conversations!inner(instance_id)")
          .eq("crm_whatsapp_conversations.instance_id", inst.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
        const ultTxt = ult?.created_at ? ` Última mensagem passou por ele em ${ddhh(new Date(ult.created_at))}.` : "";
        const texto = `Nexus — WhatsApp DESCONECTADO: ${inst.display_name}${r.avisado_em ? " continua fora" : ""} (estado: ${estado}).${ultTxt}\n\n`
          + `Enquanto estiver fora, nada sai por esse número (cobranças, avisos de lead, mensagens do Atendimento e dos agentes).\n\n`
          + `Pra reconectar: Atendimento > engrenagem > Dispositivo > ${inst.display_name} > ler o QR code no celular.`;
        if (!teste) {
          item.aviso = await avisar(sb, texto, abertos, lista, inst.instance_name);
          await sb.from("onboarding_notifications").insert({
            staff_id: FABRICIO_STAFF, type: "whatsapp_desconectado",
            title: `WhatsApp desconectado: ${inst.display_name}`,
            message: `O número ${inst.display_name} está fora do ar (${estado}). Reconecte em Atendimento > engrenagem > Dispositivo.`,
            reference_type: "whatsapp_instance", reference_id: inst.id,
          });
          avisadoEm = agora.toISOString();
        } else item.aviso = "(teste: avisaria agora)";
      }
      if (!teste) {
        await sb.from("whatsapp_conexao_vigia").upsert({ instance_id: inst.id, estado, falhas_seguidas: falhas, caiu_em: caiu.toISOString(), avisado_em: avisadoEm, checado_em: agora.toISOString() });
        if (inst.status === "connected") await sb.from("whatsapp_instances").update({ status: "disconnected" }).eq("id", inst.id);
      }
      item.fora_desde = hhmm(caiu);
    }
    saida.push(item);
  }
  return j({ ok: true, teste, checado: ddhh(agora), numeros: saida });
});
