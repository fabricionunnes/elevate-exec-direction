import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft, FileText, Plus, Printer, Trash2, Loader2,
  Send, RefreshCw, Check, Clock, Copy, ExternalLink,
  CheckCircle2, Download,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { generateDistratoPDF } from "@/components/distrato/generateDistratoPDF";
import { getDefaultDistratoClauses } from "@/components/distrato/DistratoClausesEditor";


interface DistratoRecord {
  id: string;
  company_name: string;
  company_cnpj: string | null;
  project_name: string | null;
  distrato_date: string;
  created_at: string;
  pdf_url: string | null;
  envelope_id: string | null;
  zapsign_document_token: string | null;
  zapsign_document_url: string | null;
  zapsign_signers: any[] | null;
  zapsign_sent_at: string | null;
}

interface EnvelopeSigner {
  id: string;
  envelope_id: string;
  name: string;
  email: string;
  status: string;
  signed_at: string | null;
  order_index: number;
}

interface EnvelopeInfo {
  id: string;
  status: string;
  completed_at: string | null;
  final_file_path: string | null;
  signers: EnvelopeSigner[];
}

interface ZapSignerStatus {
  name: string;
  email: string;
  status: string;
  signedAt: string | null;
  signUrl: string | null;
}

interface ZapSignatureStatus {
  signers: ZapSignerStatus[];
  allSigned: boolean;
  signedFileUrl: string | null;
}

