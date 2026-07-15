import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Copy, ArrowLeft, Download, CheckCircle2, Clock, Eye, XCircle, AlertCircle, Link2, Loader2, Pencil } from "lucide-react";
import { EnvelopeEditDialog } from "./EnvelopeEditDialog";
import type { Envelope, Signer, AuditEvent, SignerStatus, AuditEventType } from "@/types/signatures";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Props {
  envelopeId: string;
  onBack?: () => void;
}

const SIGNER_STATUS_ICONS: Record<SignerStatus, React.ReactNode> = {
  pending: <Clock className="h-4 w-4 text-yellow-500" />,
  viewed: <Eye className="h-4 w-4 text-blue-500" />,
  signed: <CheckCircle2 className="h-4 w-4 text-green-500" />,
  declined: <XCircle className="h-4 w-4 text-red-500" />,
};

const SIGNER_STATUS_LABELS: Record<SignerStatus, string> = {
  pending: "Pendente",
  viewed: "Visualizou",
  signed: "Assinou",
  declined: "Recusou",
};

const AUDIT_LABELS: Record<AuditEventType, string> = {
  created: "Criado",
  sent: "E-mail enviado",
  email_delivered: "E-mail entregue",
  viewed: "Visualizou",
  signature_started: "Iniciou assinatura",
  signed: "Assinou",
  completed: "Concluído",
  declined: "Recusou",
  expired: "Expirado",
  cancelled: "Cancelado",
  document_modified: "Documento editado",
};

