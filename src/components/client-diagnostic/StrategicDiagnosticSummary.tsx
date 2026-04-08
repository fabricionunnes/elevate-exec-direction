import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Pencil } from "lucide-react";
import type { DiagnosticRecord } from "./StrategicDiagnosticModule";

interface Props {
  record: DiagnosticRecord;
  onEdit?: () => void;
}

const fmt = (val: number | null | undefined) => val != null ? `R$ ${Number(val).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "—";
const fmtPct = (val: number | null | undefined) => val != null ? `${val}%` : "—";
const fmtNum = (val: number | null | undefined) => val != null ? String(val) : "—";
const fmtText = (val: string | null | undefined) => val || "—";

const SectionBadge = ({ label, color }: { label: string; color: "amber" | "blue" | "red" | "green" }) => {
  const colors = {
    amber: "bg-amber-100 text-amber-800 border-amber-200",
    blue: "bg-blue-100 text-blue-800 border-blue-200",
    red: "bg-red-100 text-red-800 border-red-200",
    green: "bg-green-100 text-green-800 border-green-200",
  };
  return <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full border ${colors[color]}`}>{label}</span>;
};

const Field = ({ label, value }: { label: string; value: string }) => (
  <div>
    <dt className="text-xs text-muted-foreground">{label}</dt>
    <dd className="text-sm font-medium">{value}</dd>
  </div>
);

const urgencyColors: Record<string, string> = {
  "Alta": "bg-red-100 text-red-800 border-red-200",
  "Média": "bg-amber-100 text-amber-800 border-amber-200",
  "Baixa": "bg-green-100 text-green-800 border-green-200",
};

