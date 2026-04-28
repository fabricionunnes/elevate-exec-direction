import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  FileText,
  AlertTriangle,
  ShieldCheck,
  XCircle,
  RefreshCw,
  Calendar,
  CheckCircle2,
  Clock,
  TrendingUp,
  DollarSign,
  History as HistoryIcon,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ProjectHistoryPanelProps {
  projectId: string;
}

interface ProjectData {
  id: string;
  product_name: string;
  status: string;
  created_at: string;
  reactivated_at: string | null;
  cancellation_signal_date: string | null;
  cancellation_signal_reason: string | null;
  cancellation_signal_notes: string | null;
  notice_end_date: string | null;
  churn_date: string | null;
  churn_reason: string | null;
  churn_notes: string | null;
  retention_status: string | null;
  retention_notes: string | null;
  company_id: string;
}

interface RetentionAttempt {
  id: string;
  attempt_date: string;
  strategy: string | null;
  notes: string | null;
  result: string | null;
  staff_id: string | null;
  staff?: { name: string } | null;
}

interface Renewal {
  id: string;
  renewal_date: string;
  previous_end_date: string | null;
  new_end_date: string | null;
  previous_value: number | null;
  new_value: number | null;
  previous_term_months: number | null;
  new_term_months: number | null;
  status: string | null;
  notes: string | null;
}

interface Contract {
  id: string;
  created_at: string;
  product_name: string | null;
  contract_value: number | null;
  payment_method: string | null;
  installments: number | null;
  start_date: string | null;
  due_date: string | null;
  pdf_url: string | null;
  zapsign_document_url: string | null;
  zapsign_sent_at: string | null;
}

const formatDate = (date?: string | null, withTime = false) => {
  if (!date) return "—";
  try {
    return format(new Date(date), withTime ? "dd/MM/yyyy 'às' HH:mm" : "dd/MM/yyyy", { locale: ptBR });
  } catch {
    return "—";
  }
};

const formatCurrency = (value?: number | null) => {
  if (value == null) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
};

