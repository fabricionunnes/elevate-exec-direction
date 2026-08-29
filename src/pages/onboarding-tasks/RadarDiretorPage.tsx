// Radar do Diretor: toda a carteira em bolhas — vermelho é onde o diretor
// precisa agir AGORA, e a bolha já diz o assunto (fatura vencida, grupo mudo,
// sinal de cancelamento, saúde despencando). Tamanho da bolha = valor do
// contrato: problema grande em cliente grande grita mais alto.
// Fontes: client_health_scores (motor de saúde, cron diário), semáforo do
// WhatsApp (client_whatsapp_signals), faturas (company_invoices) e o próprio
// projeto (NPS, bloqueios, sinal de cancelamento, fim de contrato).
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import {
  ArrowLeft, Loader2, Search, AlertTriangle, MessageSquareOff, Receipt,
  TrendingDown, PhoneOff, CalendarClock, Ban, HeartPulse, ExternalLink, RefreshCw,
} from "lucide-react";
import { differenceInDays, format } from "date-fns";
import { ptBR } from "date-fns/locale";

type Nivel = "vermelho" | "amarelo" | "verde";

interface Assunto {
  texto: string;
  detalhe?: string;
  icone: React.ReactNode;
  peso: number; // maior = mais urgente (define o assunto que aparece na bolha)
}

interface EmpresaRadar {
  id: string;
  nome: string;
  contrato: number;
  nivel: Nivel;
  score: number | null;
  risco: string | null;
  tendencia: string | null;
  assuntos: Assunto[];
  componentes: { rotulo: string; valor: number }[];
}

const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

const NIVEL_UI: Record<Nivel, { rotulo: string; bolha: string; anel: string; texto: string }> = {
  vermelho: {
    rotulo: "Crítico — agir agora",
    bolha: "bg-red-500/90 hover:bg-red-500 shadow-red-500/40",
    anel: "ring-red-500/50",
    texto: "text-red-600",
  },
  amarelo: {
    rotulo: "Atenção — acompanhar de perto",
    bolha: "bg-amber-400/90 hover:bg-amber-400 shadow-amber-400/40",
    anel: "ring-amber-400/50",
    texto: "text-amber-600",
  },
  verde: {
    rotulo: "Saudável",
    bolha: "bg-emerald-500/85 hover:bg-emerald-500 shadow-emerald-500/30",
    anel: "ring-emerald-500/40",
    texto: "text-emerald-600",
  },
};

