// reunioes-vincular-agenda: reunião de cliente marcada DIRETO no Google Agenda do consultor (fora do
// Nexus) passa a nascer ligada ao cliente, sem depender de alguém abrir a aba Reuniões do projeto.
// Fabrício, 24/11/2026: "independente de onde foi agendado, tem que vir o link do cliente".
//
// A cada 15 min (cron reunioes-vincular-agenda), pra cada consultor com agenda conectada:
//   1. lê os eventos de 7 dias atrás até 30 dias à frente;
//   2. descobre o cliente pelo carimbo do link do projeto na descrição ou pelo nome do cliente no
//      título (mesma regra da aba Reuniões: nome completo, ou palavra-chave inteira fora das genéricas);
//   3. cria a reunião no projeto (onboarding_meeting_notes) e carimba o link do cliente na descrição
//      do evento, sem mexer em convidados nem horário.
// Só casa quando aponta pra UM cliente; evento ambíguo, sem Meet e sem convidado, de dia inteiro,
// recusado ou cancelado fica de fora. Reunião comercial (crm_activities) nunca entra.
//
// Corpo: { dry?: true } → só simula e grava o que faria em reunioes_vinculo_log.
// A resposta devolve só contagens; o detalhe fica em reunioes_vinculo_log.
import { createClient } from "@supabase/supabase-js";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const SITE = "https://unvholdings.com.br";
const MAX_CARIMBOS_POR_RODADA = 25;

const semAcento = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "");
// mesmas palavras genéricas da aba Reuniões (MeetingHistoryPanel.filterEventsForClient)
const STOP = new Set([
  "e", "de", "da", "do", "das", "dos", "ltda", "me", "eireli", "sa", "s/a",
  "cia", "comercio", "comercial", "servicos", "grupo", "empresa", "empresarial",
  "vendas", "nacional", "universidade", "instituto", "centro", "sistema",
  "solucoes", "consultoria", "gestao", "digital", "tecnologia", "brasil",
  "industrial", "producao", "marketing", "negocios", "projetos", "global",
  "prime", "premium", "plus", "pro", "master", "total", "nova", "novo",
  "clinica", "medica", "saude", "farma", "beleza", "espaco",
  "estetica", "odontologia", "odontologica", "odonto", "advocacia", "advogados", "contabilidade",
  "transporte", "transportes", "distribuidora", "imoveis", "imobiliaria", "seguros", "engenharia",
  "construtora", "educacao", "escola", "academia", "fitness", "moveis", "pecas", "autopecas",
  "cosmeticos", "treinamentos", "treinamento", "promotora", "financeira", "tintas", "alimentos",
  "restaurante", "veiculos", "motos", "importados", "imports", "corretora", "assessoria",
  "consorcios", "medicina", "dermatologia", "laser", "hair", "beauty", "store", "shop", "loja",
  "company", "holding", "participacoes", "servico", "sistemas", "brindes",
  // palavras de título de reunião que também aparecem em nome de empresa
  "reuniao", "alinhamento", "daily", "onboarding", "planejamento", "estrategico", "monitoria", "integrado", "expert",
]);
const nomeNorm = (n: string) => semAcento(n.toLowerCase().trim()).replace(/\s+/g, " ");
const chaves = (n: string) => nomeNorm(n).split(/[\s\-_,.|]+/).filter((w) => w.length >= 4 && !STOP.has(w));
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

