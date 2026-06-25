import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Phone, Building2, Target, DollarSign, Users, AlertTriangle,
  CheckCircle2, HelpCircle, History, Sparkles, Loader2, RefreshCw, ArrowRight,
  MessageSquareQuote,
} from "lucide-react";

// Script de abertura padrão UNV — apresenta o valor e abre a conversa de leve.
// Personaliza só com o primeiro nome do lead.
function aberturaScript(firstName?: string | null) {
  const oi = firstName ? `Oi ${firstName}! ` : "";
  return `${oi}Nós trabalhamos ajudando empresas a estruturar e escalar o comercial — a gente atua como o diretor comercial da sua empresa pra fazer seus vendedores baterem meta todos os meses. Vi que você demonstrou interesse em entender como isso funcionaria pra sua operação. Me conta rapidinho: hoje você tem alguém dedicado a vendas ou tá tudo na sua mão?`;
}

interface Brief {
  resumo?: string;
  nicho?: string | null;
  faturamento?: string | null;
  porte?: string | null;
  principal_dor?: string | null;
  urgencia?: string;
  ja_falou_antes?: { sim?: boolean; quando?: string | null; resumo?: string | null };
  pontos_chave?: string[];
  perguntas_qualificacao?: string[];
  alertas?: string[];
  proximo_passo_sugerido?: string;
}

interface LeadInfo {
  id: string;
  name: string;
  company: string | null;
  phone: string | null;
  ai_brief: Brief | null;
}

const urgencyStyle: Record<string, string> = {
  alta: "bg-red-500/15 text-red-500 border-red-500/30",
  media: "bg-amber-500/15 text-amber-500 border-amber-500/30",
  baixa: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30",
};