export function ProjectHistoryPanel({ projectId }: ProjectHistoryPanelProps) {
  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<ProjectData | null>(null);
  const [retentions, setRetentions] = useState<RetentionAttempt[]>([]);
  const [renewals, setRenewals] = useState<Renewal[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);

  useEffect(() => {
    loadData();
  }, [projectId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: proj } = await supabase
        .from("onboarding_projects")
        .select("*")
        .eq("id", projectId)
        .maybeSingle();

      if (!proj) {
        setProject(null);
        setLoading(false);
        return;
      }

      setProject(proj as any);

      const [{ data: retData }, { data: renData }, { data: conData }] = await Promise.all([
        supabase
          .from("retention_attempts")
          .select("*, staff:onboarding_staff!retention_attempts_staff_id_fkey(name)")
          .eq("project_id", projectId)
          .order("attempt_date", { ascending: false }),
        supabase
          .from("onboarding_contract_renewals")
          .select("*")
          .eq("company_id", (proj as any).company_id)
          .order("renewal_date", { ascending: false }),
        supabase
          .from("generated_contracts")
          .select("id, created_at, product_name, contract_value, payment_method, installments, start_date, due_date, pdf_url, zapsign_document_url, zapsign_sent_at")
          .eq("company_id", (proj as any).company_id)
          .order("created_at", { ascending: false }),
      ]);

      setRetentions((retData || []) as any);
      setRenewals((renData || []) as any);
      setContracts((conData || []) as any);
    } catch (e) {
      console.error("Error loading project history:", e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!project) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <HistoryIcon className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p>Projeto não encontrado.</p>
        </CardContent>
      </Card>
    );
  }

  const statusLabel: Record<string, string> = {
    active: "Ativo",
    inactive: "Inativo",
    churned: "Cancelado",
    notice_period: "Em aviso prévio",
    paused: "Pausado",
  };

  const statusVariant = (s: string): "default" | "secondary" | "destructive" | "outline" => {
    if (s === "active") return "default";
    if (s === "churned") return "destructive";
    if (s === "notice_period") return "outline";
    return "secondary";
  };

  return (
    <div className="space-y-6">
      {/* Linha do tempo principal */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HistoryIcon className="h-5 w-5 text-primary" />
            Linha do Tempo do Projeto
          </CardTitle>
          <CardDescription>
            Histórico completo do ciclo de vida deste projeto do cliente.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <TimelineItem
              icon={<CheckCircle2 className="h-5 w-5 text-emerald-500" />}
              title="Contratação do serviço"
              date={formatDate(project.created_at, true)}
              description={`Produto contratado: ${project.product_name}`}
              badge={<Badge variant={statusVariant(project.status)}>{statusLabel[project.status] || project.status}</Badge>}
            />

            {project.reactivated_at && (
              <TimelineItem
                icon={<RefreshCw className="h-5 w-5 text-blue-500" />}
                title="Projeto reativado"
                date={formatDate(project.reactivated_at, true)}
                description="O cliente retornou ao serviço após um período inativo."
              />
            )}

            {project.cancellation_signal_date && (
              <TimelineItem
                icon={<AlertTriangle className="h-5 w-5 text-amber-500" />}
                title="Sinal de cancelamento detectado"
                date={formatDate(project.cancellation_signal_date, true)}
                description={
                  <div className="space-y-1">
                    {project.cancellation_signal_reason && (
                      <p><span className="font-medium">Motivo:</span> {project.cancellation_signal_reason}</p>
                    )}
                    {project.cancellation_signal_notes && (
                      <p className="text-muted-foreground">{project.cancellation_signal_notes}</p>
                    )}
                  </div>
                }
              />
            )}

            {project.notice_end_date && (
              <TimelineItem
                icon={<Clock className="h-5 w-5 text-orange-500" />}
                title="Aviso prévio em curso"
                date={`Encerra em ${formatDate(project.notice_end_date)}`}
                description="Período de notice antes do encerramento efetivo do contrato."
              />
            )}

            {project.retention_status && (
              <TimelineItem
                icon={<ShieldCheck className="h-5 w-5 text-emerald-500" />}
                title={`Retenção: ${project.retention_status}`}
                date={retentions[0]?.attempt_date ? formatDate(retentions[0].attempt_date) : ""}
                description={project.retention_notes || "Cliente retido após tentativa de cancelamento."}
              />
            )}

            {project.churn_date && (
              <TimelineItem
                icon={<XCircle className="h-5 w-5 text-destructive" />}
                title="Cancelamento confirmado (Churn)"
                date={formatDate(project.churn_date, true)}
                description={
                  <div className="space-y-1">
                    {project.churn_reason && (
                      <p><span className="font-medium">Motivo:</span> {project.churn_reason}</p>
                    )}
                    {project.churn_notes && (
                      <p className="text-muted-foreground">{project.churn_notes}</p>
                    )}
                  </div>
                }
              />
            )}
          </div>
        </CardContent>
      </Card>

      {/* Contratos gerados */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Contratos ({contracts.length})
          </CardTitle>
          <CardDescription>Contratos gerados para este cliente.</CardDescription>
        </CardHeader>
        <CardContent>
          {contracts.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Nenhum contrato gerado.</p>
          ) : (
            <div className="space-y-3">
              {contracts.map((c) => (
                <div key={c.id} className="border rounded-lg p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">{c.product_name || "Contrato"}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        Emitido em {formatDate(c.created_at, true)}
                      </p>
                    </div>
                    <Badge variant={c.zapsign_sent_at ? "default" : "secondary"}>
                      {c.zapsign_sent_at ? "Enviado p/ assinatura" : "Rascunho"}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground">Valor</p>
                      <p className="font-medium">{formatCurrency(c.contract_value)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Pagamento</p>
                      <p className="font-medium">{c.payment_method || "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Parcelas</p>
                      <p className="font-medium">{c.installments || "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Início</p>
                      <p className="font-medium">{formatDate(c.start_date)}</p>
                    </div>
                  </div>
                  {(c.pdf_url || c.zapsign_document_url) && (
                    <div className="flex gap-2 pt-1">
                      {c.pdf_url && (
                        <a href={c.pdf_url} target="_blank" rel="noopener noreferrer"
                           className="text-xs text-primary hover:underline">PDF</a>
                      )}
                      {c.zapsign_document_url && (
                        <a href={c.zapsign_document_url} target="_blank" rel="noopener noreferrer"
                           className="text-xs text-primary hover:underline">ZapSign</a>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Renovações */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-primary" />
            Renovações ({renewals.length})
          </CardTitle>
          <CardDescription>Histórico de renovações contratuais.</CardDescription>
        </CardHeader>
        <CardContent>
          {renewals.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Nenhuma renovação registrada.</p>
          ) : (
            <div className="space-y-3">
              {renewals.map((r) => (
                <div key={r.id} className="border rounded-lg p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{formatDate(r.renewal_date)}</span>
                    </div>
                    {r.status && <Badge variant="secondary">{r.status}</Badge>}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <DollarSign className="h-3 w-3" /> Valor
                      </p>
                      <p>
                        {formatCurrency(r.previous_value)} → <span className="font-medium">{formatCurrency(r.new_value)}</span>
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Prazo (meses)</p>
                      <p>{r.previous_term_months || "—"} → <span className="font-medium">{r.new_term_months || "—"}</span></p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Vigência até</p>
                      <p>{formatDate(r.previous_end_date)} → <span className="font-medium">{formatDate(r.new_end_date)}</span></p>
                    </div>
                  </div>
                  {r.notes && <p className="text-sm text-muted-foreground italic">{r.notes}</p>}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tentativas de retenção */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Tentativas de Retenção ({retentions.length})
          </CardTitle>
          <CardDescription>Ações realizadas para reter o cliente.</CardDescription>
        </CardHeader>
        <CardContent>
          {retentions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Nenhuma tentativa de retenção registrada.</p>
          ) : (
            <div className="space-y-3">
              {retentions.map((r) => {
                const success = (r.result || "").toLowerCase().includes("retid") || (r.result || "").toLowerCase().includes("sucess");
                return (
                  <div key={r.id} className="border rounded-lg p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{formatDate(r.attempt_date)}</span>
                        {r.staff?.name && (
                          <span className="text-xs text-muted-foreground">por {r.staff.name}</span>
                        )}
                      </div>
                      {r.result && (
                        <Badge variant={success ? "default" : "secondary"}>
                          {r.result}
                        </Badge>
                      )}
                    </div>
                    {r.strategy && (
                      <div className="text-sm">
                        <span className="text-xs text-muted-foreground">Estratégia: </span>
                        <span>{r.strategy}</span>
                      </div>
                    )}
                    {r.notes && (
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">{r.notes}</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function TimelineItem({
  icon,
  title,
  date,
  description,
  badge,
}: {
  icon: React.ReactNode;
  title: string;
  date: string;
  description?: React.ReactNode;
  badge?: React.ReactNode;
}) {
  return (
    <div className="flex gap-3 pb-4 border-b last:border-b-0 last:pb-0">
      <div className="mt-0.5 shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <p className="font-medium">{title}</p>
          {badge}
        </div>
        {date && <p className="text-xs text-muted-foreground mt-0.5">{date}</p>}
        {description && (
          <div className="text-sm text-muted-foreground mt-1.5">{description}</div>
        )}
      </div>
    </div>
  );
}

export default ProjectHistoryPanel;