type Proj = { id: string; company: string; companyId: string; product: string; created_at: string; reunioes: number };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const body = await req.json().catch(() => ({}));
  const dry = body?.dry === true;
  const detalhes: any[] = [];
  const erros: string[] = [];
  let vinculadas = 0, carimbadas = 0, lidos = 0;

  try {
    // projetos vivos com consultor
    const { data: projRows, error: pErr } = await supabase
      .from("onboarding_projects")
      .select("id, product_name, status, created_at, consultant_id, onboarding_company_id, company:onboarding_companies(name)")
      .in("status", ["active", "notice_period", "cancellation_signaled", "pending"])
      .not("consultant_id", "is", null);
    if (pErr) throw new Error(`projetos: ${pErr.message}`);
    const projetos = (projRows || []).filter((p: any) => p.company?.name);
    const projById = new Map<string, any>(projetos.map((p: any) => [p.id, p]));

    // quantas reuniões cada projeto já tem (desempate quando o cliente tem 2 projetos com o mesmo consultor)
    const contagem = new Map<string, number>();
    const ids = projetos.map((p: any) => p.id);
    for (let from = 0; ids.length; from += 1000) {
      const { data } = await supabase.from("onboarding_meeting_notes").select("project_id").in("project_id", ids).order("id").range(from, from + 999);
      for (const r of data || []) contagem.set((r as any).project_id, (contagem.get((r as any).project_id) || 0) + 1);
      if (!data || data.length < 1000) break;
    }

    const consultorIds = [...new Set(projetos.map((p: any) => p.consultant_id))];
    const { data: staffRows } = await supabase.from("onboarding_staff").select("id, name, user_id, is_active").in("id", consultorIds);
    const consultores = (staffRows || []).filter((s: any) => s.user_id && s.is_active !== false);

    const googleClientId = Deno.env.get("GOOGLE_CLIENT_ID");
    const googleClientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
    const getAccessToken = async (userId: string): Promise<string | null> => {
      const { data: t } = await supabase.from("user_google_tokens").select("*").eq("user_id", userId).maybeSingle();
      if (!t) return null;
      if (!t.token_expires_at || new Date(t.token_expires_at) > new Date(Date.now() + 60_000)) return t.access_token;
      if (!googleClientId || !googleClientSecret || !t.refresh_token) return null;
      const resp = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ client_id: googleClientId, client_secret: googleClientSecret, refresh_token: t.refresh_token, grant_type: "refresh_token" }),
      });
      if (!resp.ok) return null;
      const d = await resp.json();
      await supabase.from("user_google_tokens").update({
        access_token: d.access_token, token_expires_at: new Date(Date.now() + (d.expires_in || 3600) * 1000).toISOString(),
      }).eq("user_id", userId);
      return d.access_token;
    };

    const timeMin = new Date(Date.now() - 7 * 86400000).toISOString();
    const timeMax = new Date(Date.now() + 30 * 86400000).toISOString();

    for (const c of consultores as any[]) {
      const meus: Proj[] = projetos.filter((p: any) => p.consultant_id === c.id).map((p: any) => ({
        id: p.id, company: p.company.name, companyId: p.onboarding_company_id, product: p.product_name || "", created_at: p.created_at, reunioes: contagem.get(p.id) || 0,
      }));
      if (!meus.length) continue;
      const token = await getAccessToken(c.user_id);
      if (!token) { erros.push(`${c.name}: agenda não conectada ou acesso vencido`); continue; }

      // eventos da agenda (até 500)
      const eventos: any[] = [];
      let pageToken = "";
      for (let pg = 0; pg < 2; pg++) {
        const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}&singleEvents=true&orderBy=startTime&maxResults=250${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ""}`;
        const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
        if (!r.ok) { erros.push(`${c.name}: agenda respondeu ${r.status}`); break; }
        const d = await r.json();
        eventos.push(...(d.items || []));
        pageToken = d.nextPageToken || "";
        if (!pageToken) break;
      }
      lidos += eventos.length;
      if (!eventos.length) continue;

      // o que já existe no Nexus (reunião de projeto ou reunião comercial)
      const evIds = eventos.map((e) => e.id).filter(Boolean);
      const jaProjeto = new Map<string, string>(); // google_event_id → project_id
      const jaCrm = new Set<string>();
      for (let i = 0; i < evIds.length; i += 150) {
        const lote = evIds.slice(i, i + 150);
        const [{ data: a }, { data: b }] = await Promise.all([
          supabase.from("onboarding_meeting_notes").select("google_event_id, project_id").in("google_event_id", lote),
          supabase.from("crm_activities").select("google_calendar_event_id").in("google_calendar_event_id", lote),
        ]);
        for (const r of a || []) jaProjeto.set((r as any).google_event_id, (r as any).project_id);
        for (const r of b || []) jaCrm.add((r as any).google_calendar_event_id);
      }

      // empresas do consultor, com o projeto principal de cada uma
      const porEmpresa = new Map<string, Proj[]>();
      for (const p of meus) porEmpresa.set(p.companyId, [...(porEmpresa.get(p.companyId) || []), p]);
      const principal = (lista: Proj[]) => [...lista].sort((x, y) =>
        (y.reunioes - x.reunioes) || (Number(/^(crm|unv ads)$/i.test(x.product.trim())) - Number(/^(crm|unv ads)$/i.test(y.product.trim()))) || x.created_at.localeCompare(y.created_at))[0];

      const novas: any[] = [];
      for (const ev of eventos) {
        if (!ev.id || ev.status === "cancelled" || !ev.start?.dateTime) continue;
        if (jaCrm.has(ev.id)) continue;
        const eu = (ev.attendees || []).find((a: any) => a.self);
        if (eu?.responseStatus === "declined") continue;
        const meet = ev.hangoutLink || ev.conferenceData?.entryPoints?.find((p: any) => p.entryPointType === "video")?.uri || null;
        const convidados = (ev.attendees || []).filter((a: any) => !a.self && !a.resource).length;
        const titulo = semAcento(String(ev.summary || "").toLowerCase());
        const descricao = String(ev.description || "");
        const descNorm = semAcento(descricao.toLowerCase());

        // 1) carimbo do link do projeto
        let alvo: Proj | null = null;
        let motivo = "";
        const carimbos = Array.from(descNorm.matchAll(/onboarding-tasks\/([0-9a-f-]{36})/g)).map((m) => m[1]);
        if (carimbos.length) {
          const p = carimbos.map((id) => projById.get(id)).find(Boolean);
          if (!p) continue; // carimbado pra projeto encerrado ou de fora: não mexe
          alvo = { id: p.id, company: p.company.name, companyId: p.onboarding_company_id, product: p.product_name || "", created_at: p.created_at, reunioes: contagem.get(p.id) || 0 };
          motivo = "link do projeto na descrição";
        } else {
          if (!meet && !convidados) continue; // bloco pessoal na agenda, não reunião
          // 2) nome completo do cliente no título ou na descrição
          const cheios = [...porEmpresa.values()].filter((l) => { const n = nomeNorm(l[0].company); return n.length >= 4 && (`${titulo} ${descNorm}`).includes(n); });
          if (cheios.length === 1) { alvo = principal(cheios[0]); motivo = "nome do cliente"; }
          else if (cheios.length === 0) {
            // 3) palavra-chave inteira do nome do cliente no título
            const porChave = [...porEmpresa.values()].filter((l) => chaves(l[0].company).some((k) => new RegExp(`\\b${esc(k)}\\b`, "i").test(titulo)));
            if (porChave.length === 1) { alvo = principal(porChave[0]); motivo = "palavra do nome do cliente no título"; }
          }
        }
        if (!alvo) continue;

        const existente = jaProjeto.get(ev.id);
        const link = `${SITE}/#/onboarding-tasks/${existente || alvo.id}`;
        const precisaCarimbo = !descricao.includes(`/#/onboarding-tasks/`);

        if (!existente) {
          novas.push({
            project_id: alvo.id, staff_id: c.id, google_event_id: ev.id,
            meeting_title: ev.summary || "(Sem título)", meeting_date: new Date(ev.start.dateTime).toISOString(),
            subject: ev.summary || "(Sem título)", meeting_link: meet, calendar_owner_id: c.user_id, calendar_owner_name: c.name,
          });
          detalhes.push({ consultor: c.name, evento: ev.summary, quando: ev.start.dateTime, cliente: alvo.company, produto: alvo.product, por: motivo, carimbo: precisaCarimbo });
        }

        // carimba o link do cliente na descrição (só se o consultor é o dono do evento)
        if (precisaCarimbo && !dry && carimbadas < MAX_CARIMBOS_POR_RODADA && (ev.organizer?.self || ev.guestsCanModify)) {
          const empresa = existente ? (projById.get(existente)?.company?.name || alvo.company) : alvo.company;
          const bloco = `──────────────\n<b>${empresa}</b>\n${link}`;
          const novaDesc = descricao.trim() ? `${descricao.trim()}\n\n${bloco}` : bloco;
          try {
            const pr = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(ev.id)}?sendUpdates=none`, {
              method: "PATCH",
              headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
              body: JSON.stringify({ description: novaDesc }),
            });
            if (pr.ok) carimbadas++;
            else erros.push(`${c.name}: carimbo em "${ev.summary}" respondeu ${pr.status}`);
          } catch (e) { erros.push(`${c.name}: carimbo ${String(e).slice(0, 80)}`); }
        }
      }

      if (novas.length && !dry) {
        // pela função do banco: grava sem repetir o aviso de "reunião agendada" pro consultor
        // (o vigia da agenda já avisou quando o evento nasceu no Google)
        const { data: n, error } = await supabase.rpc("reunioes_importar_da_agenda", { p_rows: novas });
        if (error) erros.push(`${c.name}: gravação ${error.message}`);
        else vinculadas += Number(n || 0);
      } else if (dry) vinculadas += novas.length;
    }
  } catch (e) {
    erros.push(String((e as any)?.message || e).slice(0, 300));
  }

  if (dry || vinculadas || carimbadas || erros.length) {
    await supabase.from("reunioes_vinculo_log").insert({ simulacao: dry, lidos, vinculadas, carimbadas, detalhes, erros }).then(() => {}, () => {});
  }
  return json({ ok: !erros.length, simulacao: dry, lidos, vinculadas, carimbadas, erros: erros.length });
});