export default function RadarDiretorPage() {
  const navigate = useNavigate();
  const [empresas, setEmpresas] = useState<EmpresaRadar[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [selecionada, setSelecionada] = useState<EmpresaRadar | null>(null);
  const [atualizadoEm, setAtualizadoEm] = useState<Date | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    const hoje = new Date();
    const [empRes, projRes, healthRes, waRes, invRes] = await Promise.all([
      (supabase as any).from("onboarding_companies")
        .select("id, name, contract_value").eq("status", "active"),
      (supabase as any).from("onboarding_projects")
        .select("id, onboarding_company_id, status, current_nps, current_blockers, cancellation_signal_reason, cancellation_signal_date, retention_status, contract_end_date, product_name")
        .in("status", ["active", "cancellation_signaled"]),
      (supabase as any).from("client_health_scores")
        .select("project_id, total_score, risk_level, goals_score, commercial_score, engagement_score, support_score, satisfaction_score, trend_direction, last_calculated_at"),
      (supabase as any).from("client_whatsapp_signals")
        .select("company_id, rag, last_message_at, msgs_7d"),
      (supabase as any).from("company_invoices")
        .select("company_id, amount_cents, due_date").eq("status", "overdue"),
    ]);

    const projetos = (projRes.data || []) as any[];
    const healthPorProjeto = new Map<string, any>();
    (healthRes.data || []).forEach((h: any) => healthPorProjeto.set(h.project_id, h));
    const waPorEmpresa = new Map<string, any>();
    (waRes.data || []).forEach((w: any) => waPorEmpresa.set(w.company_id, w));
    const faturasPorEmpresa = new Map<string, any[]>();
    (invRes.data || []).forEach((f: any) => {
      const lista = faturasPorEmpresa.get(f.company_id) || [];
      lista.push(f); faturasPorEmpresa.set(f.company_id, lista);
    });

    let ultimaCalc: Date | null = null;

    const lista: EmpresaRadar[] = ((empRes.data || []) as any[]).map((emp) => {
      const projs = projetos.filter((p) => p.onboarding_company_id === emp.id);
      // Empresa com mais de um produto: vale o PIOR projeto (é lá que mora o risco)
      const healths = projs.map((p) => healthPorProjeto.get(p.id)).filter(Boolean);
      const pior = healths.length
        ? healths.reduce((a, b) => (Number(a.total_score) <= Number(b.total_score) ? a : b))
        : null;
      if (pior?.last_calculated_at) {
        const d = new Date(pior.last_calculated_at);
        if (!ultimaCalc || d > ultimaCalc) ultimaCalc = d;
      }
      const wa = waPorEmpresa.get(emp.id);
      const faturas = faturasPorEmpresa.get(emp.id) || [];
      const assuntos: Assunto[] = [];

      // 1. Sinal de cancelamento — o alarme mais alto que existe
      const sinalizado = projs.find((p) => p.status === "cancellation_signaled" || p.cancellation_signal_reason);
      if (sinalizado) {
        assuntos.push({
          texto: "Sinalizou cancelamento",
          detalhe: [sinalizado.cancellation_signal_reason,
            sinalizado.cancellation_signal_date && `em ${format(new Date(sinalizado.cancellation_signal_date), "dd/MM", { locale: ptBR })}`]
            .filter(Boolean).join(" · ") || undefined,
          icone: <Ban className="h-4 w-4" />, peso: 100,
        });
      }

      // 2. Fatura vencida
      if (faturas.length) {
        const total = faturas.reduce((s, f) => s + (f.amount_cents || 0), 0) / 100;
        const maisAntiga = faturas.reduce((a, b) => (a.due_date <= b.due_date ? a : b));
        const dias = differenceInDays(hoje, new Date(maisAntiga.due_date + "T12:00:00"));
        assuntos.push({
          texto: `Fatura vencida: ${brl(total)}`,
          detalhe: `${faturas.length} fatura${faturas.length > 1 ? "s" : ""} · a mais antiga há ${dias} dia${dias === 1 ? "" : "s"}`,
          icone: <Receipt className="h-4 w-4" />, peso: 90,
        });
      }

      // 3. WhatsApp mudo / relação esfriando
      const diasMudo = wa?.last_message_at
        ? differenceInDays(hoje, new Date(wa.last_message_at)) : null;
      if (wa?.rag === "red" || (diasMudo !== null && diasMudo >= 7)) {
        assuntos.push({
          texto: diasMudo !== null && diasMudo >= 1
            ? `Grupo de WhatsApp mudo há ${diasMudo} dias`
            : "Relação esfriando no WhatsApp",
          detalhe: wa?.msgs_7d != null ? `${wa.msgs_7d} mensagens nos últimos 7 dias` : undefined,
          icone: <MessageSquareOff className="h-4 w-4" />, peso: 80,
        });
      } else if (wa?.rag === "yellow") {
        assuntos.push({
          texto: "Conversa no grupo caindo",
          detalhe: wa?.msgs_7d != null ? `${wa.msgs_7d} mensagens nos últimos 7 dias` : undefined,
          icone: <MessageSquareOff className="h-4 w-4" />, peso: 40,
        });
      }

      // 4. Saúde — score baixo aponta a PIOR área como assunto
      const componentes = pior ? [
        { rotulo: "Metas do cliente", valor: Number(pior.goals_score) || 0 },
        { rotulo: "Comercial", valor: Number(pior.commercial_score) || 0 },
        { rotulo: "Engajamento", valor: Number(pior.engagement_score) || 0 },
        { rotulo: "Suporte", valor: Number(pior.support_score) || 0 },
        { rotulo: "Satisfação", valor: Number(pior.satisfaction_score) || 0 },
      ] : [];
      if (pior && ["critical", "at_risk"].includes(pior.risk_level)) {
        const piorArea = [...componentes].sort((a, b) => a.valor - b.valor)[0];
        assuntos.push({
          texto: `Saúde ${pior.risk_level === "critical" ? "crítica" : "em risco"}: ${pior.total_score}/100`,
          detalhe: piorArea ? `Pior área: ${piorArea.rotulo} (${piorArea.valor})` : undefined,
          icone: <HeartPulse className="h-4 w-4" />, peso: 70,
        });
      }

      // 5. NPS baixo
      const npsBaixo = projs.map((p) => p.current_nps).filter((n) => n !== null && n !== undefined && Number(n) <= 6);
      if (npsBaixo.length) {
        assuntos.push({
          texto: `NPS baixo: ${Math.min(...npsBaixo.map(Number))}`,
          icone: <PhoneOff className="h-4 w-4" />, peso: 60,
        });
      }

      // 6. Bloqueio registrado no projeto
      const bloqueio = projs.map((p) => p.current_blockers).find((b) => b && String(b).trim());
      if (bloqueio) {
        assuntos.push({
          texto: "Bloqueio em aberto",
          detalhe: String(bloqueio).slice(0, 140),
          icone: <AlertTriangle className="h-4 w-4" />, peso: 50,
        });
      }

      // 7. Contrato vencendo
      const fimProximo = projs
        .map((p) => p.contract_end_date).filter(Boolean)
        .map((d) => differenceInDays(new Date(d + "T12:00:00"), hoje))
        .filter((d) => d >= 0 && d <= 30);
      if (fimProximo.length) {
        assuntos.push({
          texto: `Contrato vence em ${Math.min(...fimProximo)} dias`,
          detalhe: "Puxar conversa de renovação antes do prazo",
          icone: <CalendarClock className="h-4 w-4" />, peso: 45,
        });
      }

      // 8. Tendência de queda
      if (pior?.trend_direction === "declining") {
        assuntos.push({
          texto: "Saúde em queda",
          detalhe: "Score caindo nas últimas medições",
          icone: <TrendingDown className="h-4 w-4" />, peso: 30,
        });
      }

      assuntos.sort((a, b) => b.peso - a.peso);

      const nivel: Nivel = assuntos.some((a) => a.peso >= 70)
        ? "vermelho"
        : assuntos.length || (pior && pior.risk_level === "attention")
          ? "amarelo"
          : "verde";

      return {
        id: emp.id,
        nome: emp.name,
        contrato: Number(emp.contract_value) || 0,
        nivel,
        score: pior ? Number(pior.total_score) : null,
        risco: pior?.risk_level || null,
        tendencia: pior?.trend_direction || null,
        assuntos,
        componentes,
      };
    });

    // Vermelhas primeiro; dentro do nível, contrato maior primeiro (impacto)
    const ordem: Record<Nivel, number> = { vermelho: 0, amarelo: 1, verde: 2 };
    lista.sort((a, b) => ordem[a.nivel] - ordem[b.nivel] || b.contrato - a.contrato);
    setEmpresas(lista);
    setAtualizadoEm(ultimaCalc);
    setLoading(false);
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return q ? empresas.filter((e) => e.nome.toLowerCase().includes(q)) : empresas;
  }, [empresas, busca]);

  const grupos = useMemo(() => ({
    vermelho: filtradas.filter((e) => e.nivel === "vermelho"),
    amarelo: filtradas.filter((e) => e.nivel === "amarelo"),
    verde: filtradas.filter((e) => e.nivel === "verde"),
  }), [filtradas]);

  const mrrEmRisco = grupos.vermelho.reduce((s, e) => s + e.contrato, 0);

  // Tamanho da bolha pelo valor do contrato (raiz pra não deixar o maior esmagar o resto)
  const escala = useMemo(() => {
    const vals = empresas.map((e) => e.contrato).filter((v) => v > 0);
    const max = Math.max(1, ...vals);
    return (v: number) => {
      const t = Math.sqrt(Math.max(0, v) / max);
      return Math.round(64 + t * 72); // 64px a 136px
    };
  }, [empresas]);

  const iniciais = (nome: string) =>
    nome.replace(/[^\p{L}\s]/gu, "").split(/\s+/).filter(Boolean).slice(0, 2)
      .map((p) => p[0]?.toUpperCase()).join("");

  const Bolha = ({ e }: { e: EmpresaRadar }) => {
    const d = escala(e.contrato);
    const ui = NIVEL_UI[e.nivel];
    const assuntoPrincipal = e.assuntos[0]?.texto;
    return (
      <button
        onClick={() => setSelecionada(e)}
        className="flex flex-col items-center gap-1.5 w-[150px] group"
        title={e.nome}
      >
        <div
          className={`rounded-full ${ui.bolha} shadow-lg flex items-center justify-center text-white font-bold transition-transform group-hover:scale-105 ring-4 ${ui.anel}`}
          style={{ width: d, height: d, fontSize: Math.max(14, d / 4.5) }}
        >
          {iniciais(e.nome)}
        </div>
        <span className="text-[11px] font-semibold text-center leading-tight line-clamp-2">{e.nome}</span>
        {e.nivel !== "verde" && assuntoPrincipal && (
          <span className={`text-[10px] text-center leading-tight line-clamp-2 ${ui.texto} font-medium`}>
            {assuntoPrincipal}
          </span>
        )}
      </button>
    );
  };

  if (loading) return <div className="flex justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="container max-w-7xl mx-auto py-6 space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="ghost" size="icon" onClick={() => navigate("/onboarding-tasks")}><ArrowLeft className="h-4 w-4" /></Button>
        <div className="flex-1 min-w-[220px]">
          <h1 className="text-2xl font-bold">Radar do Diretor</h1>
          <p className="text-sm text-muted-foreground">
            Toda a carteira num olhar — vermelho é onde você entra em campo.
            {atualizadoEm && ` Saúde recalculada ${format(atualizadoEm, "dd/MM 'às' HH:mm", { locale: ptBR })}.`}
          </p>
        </div>
        <div className="relative w-56">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9 h-9" placeholder="Buscar empresa..." value={busca} onChange={(ev) => setBusca(ev.target.value)} />
        </div>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={carregar}>
          <RefreshCw className="h-3.5 w-3.5" /> Atualizar
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-red-500/30"><CardContent className="py-3 px-4">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Críticas</p>
          <p className="text-2xl font-bold text-red-600">{grupos.vermelho.length}</p>
        </CardContent></Card>
        <Card className="border-amber-400/30"><CardContent className="py-3 px-4">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Em atenção</p>
          <p className="text-2xl font-bold text-amber-600">{grupos.amarelo.length}</p>
        </CardContent></Card>
        <Card className="border-emerald-500/30"><CardContent className="py-3 px-4">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Saudáveis</p>
          <p className="text-2xl font-bold text-emerald-600">{grupos.verde.length}</p>
        </CardContent></Card>
        <Card><CardContent className="py-3 px-4">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Contratos em risco</p>
          <p className="text-2xl font-bold">{brl(mrrEmRisco)}</p>
        </CardContent></Card>
      </div>

      {(["vermelho", "amarelo", "verde"] as Nivel[]).map((nivel) => {
        const lista = grupos[nivel];
        if (!lista.length) return null;
        return (
          <div key={nivel} className="space-y-3">
            <div className="flex items-center gap-2">
              <span className={`h-3 w-3 rounded-full ${NIVEL_UI[nivel].bolha.split(" ")[0]}`} />
              <h2 className="text-sm font-bold uppercase tracking-wide">{NIVEL_UI[nivel].rotulo}</h2>
              <Badge variant="outline" className="text-[10px]">{lista.length}</Badge>
            </div>
            <div className="flex flex-wrap gap-4 items-start">
              {lista.map((e) => <Bolha key={e.id} e={e} />)}
            </div>
          </div>
        );
      })}

      <Sheet open={!!selecionada} onOpenChange={(v) => !v && setSelecionada(null)}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          {selecionada && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <span className={`h-3 w-3 rounded-full shrink-0 ${NIVEL_UI[selecionada.nivel].bolha.split(" ")[0]}`} />
                  {selecionada.nome}
                </SheetTitle>
                <SheetDescription>
                  {selecionada.contrato > 0 && `Contrato: ${brl(selecionada.contrato)}/mês`}
                  {selecionada.score !== null && ` · Saúde: ${selecionada.score}/100`}
                </SheetDescription>
              </SheetHeader>
              <div className="mt-5 space-y-5">
                <div>
                  <h3 className="text-sm font-bold mb-2">O que tratar</h3>
                  {selecionada.assuntos.length ? (
                    <ul className="space-y-2.5">
                      {selecionada.assuntos.map((a, i) => (
                        <li key={i} className="flex gap-2.5 text-sm">
                          <span className={`mt-0.5 shrink-0 ${NIVEL_UI[selecionada.nivel].texto}`}>{a.icone}</span>
                          <div>
                            <p className="font-medium leading-snug">{a.texto}</p>
                            {a.detalhe && <p className="text-xs text-muted-foreground mt-0.5">{a.detalhe}</p>}
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">Nada urgente — cliente saudável. Bom momento pra pedir indicação ou puxar upsell.</p>
                  )}
                </div>
                {!!selecionada.componentes.length && (
                  <div>
                    <h3 className="text-sm font-bold mb-2">Saúde por área</h3>
                    <div className="space-y-1.5">
                      {selecionada.componentes.map((c) => (
                        <div key={c.rotulo} className="flex items-center gap-2">
                          <span className="text-xs w-28 shrink-0 text-muted-foreground">{c.rotulo}</span>
                          <div className="h-2 flex-1 rounded-full bg-muted overflow-hidden">
                            <div
                              className={`h-full rounded-full ${c.valor < 40 ? "bg-red-500" : c.valor < 70 ? "bg-amber-400" : "bg-emerald-500"}`}
                              style={{ width: `${Math.min(100, c.valor)}%` }}
                            />
                          </div>
                          <span className="text-xs tabular-nums w-7 text-right">{c.valor}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <Button className="w-full gap-2" onClick={() => navigate(`/onboarding-tasks/companies/${selecionada.id}`)}>
                  <ExternalLink className="h-4 w-4" /> Abrir empresa
                </Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
