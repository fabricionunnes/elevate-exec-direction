import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Shield, Search, CheckCircle2, Clock, Eye, XCircle, Copy, AlertCircle } from "lucide-react";
import type { Envelope, Signer, AuditEvent, SignerStatus, AuditEventType } from "@/types/signatures";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

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
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  draft: { label: "Rascunho", color: "bg-gray-100 text-gray-700" },
  sent: { label: "Enviado", color: "bg-blue-100 text-blue-700" },
  partially_signed: { label: "Assinado Parcialmente", color: "bg-yellow-100 text-yellow-700" },
  completed: { label: "Concluído", color: "bg-green-100 text-green-700" },
  expired: { label: "Expirado", color: "bg-red-100 text-red-700" },
  cancelled: { label: "Cancelado", color: "bg-red-100 text-red-700" },
};

interface VerificationData {
  envelope: Envelope;
  signers: Signer[];
  audit: AuditEvent[];
}

export default function VerificationPage() {
  const { envelopeId: paramId } = useParams<{ envelopeId?: string }>();
  const navigate = useNavigate();
  const [searchId, setSearchId] = useState(paramId ?? "");
  const [data, setData] = useState<VerificationData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async (idToSearch?: string) => {
    const id = idToSearch ?? searchId.trim();
    if (!id) return;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      setError("ID de envelope inválido. Use o formato UUID (ex: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)");
      return;
    }

    setLoading(true);
    setError(null);
    setData(null);

    try {
      const [{ data: envelope, error: envErr }, { data: signers }, { data: audit }] = await Promise.all([
        supabase.from("envelopes").select("*").eq("id", id).maybeSingle(),
        supabase.from("signers").select("*").eq("envelope_id", id).order("order_index"),
        supabase.from("audit_events").select("*").eq("envelope_id", id).order("created_at"),
      ]);

      if (envErr || !envelope) {
        // Try public read without auth — note: this requires service-role or public policy
        setError("Documento não encontrado ou sem permissão de visualização.");
        return;
      }

      setData({ envelope: envelope as Envelope, signers: (signers as Signer[]) ?? [], audit: (audit as AuditEvent[]) ?? [] });
      if (id !== paramId) navigate(`/verificar/${id}`, { replace: true });
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  // Auto-search on mount if paramId is provided
  useState(() => { if (paramId) handleSearch(paramId); });

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => toast.success(`${label} copiado`));
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-[#0D2B5E] text-white px-4 py-5">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <Shield className="h-6 w-6 text-blue-200" />
          <div>
            <h1 className="font-bold">Verificação de Documento</h1>
            <p className="text-xs text-blue-200">UNV Nexus — Assinatura Eletrônica</p>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto p-4 space-y-4">
        {/* Busca */}
        <Card>
          <CardContent className="pt-5 pb-5">
            <div className="flex gap-2">
              <Input
                value={searchId}
                onChange={e => setSearchId(e.target.value)}
                placeholder="Cole o ID do envelope (UUID)"
                onKeyDown={e => e.key === "Enter" && handleSearch()}
                className="font-mono text-sm"
              />
              <Button onClick={() => handleSearch()} disabled={loading} className="bg-[#0D2B5E] hover:bg-[#0D2B5E]/90">
                {loading ? <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" /> : <Search className="h-4 w-4" />}
              </Button>
            </div>
            {error && (
              <div className="mt-3 flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded p-2">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                {error}
              </div>
            )}
          </CardContent>
        </Card>

        {data && (
          <>
            {/* Envelope info */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base">{data.envelope.title}</CardTitle>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_LABELS[data.envelope.status]?.color ?? "bg-gray-100 text-gray-700"}`}>
                    {STATUS_LABELS[data.envelope.status]?.label ?? data.envelope.status}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground w-24">ID:</span>
                    <code className="bg-muted px-2 py-0.5 rounded flex-1 truncate">{data.envelope.id}</code>
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => copyToClipboard(data.envelope.id, "ID")}>
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground w-24">Criado em:</span>
                    <span>{format(new Date(data.envelope.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
                  </div>
                  {data.envelope.completed_at && (
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground w-24">Concluído:</span>
                      <span className="text-green-700 font-medium">{format(new Date(data.envelope.completed_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
                    </div>
                  )}
                  {data.envelope.original_file_hash && (
                    <div className="flex items-start gap-2">
                      <span className="text-muted-foreground w-24 pt-0.5">SHA-256 orig:</span>
                      <code className="bg-muted px-2 py-0.5 rounded flex-1 break-all">{data.envelope.original_file_hash}</code>
                      <Button size="icon" variant="ghost" className="h-6 w-6 flex-shrink-0" onClick={() => copyToClipboard(data.envelope.original_file_hash!, "Hash")}>
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                  {data.envelope.final_file_hash && (
                    <div className="flex items-start gap-2">
                      <span className="text-muted-foreground w-24 pt-0.5">SHA-256 final:</span>
                      <code className="bg-muted px-2 py-0.5 rounded flex-1 break-all">{data.envelope.final_file_hash}</code>
                      <Button size="icon" variant="ghost" className="h-6 w-6 flex-shrink-0" onClick={() => copyToClipboard(data.envelope.final_file_hash!, "Hash final")}>
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Signatários */}
            {data.signers.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Signatários</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {data.signers.map((signer, idx) => (
                    <div key={signer.id}>
                      {idx > 0 && <Separator className="mb-3" />}
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5">{SIGNER_STATUS_ICONS[signer.status]}</div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium text-sm">{signer.name}</p>
                            <Badge variant="outline" className="text-xs">{SIGNER_STATUS_LABELS[signer.status]}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">{signer.email}</p>
                          {signer.status === "signed" && signer.signed_at && (
                            <div className="mt-2 bg-green-50 rounded p-2 text-xs text-green-700 space-y-0.5">
                              <p className="font-medium">Assinou em {format(new Date(signer.signed_at), "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR })}</p>
                              {signer.sign_ip && <p className="font-mono">IP: {signer.sign_ip}</p>}
                              {signer.sign_geo_country && <p>Local: {[signer.sign_geo_city, signer.sign_geo_region, signer.sign_geo_country].filter(Boolean).join(", ")}</p>}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Trilha de auditoria */}
            {data.audit.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Trilha de Auditoria</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {data.audit.map(ev => (
                      <div key={ev.id} className="flex gap-3 text-xs border-l-2 border-muted pl-3">
                        <div className="text-muted-foreground font-mono whitespace-nowrap">
                          {format(new Date(ev.created_at), "dd/MM HH:mm:ss")}
                        </div>
                        <div className="flex-1">
                          <span className="font-medium">{AUDIT_LABELS[ev.event_type] ?? ev.event_type}</span>
                          {ev.ip && <span className="text-muted-foreground ml-2 font-mono">{ev.ip}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            <p className="text-xs text-center text-muted-foreground pb-4">
              Documento com validade jurídica — MP 2.200-2/2001 e Lei 14.063/2020
            </p>
          </>
        )}
      </div>
    </div>
  );
}