export function EnvelopeDetail({ envelopeId, onBack }: Props) {
  const [envelope, setEnvelope] = useState<Envelope | null>(null);
  const [signers, setSigners] = useState<Signer[]>([]);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [copyingLink, setCopyingLink] = useState<string | null>(null);

  const [editOpen, setEditOpen] = useState(false);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [{ data: env }, { data: sgs }, { data: audit }] = await Promise.all([
        supabase.from("envelopes").select("*").eq("id", envelopeId).maybeSingle(),
        supabase.from("signers").select("*").eq("envelope_id", envelopeId).order("order_index"),
        supabase.from("audit_events").select("*").eq("envelope_id", envelopeId).order("created_at"),
      ]);
      setEnvelope(env as Envelope);
      setSigners((sgs as Signer[]) ?? []);
      setAuditEvents((audit as AuditEvent[]) ?? []);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao carregar detalhes");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, [envelopeId]);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => toast.success(`${label} copiado`));
  };

  const handleCopySigningLink = async (signerId: string) => {
    setCopyingLink(signerId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return toast.error("Sessão expirada");

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-signing-link`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ signer_id: signerId }),
        }
      );
      const data = await res.json();
      if (!data.success) throw new Error(data.error ?? "Erro ao gerar link");

      await navigator.clipboard.writeText(data.data.signing_url);
      toast.success(`Link de assinatura copiado para ${data.data.signer_name}`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro ao gerar link");
    } finally {
      setCopyingLink(null);
    }
  };

  const handleDownloadFinal = async () => {
    if (!envelope?.final_file_path) return toast.error("PDF final ainda não disponível");
    const { data, error } = await supabase.storage.from("envelopes").createSignedUrl(envelope.final_file_path, 300);
    if (error || !data?.signedUrl) return toast.error("Erro ao gerar link");
    window.open(data.signedUrl, "_blank");
  };

  if (loading) {
    return <div className="flex items-center justify-center py-12"><div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" /></div>;
  }

  if (!envelope) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground">Envelope não encontrado</p>
        {onBack && <Button variant="ghost" className="mt-3" onClick={onBack}><ArrowLeft className="h-4 w-4 mr-1" />Voltar</Button>}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {onBack && (
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
        </Button>
      )}

      {/* Header */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-base">{envelope.title}</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Criado em {format(new Date(envelope.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {!["completed", "cancelled"].includes(envelope.status) && !signers.some((s) => s.status === "signed") && (
                <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>
                  <Pencil className="h-4 w-4 mr-1" /> Editar
                </Button>
              )}
              {envelope.status === "completed" && (
                <Button size="sm" onClick={handleDownloadFinal}>
                  <Download className="h-4 w-4 mr-1" /> PDF Final
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground w-20">ID:</span>
              <code className="text-xs bg-muted px-2 py-0.5 rounded flex-1 truncate">{envelope.id}</code>
              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => copyToClipboard(envelope.id, "ID")}>
                <Copy className="h-3 w-3" />
              </Button>
            </div>
            {envelope.original_file_hash && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground w-20">SHA-256 orig:</span>
                <code className="text-xs bg-muted px-2 py-0.5 rounded flex-1 truncate">{envelope.original_file_hash}</code>
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => copyToClipboard(envelope.original_file_hash!, "Hash original")}>
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            )}
            {envelope.final_file_hash && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground w-20">SHA-256 final:</span>
                <code className="text-xs bg-muted px-2 py-0.5 rounded flex-1 truncate">{envelope.final_file_hash}</code>
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => copyToClipboard(envelope.final_file_hash!, "Hash final")}>
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            )}
          </div>
          {envelope.message && (
            <div className="bg-muted/50 rounded p-3 text-sm italic text-muted-foreground">
              "{envelope.message}"
            </div>
          )}
        </CardContent>
      </Card>

      {/* Signatários */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Signatários ({signers.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {signers.map((signer, idx) => (
            <div key={signer.id}>
              {idx > 0 && <Separator className="mb-3" />}
              <div className="flex items-start gap-3">
                <div className="mt-0.5">{SIGNER_STATUS_ICONS[signer.status]}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-sm">{signer.name}</p>
                    <Badge variant="outline" className="text-xs">{SIGNER_STATUS_LABELS[signer.status]}</Badge>
                    {signer.order_index > 0 && <Badge variant="secondary" className="text-xs">{signer.order_index + 1}º</Badge>}
                    {(signer.status === "pending" || signer.status === "viewed") && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-6 px-2 text-xs gap-1"
                        disabled={copyingLink === signer.id}
                        onClick={() => handleCopySigningLink(signer.id)}
                      >
                        {copyingLink === signer.id
                          ? <Loader2 className="h-3 w-3 animate-spin" />
                          : <Link2 className="h-3 w-3" />
                        }
                        Copiar link
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{signer.email}</p>
                  {signer.status === "signed" && signer.signed_at && (
                    <div className="mt-2 bg-green-50 dark:bg-green-900/20 rounded p-2 space-y-0.5">
                      <p className="text-xs text-green-700 dark:text-green-300 font-medium">
                        Assinou em {format(new Date(signer.signed_at), "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR })}
                      </p>
                      {signer.sign_ip && <p className="text-xs text-muted-foreground font-mono">IP: {signer.sign_ip}</p>}
                      {(signer.sign_geo_city || signer.sign_geo_country) && (
                        <p className="text-xs text-muted-foreground">
                          Local: {[signer.sign_geo_city, signer.sign_geo_region, signer.sign_geo_country].filter(Boolean).join(", ")}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Trilha de auditoria */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Trilha de Auditoria</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {auditEvents.map(ev => (
              <div key={ev.id} className="flex gap-3 text-xs">
                <div className="text-muted-foreground font-mono whitespace-nowrap">
                  {format(new Date(ev.created_at), "dd/MM HH:mm:ss")}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="font-medium">{AUDIT_LABELS[ev.event_type] ?? ev.event_type}</span>
                  {ev.ip && <span className="text-muted-foreground ml-2 font-mono">{ev.ip}</span>}
                  {ev.geo_city && <span className="text-muted-foreground ml-1">({[ev.geo_city, ev.geo_country].filter(Boolean).join(", ")})</span>}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {envelope && (
        <EnvelopeEditDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          envelope={envelope}
          signers={signers}
          onSaved={fetchAll}
        />
      )}
    </div>
  );
}