export function StrategicDiagnosticSummary({ record, onEdit }: Props) {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {onEdit && (
        <div className="flex justify-end">
          <Button variant="outline" size="sm" className="gap-2" onClick={onEdit}>
            <Pencil className="h-4 w-4" /> Editar diagnóstico
          </Button>
        </div>
      )}
      <div className="bg-white dark:bg-background border border-border/50 rounded-xl p-6">
        <h2 className="text-xl font-bold mb-1">Check-point Estratégico — {record.empresa}</h2>
        <p className="text-sm text-muted-foreground">
          {format(parseISO(record.data_checkpoint), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
          {record.consultor_unv && ` · Consultor: ${record.consultor_unv}`}
        </p>
      </div>

      {/* Resumo de dores e produtos */}
      {(record.principais_dores || (record.produtos_oferecer && record.produtos_oferecer.length > 0)) && (
        <Card className="p-5 border-blue-200 bg-blue-50/50 dark:bg-blue-950/20">
          <h3 className="font-semibold text-sm mb-3 text-blue-800 dark:text-blue-300">📋 Resumo do Diagnóstico</h3>
          {record.principais_dores && (
            <div className="mb-3">
              <p className="text-xs text-muted-foreground mb-1">Dores identificadas:</p>
              <p className="text-sm whitespace-pre-wrap">{record.principais_dores}</p>
            </div>
          )}
          {record.produtos_oferecer && record.produtos_oferecer.length > 0 && (
            <div className="mb-3">
              <p className="text-xs text-muted-foreground mb-1">Produtos sugeridos:</p>
              <div className="flex flex-wrap gap-1.5">
                {record.produtos_oferecer.map(p => (
                  <span key={p} className="text-xs bg-blue-100 text-blue-800 border border-blue-200 px-2.5 py-1 rounded-full font-medium">{p}</span>
                ))}
              </div>
            </div>
          )}
          <div className="flex items-center gap-4 mt-3">
            {record.nivel_urgencia && (
              <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${urgencyColors[record.nivel_urgencia] || ""}`}>
                Urgência: {record.nivel_urgencia}
              </span>
            )}
            {record.proximo_passo && (
              <span className="text-xs text-muted-foreground">Próximo passo: <strong>{record.proximo_passo}</strong></span>
            )}
          </div>
        </Card>
      )}

      {/* Identification */}
      <Card className="p-5">
        <h3 className="font-semibold text-sm mb-3">Identificação</h3>
        <dl className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <Field label="Empresa" value={fmtText(record.empresa)} />
          <Field label="Responsável" value={fmtText(record.responsavel)} />
          <Field label="Consultor" value={fmtText(record.consultor_unv)} />
          <Field label="Tempo como cliente" value={fmtText(record.tempo_cliente)} />
          <Field label="Segmento" value={fmtText(record.segmento)} />
        </dl>
      </Card>

      {/* Financial */}
      <Card className="p-5">
        <div className="flex items-center gap-2 mb-3">
          <h3 className="font-semibold text-sm">Financeiro</h3>
          <SectionBadge label="gestão & saúde" color="amber" />
        </div>
        <dl className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <Field label="Faturamento atual" value={fmt(record.faturamento_atual)} />
          <Field label="Faturamento na entrada" value={fmt(record.faturamento_entrada)} />
          <Field label="Margem de lucro" value={fmtPct(record.margem_lucro)} />
          <Field label="Ticket médio" value={fmt(record.ticket_medio)} />
          <Field label="Dívidas" value={fmtText(record.possui_dividas)} />
          <Field label="Controle financeiro" value={fmtText(record.controle_financeiro)} />
          <Field label="Gestão financeira" value={fmtText(record.gestao_financeira)} />
          <Field label="Contador/BPO" value={fmtText(record.usa_contador)} />
          <Field label="Maior dor" value={fmtText(record.maior_dor_financeira)} />
        </dl>
        {record.observacoes_financeiras && <p className="text-sm mt-3 text-muted-foreground whitespace-pre-wrap">{record.observacoes_financeiras}</p>}
      </Card>

      {/* Commercial */}
      <Card className="p-5">
        <div className="flex items-center gap-2 mb-3">
          <h3 className="font-semibold text-sm">Comercial</h3>
          <SectionBadge label="vendas & processo" color="blue" />
        </div>
        <dl className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <Field label="Vendedores" value={fmtNum(record.num_vendedores)} />
          <Field label="Meta mensal" value={fmt(record.meta_vendas)} />
          <Field label="Resultado último mês" value={fmt(record.resultado_ultimo_mes)} />
          <Field label="Taxa conversão" value={fmtPct(record.taxa_conversao)} />
          <Field label="SDR" value={fmtText(record.possui_sdr)} />
          <Field label="CRM" value={fmtText(record.usa_crm)} />
          <Field label="Script" value={fmtText(record.tem_script)} />
          <Field label="Canal principal" value={fmtText(record.principal_canal)} />
          <Field label="Maior dor" value={fmtText(record.maior_dor_comercial)} />
        </dl>
        {record.observacoes_comerciais && <p className="text-sm mt-3 text-muted-foreground whitespace-pre-wrap">{record.observacoes_comerciais}</p>}
      </Card>

      {/* Traffic */}
      <Card className="p-5">
        <div className="flex items-center gap-2 mb-3">
          <h3 className="font-semibold text-sm">Tráfego Pago</h3>
          <SectionBadge label="mídia & performance" color="red" />
        </div>
        <dl className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <Field label="Investe?" value={fmtText(record.investe_trafego)} />
          <Field label="Gerenciado por" value={fmtText(record.quem_gerencia_trafego)} />
          <Field label="Investimento mensal" value={fmt(record.investimento_trafego)} />
          <Field label="CPL estimado" value={fmt(record.cpl_estimado)} />
          <Field label="Volume leads/mês" value={fmtNum(record.volume_leads)} />
          <Field label="Satisfeito?" value={fmtText(record.satisfeito_trafego)} />
          <Field label="Acompanha relatórios?" value={fmtText(record.acompanha_relatorios)} />
        </dl>
        {record.plataformas_trafego && record.plataformas_trafego.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1">
            {record.plataformas_trafego.map((p: string) => <span key={p} className="text-xs bg-red-50 text-red-700 border border-red-200 px-2 py-0.5 rounded-full">{p}</span>)}
          </div>
        )}
        {record.observacoes_trafego && <p className="text-sm mt-3 text-muted-foreground whitespace-pre-wrap">{record.observacoes_trafego}</p>}
      </Card>

      {/* Marketing */}
      <Card className="p-5">
        <div className="flex items-center gap-2 mb-3">
          <h3 className="font-semibold text-sm">Marketing & Social Media</h3>
          <SectionBadge label="presença & conteúdo" color="green" />
        </div>
        <dl className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <Field label="Social media" value={fmtText(record.quem_faz_social)} />
          <Field label="Investimento social" value={fmt(record.investimento_social)} />
          <Field label="Seguidores Instagram" value={fmtNum(record.seguidores_instagram)} />
          <Field label="Engajamento" value={fmtPct(record.engajamento_medio)} />
          <Field label="Frequência" value={fmtText(record.frequencia_postagens)} />
          <Field label="Identidade visual" value={fmtText(record.identidade_visual)} />
          <Field label="Vídeo" value={fmtText(record.produz_video)} />
          <Field label="Satisfeito?" value={fmtText(record.satisfeito_social)} />
          <Field label="Gera leads?" value={fmtText(record.social_gera_leads)} />
        </dl>
        {record.redes_ativas && record.redes_ativas.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1">
            {record.redes_ativas.map((r: string) => <span key={r} className="text-xs bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded-full">{r}</span>)}
          </div>
        )}
        {record.observacoes_marketing && <p className="text-sm mt-3 text-muted-foreground whitespace-pre-wrap">{record.observacoes_marketing}</p>}
      </Card>

      {/* Final */}
      <Card className="p-5">
        <div className="flex items-center gap-2 mb-3">
          <h3 className="font-semibold text-sm">Diagnóstico Final</h3>
          <SectionBadge label="resumo & encaminhamento" color="blue" />
        </div>
        <dl className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <Field label="Próximo passo" value={fmtText(record.proximo_passo)} />
          <Field label="Urgência" value={fmtText(record.nivel_urgencia)} />
          <Field label="Potencial upsell" value={fmt(record.potencial_upsell)} />
        </dl>
        {record.observacoes_gerais && <p className="text-sm mt-3 text-muted-foreground whitespace-pre-wrap">{record.observacoes_gerais}</p>}
      </Card>
    </div>
  );
}