export function LeadBriefingPanel({ leadId }: { leadId: string | null }) {
  const [lead, setLead] = useState<LeadInfo | null>(null);
  const [brief, setBrief] = useState<Brief | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);

  const generate = async (force: boolean) => {
    if (!leadId) return;
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("dialer-brief", {
        body: { leadId, force },
      });
      if (!error && data?.brief) setBrief(data.brief);
    } finally {
      setGenerating(false);
    }
  };

  useEffect(() => {
    if (!leadId) {
      setLead(null);
      setBrief(null);
      return;
    }
    let active = true;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("crm_leads")
        .select("id, name, company, phone, ai_brief")
        .eq("id", leadId)
        .maybeSingle();
      if (!active) return;
      setLead(data as any);
      setBrief((data as any)?.ai_brief || null);
      setLoading(false);
      if (!(data as any)?.ai_brief) {
        // gera na hora se ainda não houver
        void generateInternal();
      }
    })();
    async function generateInternal() {
      setGenerating(true);
      const { data } = await supabase.functions.invoke("dialer-brief", { body: { leadId } });
      if (active && data?.brief) setBrief(data.brief);
      setGenerating(false);
    }
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadId]);

  if (!leadId) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-8 text-center">
        <Phone className="h-10 w-10 mb-3 opacity-40" />
        <p className="text-sm">Quando o cliente atender, o resumo dele aparece aqui.</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto">
      {/* Cabeçalho do contato */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary shrink-0" />
              <h2 className="text-lg font-bold truncate">{lead?.company || lead?.name || "Lead"}</h2>
            </div>
            {lead?.company && <p className="text-sm text-muted-foreground truncate">{lead.name}</p>}
            {lead?.phone && (
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                <Phone className="h-3 w-3" /> {lead.phone}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {brief?.urgencia && (
              <Badge variant="outline" className={urgencyStyle[brief.urgencia] || ""}>
                Urgência: {brief.urgencia}
              </Badge>
            )}
            <Button variant="ghost" size="icon" className="h-8 w-8" disabled={generating} onClick={() => generate(true)} title="Regenerar briefing">
              <RefreshCw className={`h-4 w-4 ${generating ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>
      </div>

      {(loading || (generating && !brief)) && (
        <div className="flex items-center gap-2 text-muted-foreground p-6 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" /> Montando o resumo do cliente…
        </div>
      )}

      {brief && (
        <div className="p-4 space-y-4">
          {/* Resumo */}
          {brief.resumo && (
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-primary uppercase tracking-wide mb-1">
                <Sparkles className="h-3.5 w-3.5" /> Resumo
              </div>
              <p className="text-sm leading-relaxed">{brief.resumo}</p>
            </div>
          )}

          {/* Grid de dados-chave */}
          <div className="grid grid-cols-2 gap-2">
            <Fact icon={Target} label="Nicho" value={brief.nicho} />
            <Fact icon={DollarSign} label="Faturamento" value={brief.faturamento} />
            <Fact icon={Users} label="Porte" value={brief.porte} />
            <Fact icon={AlertTriangle} label="Principal dor" value={brief.principal_dor} />
          </div>

          {/* Já falou antes */}
          {brief.ja_falou_antes && (
            <div className={`rounded-lg border p-3 ${brief.ja_falou_antes.sim ? "border-amber-500/30 bg-amber-500/5" : "border-border"}`}>
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide mb-1">
                <History className="h-3.5 w-3.5" />
                {brief.ja_falou_antes.sim ? "Já conversou com a gente" : "Primeiro contato"}
              </div>
              {brief.ja_falou_antes.sim && (
                <>
                  {brief.ja_falou_antes.quando && (
                    <p className="text-xs text-muted-foreground">Último contato: {brief.ja_falou_antes.quando}</p>
                  )}
                  {brief.ja_falou_antes.resumo && <p className="text-sm mt-1">{brief.ja_falou_antes.resumo}</p>}
                </>
              )}
            </div>
          )}

          {/* Pontos-chave */}
          {brief.pontos_chave && brief.pontos_chave.length > 0 && (
            <Section icon={CheckCircle2} title="Pontos-chave" color="text-emerald-500">
              <ul className="space-y-1.5">
                {brief.pontos_chave.map((p, i) => (
                  <li key={i} className="text-sm flex gap-2">
                    <span className="text-emerald-500 mt-0.5">•</span><span>{p}</span>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {/* Abordagem de abertura — script padrão UNV pra começar a ligação */}
          <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-3">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide mb-1.5 text-blue-500">
              <MessageSquareQuote className="h-3.5 w-3.5" /> Abordagem de abertura
              <span className="ml-auto text-[10px] font-normal text-muted-foreground normal-case">leia no começo da ligação</span>
            </div>
            <p className="text-sm leading-relaxed italic">
              "{aberturaScript((lead?.name || "").trim().split(/\s+/)[0] || null)}"
            </p>
          </div>

          {/* Perguntas de qualificação */}
          {brief.perguntas_qualificacao && brief.perguntas_qualificacao.length > 0 && (
            <Section icon={HelpCircle} title="Perguntas pra fazer agora" color="text-blue-500">
              <ul className="space-y-1.5">
                {brief.perguntas_qualificacao.map((q, i) => (
                  <li key={i} className="text-sm flex gap-2">
                    <span className="text-blue-500 mt-0.5">{i + 1}.</span><span>{q}</span>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {/* Alertas */}
          {brief.alertas && brief.alertas.length > 0 && (
            <Section icon={AlertTriangle} title="Atenção" color="text-red-500">
              <ul className="space-y-1.5">
                {brief.alertas.map((a, i) => (
                  <li key={i} className="text-sm flex gap-2">
                    <span className="text-red-500 mt-0.5">!</span><span>{a}</span>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {/* Próximo passo */}
          {brief.proximo_passo_sugerido && (
            <div className="rounded-lg border border-border bg-muted/40 p-3">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide mb-1 text-muted-foreground">
                <ArrowRight className="h-3.5 w-3.5" /> Objetivo desta ligação
              </div>
              <p className="text-sm">{brief.proximo_passo_sugerido}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Fact({ icon: Icon, label, value }: { icon: any; label: string; value?: string | null }) {
  return (
    <div className="rounded-lg border border-border p-2.5">
      <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
        <Icon className="h-3 w-3" /> {label}
      </div>
      <p className="text-sm mt-0.5 font-medium">{value || <span className="text-muted-foreground font-normal">—</span>}</p>
    </div>
  );
}

function Section({ icon: Icon, title, color, children }: { icon: any; title: string; color: string; children: React.ReactNode }) {
  return (
    <div>
      <div className={`flex items-center gap-2 text-xs font-semibold uppercase tracking-wide mb-2 ${color}`}>
        <Icon className="h-3.5 w-3.5" /> {title}
      </div>
      {children}
    </div>
  );
}
