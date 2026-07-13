import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Building2, Crown, ExternalLink, Heart, Instagram, Loader2, Star, TrendingUp } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface Props {
  leadId: string;
}

/** Portfólio UNV — o que a empresa NÃO tem vira oportunidade de oferta. */
const PORTFOLIO = [
  "Diretor Comercial Terceirizado",
  "Sales Force",
  "Sales Acceleration",
  "UNV Ads",
  "UNV Social",
  "UNV InCompany",
  "UNV People",
  "UNV Finance",
  "UNV Safe",
  "UNV Leadership",
  "UNV Board",
  "UNV Mastermind",
  "UNV Partners",
  "UNV Nexus",
];

const TERMO_META: Record<string, { label: string; cls: string }> = {
  seguro: { label: "Seguro", cls: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30" },
  atencao: { label: "Atenção", cls: "bg-amber-500/10 text-amber-600 border-amber-500/30" },
  risco_alto: { label: "Risco Alto", cls: "bg-red-500/10 text-red-600 border-red-500/30" },
};

const fmtBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

export const NexusClientIntelPanel = ({ leadId }: Props) => {
  const [intel, setIntel] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data } = await (supabase.rpc as any)("get_lead_company_intel", { p_lead: leadId });
        setIntel(data || null);
      } finally {
        setLoading(false);
      }
    })();
  }, [leadId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Cruzando com a base do Nexus...
      </div>
    );
  }

  if (!intel) {
    return (
      <div className="py-16 text-center text-sm text-muted-foreground px-6">
        <Building2 className="h-10 w-10 mx-auto mb-3 opacity-40" />
        <p>Este lead não foi identificado como cliente UNV.</p>
        <p className="mt-1 text-xs">
          O cruzamento é feito pelo telefone ou nome da empresa cadastrada no Nexus.
        </p>
      </div>
    );
  }

  const projetos: any[] = intel.projetos || [];
  const ativos = projetos.filter((p) => ["active", "ativo"].includes(String(p.status)));
  const contratados = projetos.map((p) => String(p.produto || ""));
  const oportunidades = PORTFOLIO.filter(
    (svc) => !contratados.some((c) => c.toLowerCase().includes(svc.toLowerCase()) || svc.toLowerCase().includes(c.toLowerCase())),
  );
  const termo = TERMO_META[intel.cerebro?.termometro] || null;
  const mrr = ativos.reduce((s, p) => s + (Number(p.contrato) || 0), 0);
  const projetoPrincipal = ativos[0] || projetos[0];

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <Crown className="h-5 w-5 text-amber-500" />
        <h3 className="font-bold">{intel.company?.name}</h3>
        {intel.company?.segment && (
          <Badge variant="outline" className="text-[10px]">{intel.company.segment}</Badge>
        )}
        {termo && <Badge variant="outline" className={cn("text-[10px]", termo.cls)}>{termo.label}</Badge>}
        {intel.company?.instagram && (() => {
          const raw = String(intel.company.instagram).trim();
          const url = raw.startsWith("http") ? raw : `https://instagram.com/${raw.replace(/^@/, "")}`;
          const handle = raw.replace(/^https?:\/\/(www\.)?instagram\.com\//i, "").replace(/\/$/, "").replace(/^@?/, "@");
          return (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1.5 border-pink-500/40 text-pink-600 hover:bg-pink-500/5"
              onClick={() => window.open(url, "_blank", "noopener")}
            >
              <Instagram className="h-3.5 w-3.5" /> {handle}
            </Button>
          );
        })()}
        {projetoPrincipal?.id && (
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1 ml-auto"
            onClick={() => window.open(`#/onboarding-tasks/${projetoPrincipal.id}`, "_blank")}
          >
            <ExternalLink className="h-3 w-3" /> Abrir projeto no Nexus
          </Button>
        )}
      </div>

      {/* Métricas-chave */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Contrato atual</p>
            <p className="text-lg font-black">{mrr > 0 ? fmtBRL(mrr) : "—"}</p>
            <p className="text-[11px] text-muted-foreground truncate">
              {ativos.map((p) => p.produto).join(" + ") || "sem projeto ativo"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
              <Heart className="h-3 w-3" /> Saúde
            </p>
            <p className={cn("text-lg font-black",
              (intel.saude?.score ?? 0) >= 70 ? "text-emerald-600" :
              (intel.saude?.score ?? 0) >= 50 ? "text-amber-600" : "text-red-600")}>
              {intel.saude?.score ?? "—"}
            </p>
            <p className="text-[11px] text-muted-foreground capitalize">
              {intel.saude?.risco || ""} {intel.saude?.tendencia ? `· ${intel.saude.tendencia}` : ""}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
              <Star className="h-3 w-3" /> NPS
            </p>
            <p className="text-lg font-black">{intel.nps?.nota ?? "—"}</p>
            <p className="text-[11px] text-muted-foreground">
              {intel.nps?.quando ? format(new Date(intel.nps.quando), "dd/MM/yy", { locale: ptBR }) : "sem resposta"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Boletim (média)</p>
            <p className="text-lg font-black">{intel.boletim_media ?? "—"}</p>
            <p className="text-[11px] text-muted-foreground">notas da Grade Curricular</p>
          </CardContent>
        </Card>
      </div>

      {/* Momento do cliente (Cérebro) */}
      {intel.cerebro?.momento && (
        <Card>
          <CardContent className="pt-4 pb-3 space-y-2">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Momento do cliente (Cérebro)
            </p>
            <p className="text-sm leading-snug">{intel.cerebro.momento}</p>
            {Array.isArray(intel.cerebro?.vitorias) && intel.cerebro.vitorias.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {intel.cerebro.vitorias.slice(0, 3).map((v: any, i: number) => (
                  <Badge key={i} variant="outline" className="text-[10px] bg-emerald-500/5 border-emerald-500/30 text-emerald-700">
                    {String(v).slice(0, 60)}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Serviços: contratados vs oportunidades */}
      <div className="grid sm:grid-cols-2 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-2">Já contratou</p>
            <div className="flex flex-wrap gap-1.5">
              {projetos.length === 0 && <span className="text-xs text-muted-foreground">nada registrado</span>}
              {projetos.map((p, i) => (
                <Badge key={i} variant="secondary" className="text-[11px]">
                  {p.produto}
                  {["active", "ativo"].includes(String(p.status)) ? "" : " (encerrado)"}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card className="border-primary/30">
          <CardContent className="pt-4 pb-3">
            <p className="text-[10px] uppercase tracking-wide text-primary mb-2 flex items-center gap-1">
              <TrendingUp className="h-3 w-3" /> Oportunidades de oferta
            </p>
            <div className="flex flex-wrap gap-1.5">
              {oportunidades.map((svc) => (
                <Badge key={svc} variant="outline" className="text-[11px] border-primary/40 text-primary">
                  {svc}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {intel.nps?.feedback && (
        <p className="text-xs text-muted-foreground border-l-2 border-border pl-3">
          Último feedback NPS: "{intel.nps.feedback}"
        </p>
      )}
    </div>
  );
};
