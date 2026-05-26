import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Download, Send, Eye, RefreshCw, FileCheck, Clock, AlertCircle, FileX, CheckCircle2 } from "lucide-react";
import type { EnvelopeSummary, EnvelopeStatus } from "@/types/signatures";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Props {
  onViewDetail?: (envelopeId: string) => void;
  refreshTrigger?: number;
}

const STATUS_CONFIG: Record<EnvelopeStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ReactNode }> = {
  draft: { label: "Rascunho", variant: "secondary", icon: <FileX className="h-3 w-3" /> },
  sent: { label: "Enviado", variant: "default", icon: <Send className="h-3 w-3" /> },
  partially_signed: { label: "Parcial", variant: "outline", icon: <Clock className="h-3 w-3" /> },
  completed: { label: "Concluído", variant: "default", icon: <CheckCircle2 className="h-3 w-3" /> },
  expired: { label: "Expirado", variant: "destructive", icon: <AlertCircle className="h-3 w-3" /> },
  cancelled: { label: "Cancelado", variant: "destructive", icon: <FileX className="h-3 w-3" /> },
};

export function EnvelopesList({ onViewDetail, refreshTrigger }: Props) {
  const [envelopes, setEnvelopes] = useState<EnvelopeSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendingId, setSendingId] = useState<string | null>(null);

  const fetchEnvelopes = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("envelope_summary" as never)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setEnvelopes((data as unknown as EnvelopeSummary[]) ?? []);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao carregar envelopes");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchEnvelopes(); }, [refreshTrigger]);

  const handleResend = async (envelopeId: string) => {
    setSendingId(envelopeId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return toast.error("Sessão expirada");
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-envelope`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ envelope_id: envelopeId }),
        }
      );
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      toast.success(`${data.data.emails_sent} lembrete(s) enviado(s)`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro ao reenviar");
    } finally {
      setSendingId(null);
    }
  };

  const handleDownloadFinal = async (envelope: EnvelopeSummary) => {
    if (!envelope.final_file_path) return toast.error("PDF final ainda não disponível");
    try {
      const { data, error } = await supabase.storage.from("envelopes").createSignedUrl(envelope.final_file_path, 300);
      if (error || !data?.signedUrl) throw error;
      window.open(data.signedUrl, "_blank");
    } catch {
      toast.error("Erro ao gerar link de download");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (envelopes.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <FileCheck className="h-12 w-12 mx-auto mb-3 opacity-30" />
        <p className="text-sm">Nenhum envelope criado ainda</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted-foreground">{envelopes.length} envelope(s)</p>
        <Button size="sm" variant="ghost" onClick={fetchEnvelopes}>
          <RefreshCw className="h-4 w-4 mr-1" /> Atualizar
        </Button>
      </div>

      {envelopes.map(env => {
        const statusConfig = STATUS_CONFIG[env.status] ?? STATUS_CONFIG.draft;
        const progressPct = env.total_signers > 0 ? Math.round((env.signed_count / env.total_signers) * 100) : 0;

        return (
          <Card key={env.id} className="hover:border-primary/50 transition-colors">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-sm truncate">{env.title}</p>
                    <Badge variant={statusConfig.variant} className="flex items-center gap-1 text-xs">
                      {statusConfig.icon}
                      {statusConfig.label}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Criado em {format(new Date(env.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    {env.expires_at && <> · Expira em {format(new Date(env.expires_at), "dd/MM/yyyy", { locale: ptBR })}</>}
                  </p>

                  {env.total_signers > 0 && (
                    <div className="mt-2 space-y-1">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{env.signed_count}/{env.total_signers} assinados</span>
                        <span>{progressPct}%</span>
                      </div>
                      <Progress value={progressPct} className="h-1.5" />
                    </div>
                  )}

                  <p className="text-xs text-muted-foreground mt-1 font-mono truncate opacity-50">
                    ID: {env.id}
                  </p>
                </div>

                <div className="flex flex-col gap-1.5 flex-shrink-0">
                  {onViewDetail && (
                    <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => onViewDetail(env.id)}>
                      <Eye className="h-3 w-3 mr-1" /> Detalhe
                    </Button>
                  )}
                  {["sent", "partially_signed"].includes(env.status) && (
                    <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => handleResend(env.id)} disabled={sendingId === env.id}>
                      {sendingId === env.id
                        ? <RefreshCw className="h-3 w-3 animate-spin" />
                        : <><Send className="h-3 w-3 mr-1" />Lembrete</>
                      }
                    </Button>
                  )}
                  {env.status === "completed" && (
                    <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => handleDownloadFinal(env)}>
                      <Download className="h-3 w-3 mr-1" /> Download
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