export default function DistratoHistoryPage() {
  const navigate = useNavigate();
  const [distratos, setDistratos] = useState<DistratoRecord[]>([]);
  const [envelopeInfos, setEnvelopeInfos] = useState<Record<string, EnvelopeInfo>>({});
  const [loading, setLoading] = useState(true);

  // Dialog state
  const [selectedDistrato, setSelectedDistrato] = useState<DistratoRecord | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [isLoadingSignatures, setIsLoadingSignatures] = useState(false);
  const [copyingLink, setCopyingLink] = useState<string | null>(null);

  // Legado: status ZapSign (somente distratos antigos enviados pela ZapSign)
  const [zapStatus, setZapStatus] = useState<ZapSignatureStatus | null>(null);

  const [isSending, setIsSending] = useState(false);
  const [signerName, setSignerName] = useState("");
  const [signerEmail, setSignerEmail] = useState("");

  const fetchEnvelopeInfos = async (envelopeIds: string[]) => {
    if (envelopeIds.length === 0) return;
    const [{ data: envs }, { data: sgs }] = await Promise.all([
      supabase.from("envelopes").select("id, status, completed_at, final_file_path").in("id", envelopeIds),
      supabase.from("signers").select("id, envelope_id, name, email, status, signed_at, order_index").in("envelope_id", envelopeIds).order("order_index"),
    ]);
    const map: Record<string, EnvelopeInfo> = {};
    for (const env of (envs as any[]) || []) {
      map[env.id] = { ...env, signers: [] };
    }
    for (const s of (sgs as any[]) || []) {
      map[s.envelope_id]?.signers.push(s);
    }
    setEnvelopeInfos(prev => ({ ...prev, ...map }));
  };

  const fetchDistratos = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("distratos")
      .select("id, company_name, company_cnpj, project_name, distrato_date, created_at, pdf_url, envelope_id, zapsign_document_token, zapsign_document_url, zapsign_signers, zapsign_sent_at")
      .order("created_at", { ascending: false });
    if (error) {
      toast.error("Erro ao carregar histórico");
    } else {
      setDistratos((data as DistratoRecord[]) || []);
    }
    setLoading(false);

    const envelopeIds = ((data as any[]) || []).map(d => d.envelope_id).filter(Boolean) as string[];
    fetchEnvelopeInfos(envelopeIds);
  };

  useEffect(() => { fetchDistratos(); }, []);

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("distratos").delete().eq("id", id);
    if (error) {
      toast.error("Erro ao excluir distrato");
    } else {
      toast.success("Distrato excluído");
      fetchDistratos();
    }
  };

  const handleView = (distrato: DistratoRecord) => {
    if (distrato.pdf_url) {
      window.open(distrato.pdf_url, "_blank");
    } else {
      navigate(`/distrato?distrato_id=${distrato.id}`);
    }
  };

  const handleOpenDetails = async (distrato: DistratoRecord) => {
    setSelectedDistrato(distrato);
    setShowDialog(true);
    setZapStatus(null);

    if (distrato.envelope_id) {
      await refreshEnvelopeInfo(distrato.envelope_id);
    } else if (distrato.zapsign_document_token) {
      await checkZapSignStatus(distrato.zapsign_document_token);
    }
  };

  const refreshEnvelopeInfo = async (envelopeId: string) => {
    setIsLoadingSignatures(true);
    try {
      await fetchEnvelopeInfos([envelopeId]);
    } finally {
      setIsLoadingSignatures(false);
    }
  };

  const checkZapSignStatus = async (documentToken: string) => {
    setIsLoadingSignatures(true);
    try {
      const { data, error } = await supabase.functions.invoke("check-zapsign-status", {
        body: { documentToken },
      });
      if (error) { console.error(error); return; }
      setZapStatus({
        signers: data.signers || [],
        allSigned: data.allSigned || false,
        signedFileUrl: data.signedFileUrl || null,
      });
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingSignatures(false);
    }
  };

  const handleCopySigningLink = async (signer: EnvelopeSigner) => {
    setCopyingLink(signer.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return toast.error("Sessão expirada");

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-signing-link`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ signer_id: signer.id }),
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

  const handleDownloadFinal = async (info: EnvelopeInfo) => {
    if (!info.final_file_path) return toast.error("PDF assinado ainda não disponível");
    const { data, error } = await supabase.storage.from("envelopes").createSignedUrl(info.final_file_path, 300);
    if (error || !data?.signedUrl) return toast.error("Erro ao gerar link");
    window.open(data.signedUrl, "_blank");
  };

  const ensurePdfUrl = async (distratoId: string): Promise<string | null> => {
    // Fetch full distrato record
    const { data: full, error } = await supabase
      .from("distratos")
      .select("*")
      .eq("id", distratoId)
      .single();
    if (error || !full) {
      toast.error("Erro ao carregar dados do distrato");
      return null;
    }
    if (full.pdf_url) return full.pdf_url as string;

    // Regenerate PDF from snapshot
    try {
      const formData: any = {
        companyId: full.company_id || "",
        companyName: full.company_name || "",
        companyCnpj: full.company_cnpj || "",
        companyAddress: full.company_address || "",
        legalRepName: full.legal_rep_name || "",
        projectId: full.project_id || "",
        projectName: full.project_name || "",
        contractDate: full.contract_date || "",
        serviceDescription: full.service_description || "",
        distratoDate: new Date(full.distrato_date),
        additionalNotes: full.additional_notes || "",
      };
      const clauses = (full.clauses_snapshot as any[]) || getDefaultDistratoClauses();
      const blob = await generateDistratoPDF({ formData, clauses });
      const fileName = `distratos/${Date.now()}_${(full.company_name || "distrato").replace(/\s+/g, "_")}.pdf`;
      const { error: upErr } = await supabase.storage
        .from("contract-pdfs")
        .upload(fileName, blob, { contentType: "application/pdf", upsert: false });
      if (upErr) {
        console.error(upErr);
        toast.error("Erro ao salvar PDF no storage");
        return null;
      }
      const { data: pub } = supabase.storage.from("contract-pdfs").getPublicUrl(fileName);
      const url = pub.publicUrl;
      await supabase.from("distratos").update({ pdf_url: url }).eq("id", distratoId);
      return url;
    } catch (e) {
      console.error(e);
      toast.error("Erro ao gerar PDF do distrato");
      return null;
    }
  };

  const handleSendForSignature = async () => {
    if (!selectedDistrato) return;
    if (!signerName || !signerEmail) {
      toast.error("Preencha nome e e-mail do signatário");
      return;
    }
    setIsSending(true);
    try {
      const pdfUrl = selectedDistrato.pdf_url || await ensurePdfUrl(selectedDistrato.id);
      if (!pdfUrl) {
        setIsSending(false);
        return;
      }
      const documentName = `Distrato - ${selectedDistrato.company_name} - ${format(new Date(selectedDistrato.distrato_date), "dd-MM-yyyy")}`;

      const pdfRes = await fetch(pdfUrl);
      if (!pdfRes.ok) throw new Error(`Erro ao baixar PDF: HTTP ${pdfRes.status}`);
      const pdfBlob = await pdfRes.blob();

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Sessão expirada");
        return;
      }

      const formDataEnvelope = new FormData();
      formDataEnvelope.append("title", documentName);
      formDataEnvelope.append("message", "Por favor, assine o distrato abaixo.");
      formDataEnvelope.append("signers", JSON.stringify([
        { name: "Fabrício Nunnes", email: "fabricio@universidadevendas.com.br", order_index: 0 },
        { name: signerName, email: signerEmail, order_index: 1 },
      ]));
      formDataEnvelope.append("expires_in_days", "60");
      formDataEnvelope.append("pdf", new File([pdfBlob], "distrato.pdf", { type: "application/pdf" }));

      const createRes = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-envelope`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: formDataEnvelope,
      });
      const createData = await createRes.json();
      if (!createRes.ok || !createData.success) throw new Error(createData.error || "Erro ao criar envelope");

      const envelopeId = createData.data.envelope_id;

      const { error: sendError } = await supabase.functions.invoke("send-envelope", {
        body: { envelope_id: envelopeId },
      });
      if (sendError) throw sendError;

      await supabase.from("distratos").update({
        envelope_id: envelopeId,
        zapsign_sent_at: new Date().toISOString(),
      }).eq("id", selectedDistrato.id);

      toast.success("Distrato enviado para assinatura!");
      setSignerName(""); setSignerEmail("");
      const updated = { ...selectedDistrato,
        pdf_url: pdfUrl,
        envelope_id: envelopeId,
        zapsign_sent_at: new Date().toISOString(),
      };
      setSelectedDistrato(updated);
      setDistratos(prev => prev.map(d => d.id === updated.id ? updated : d));
      await fetchEnvelopeInfos([envelopeId]);
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Erro ao enviar para assinatura");
    } finally {
      setIsSending(false);
    }
  };

  const getSignatureBadge = (d: DistratoRecord) => {
    if (d.envelope_id) {
      const info = envelopeInfos[d.envelope_id];
      if (!info) return <Badge variant="secondary" className="text-[10px]">Enviado</Badge>;
      if (info.status === "completed") return <Badge className="bg-green-600 text-white text-[10px]">Assinado</Badge>;
      if (info.status === "cancelled") return <Badge variant="secondary" className="text-[10px]">Cancelado</Badge>;
      if (info.status === "expired") return <Badge variant="secondary" className="text-[10px]">Expirado</Badge>;
      const someSigned = info.signers.some(s => s.status === "signed");
      if (someSigned) return <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 text-[10px]">Parcial</Badge>;
      return <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 text-[10px]">Pendente</Badge>;
    }
    if (!d.zapsign_document_token) return null;
    const signers = (d.zapsign_signers || []) as any[];
    const allSigned = signers.length > 0 && signers.every(s => s.status === "signed");
    const someSigned = signers.some(s => s.status === "signed");

    if (allSigned) return <Badge className="bg-green-600 text-white text-[10px]">Assinado</Badge>;
    if (someSigned) return <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 text-[10px]">Parcial</Badge>;
    return <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 text-[10px]">Pendente</Badge>;
  };

  const selectedEnvelopeInfo = selectedDistrato?.envelope_id ? envelopeInfos[selectedDistrato.envelope_id] : undefined;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/contratos")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold flex items-center gap-2">
                <FileText className="h-5 w-5" /> Histórico de Distratos
              </h1>
              <p className="text-sm text-muted-foreground">Todos os distratos gerados</p>
            </div>
          </div>
          <Button onClick={() => navigate("/distrato")} className="gap-2">
            <Plus className="h-4 w-4" /> Novo Distrato
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : distratos.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <FileText className="h-12 w-12 text-muted-foreground mb-3" />
              <p className="text-muted-foreground">Nenhum distrato gerado ainda</p>
              <Button variant="outline" className="mt-4" onClick={() => navigate("/distrato")}>
                Gerar primeiro distrato
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {distratos.map((d) => (
              <Card
                key={d.id}
                className="hover:shadow-sm transition-shadow cursor-pointer"
                onClick={() => handleOpenDetails(d)}
              >
                <CardContent className="flex items-center justify-between py-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{d.company_name}</p>
                      {getSignatureBadge(d)}
                    </div>
                    <div className="flex gap-3 text-sm text-muted-foreground">
                      {d.company_cnpj && <span>{d.company_cnpj}</span>}
                      {d.project_name && <span>• {d.project_name}</span>}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Distrato em {format(new Date(d.distrato_date), "dd/MM/yyyy")} •
                      Gerado em {format(new Date(d.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                  <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" onClick={() => handleView(d)} title="Visualizar / Imprimir">
                      <Printer className="h-4 w-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Excluir distrato?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Essa ação não pode ser desfeita. O registro do distrato de {d.company_name} será removido.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(d.id)}>Excluir</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Detail Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {selectedDistrato?.company_name}
            </DialogTitle>
          </DialogHeader>

          {selectedDistrato && (
            <div className="space-y-4">
              {/* Info */}
              <div className="text-sm space-y-1">
                {selectedDistrato.company_cnpj && (
                  <p><span className="text-muted-foreground">CNPJ:</span> {selectedDistrato.company_cnpj}</p>
                )}
                {selectedDistrato.project_name && (
                  <p><span className="text-muted-foreground">Projeto:</span> {selectedDistrato.project_name}</p>
                )}
                <p>
                  <span className="text-muted-foreground">Data do distrato:</span>{" "}
                  {format(new Date(selectedDistrato.distrato_date), "dd/MM/yyyy")}
                </p>
                <p>
                  <span className="text-muted-foreground">Gerado em:</span>{" "}
                  {format(new Date(selectedDistrato.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                </p>
              </div>

              {/* Actions */}
              {selectedDistrato.pdf_url && (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => window.open(selectedDistrato.pdf_url!, "_blank")} className="gap-1">
                    <Printer className="h-3.5 w-3.5" /> Visualizar PDF
                  </Button>
                </div>
              )}

              {/* Assinatura interna (envelope) */}
              {selectedDistrato.envelope_id && (
                <>
                  <Separator />
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-medium flex items-center gap-2">
                        <Send className="h-4 w-4 text-primary" />
                        Assinatura Digital
                      </h4>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => refreshEnvelopeInfo(selectedDistrato.envelope_id!)}
                        disabled={isLoadingSignatures}
                      >
                        <RefreshCw className={`h-3 w-3 ${isLoadingSignatures ? "animate-spin" : ""}`} />
                      </Button>
                    </div>

                    {selectedDistrato.zapsign_sent_at && (
                      <p className="text-xs text-muted-foreground">
                        Enviado em {format(new Date(selectedDistrato.zapsign_sent_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </p>
                    )}

                    {isLoadingSignatures ? (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                        <span className="ml-2 text-sm text-muted-foreground">Verificando assinaturas...</span>
                      </div>
                    ) : selectedEnvelopeInfo ? (
                      <div className="space-y-2">
                        {selectedEnvelopeInfo.signers.map((signer) => (
                          <div
                            key={signer.id}
                            className={`flex items-center justify-between p-3 rounded-lg border ${
                              signer.status === "signed"
                                ? "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-900"
                                : "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900"
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              {signer.status === "signed" ? (
                                <Check className="h-4 w-4 text-green-600" />
                              ) : (
                                <Clock className="h-4 w-4 text-amber-600" />
                              )}
                              <div>
                                <p className="text-sm font-medium">{signer.name}</p>
                                <p className="text-xs text-muted-foreground">{signer.email}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              {signer.status === "signed" ? (
                                <Badge className="bg-green-600 text-white">Assinado</Badge>
                              ) : (
                                <div className="flex flex-col items-end gap-1">
                                  <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                                    {signer.status === "declined" ? "Recusou" : signer.status === "viewed" ? "Visualizou" : "Pendente"}
                                  </Badge>
                                  {signer.status !== "declined" && (
                                    <button
                                      onClick={() => handleCopySigningLink(signer)}
                                      disabled={copyingLink === signer.id}
                                      className="text-xs text-primary hover:underline flex items-center gap-1"
                                    >
                                      {copyingLink === signer.id ? (
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                      ) : (
                                        <Copy className="h-3 w-3" />
                                      )}
                                      Copiar link
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}

                        {selectedEnvelopeInfo.status === "completed" && (
                          <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900 rounded-lg p-4">
                            <div className="flex items-center gap-2 mb-3">
                              <CheckCircle2 className="h-5 w-5 text-green-600" />
                              <span className="text-sm font-medium text-green-800 dark:text-green-300">
                                Todas as partes assinaram!
                              </span>
                            </div>
                            <Button
                              onClick={() => handleDownloadFinal(selectedEnvelopeInfo)}
                              className="w-full bg-green-600 hover:bg-green-700"
                              size="sm"
                            >
                              <Download className="h-4 w-4 mr-2" />
                              Baixar Distrato Assinado
                            </Button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-2">
                        Status disponível apenas para quem enviou o envelope
                      </p>
                    )}

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate("/onboarding-tasks/assinaturas")}
                      className="w-full gap-1"
                    >
                      <ExternalLink className="h-3.5 w-3.5" /> Abrir painel de assinaturas
                    </Button>
                  </div>
                </>
              )}

              {/* Legado: ZapSign (distratos antigos) */}
              {!selectedDistrato.envelope_id && selectedDistrato.zapsign_document_token && (
                <>
                  <Separator />
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-medium flex items-center gap-2">
                        <Send className="h-4 w-4 text-primary" />
                        Assinatura Digital (ZapSign — legado)
                      </h4>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => checkZapSignStatus(selectedDistrato.zapsign_document_token!)}
                        disabled={isLoadingSignatures}
                      >
                        <RefreshCw className={`h-3 w-3 ${isLoadingSignatures ? "animate-spin" : ""}`} />
                      </Button>
                    </div>

                    {selectedDistrato.zapsign_sent_at && (
                      <p className="text-xs text-muted-foreground">
                        Enviado em {format(new Date(selectedDistrato.zapsign_sent_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </p>
                    )}

                    {isLoadingSignatures ? (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                        <span className="ml-2 text-sm text-muted-foreground">Verificando assinaturas...</span>
                      </div>
                    ) : zapStatus ? (
                      <div className="space-y-2">
                        {zapStatus.signers.map((signer, index) => (
                          <div
                            key={index}
                            className={`flex items-center justify-between p-3 rounded-lg border ${
                              signer.status === "signed"
                                ? "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-900"
                                : "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900"
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              {signer.status === "signed" ? (
                                <Check className="h-4 w-4 text-green-600" />
                              ) : (
                                <Clock className="h-4 w-4 text-amber-600" />
                              )}
                              <div>
                                <p className="text-sm font-medium">{signer.name}</p>
                                <p className="text-xs text-muted-foreground">{signer.email}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              {signer.status === "signed" ? (
                                <Badge className="bg-green-600 text-white">Assinado</Badge>
                              ) : (
                                <div className="flex flex-col items-end gap-1">
                                  <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                                    Pendente
                                  </Badge>
                                  {signer.signUrl && (
                                    <div className="flex items-center gap-2">
                                      <button
                                        onClick={() => {
                                          navigator.clipboard.writeText(signer.signUrl!);
                                          toast.success("Link copiado!");
                                        }}
                                        className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                                      >
                                        <Copy className="h-3 w-3" />
                                      </button>
                                      <a
                                        href={signer.signUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-xs text-primary hover:underline flex items-center gap-1"
                                      >
                                        Assinar <ExternalLink className="h-3 w-3" />
                                      </a>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}

                        {zapStatus.allSigned && zapStatus.signedFileUrl && (
                          <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900 rounded-lg p-4">
                            <div className="flex items-center gap-2 mb-3">
                              <CheckCircle2 className="h-5 w-5 text-green-600" />
                              <span className="text-sm font-medium text-green-800 dark:text-green-300">
                                Todas as partes assinaram!
                              </span>
                            </div>
                            <Button
                              onClick={() => window.open(zapStatus.signedFileUrl!, "_blank")}
                              className="w-full bg-green-600 hover:bg-green-700"
                              size="sm"
                            >
                              <Download className="h-4 w-4 mr-2" />
                              Baixar Distrato Assinado
                            </Button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-2">
                        Clique em atualizar para verificar o status
                      </p>
                    )}

                    {selectedDistrato.zapsign_document_url && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(selectedDistrato.zapsign_document_url!, "_blank")}
                        className="w-full gap-1"
                      >
                        <ExternalLink className="h-3.5 w-3.5" /> Ver no ZapSign
                      </Button>
                    )}
                  </div>
                </>
              )}

              {/* Enviar para assinatura (quando ainda não enviado) */}
              {!selectedDistrato.envelope_id && !selectedDistrato.zapsign_document_token && (
                <>
                  <Separator />
                  <div className="space-y-3">
                    <h4 className="text-sm font-medium flex items-center gap-2">
                      <Send className="h-4 w-4 text-primary" />
                      Enviar para assinatura
                    </h4>
                    {!selectedDistrato.pdf_url && (
                      <p className="text-xs text-amber-600">
                        Este distrato não tem PDF salvo. Abra-o em "Visualizar / Imprimir" para gerar o PDF antes de enviar.
                      </p>
                    )}
                    <div className="space-y-2">
                      <div>
                        <Label htmlFor="signer-name" className="text-xs">Nome do signatário *</Label>
                        <Input id="signer-name" value={signerName} onChange={(e) => setSignerName(e.target.value)} placeholder="Nome completo" />
                      </div>
                      <div>
                        <Label htmlFor="signer-email" className="text-xs">E-mail *</Label>
                        <Input id="signer-email" type="email" value={signerEmail} onChange={(e) => setSignerEmail(e.target.value)} placeholder="email@empresa.com" />
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Os signatários recebem o link de assinatura por e-mail. Fabrício é incluído automaticamente.
                    </p>
                    <Button
                      onClick={handleSendForSignature}
                      disabled={isSending || !selectedDistrato.pdf_url}
                      className="w-full gap-2"
                    >
                      {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      Enviar para Assinatura
                    </Button>
                  </div>
                </>
              )}

            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
