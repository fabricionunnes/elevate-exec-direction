import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft, FileText, Plus, Printer, Trash2, Loader2,
  Send, RefreshCw, Check, Clock, Copy, ExternalLink,
  CheckCircle2, Download, X
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
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
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
  zapsign_document_token: string | null;
  zapsign_document_url: string | null;
  zapsign_signers: any[] | null;
  zapsign_sent_at: string | null;
}

interface SignerStatus {
  name: string;
  email: string;
  status: string;
  signedAt: string | null;
  signUrl: string | null;
}

interface SignatureStatus {
  signers: SignerStatus[];
  allSigned: boolean;
  signedFileUrl: string | null;
}

export default function DistratoHistoryPage() {
  const navigate = useNavigate();
  const [distratos, setDistratos] = useState<DistratoRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Dialog state
  const [selectedDistrato, setSelectedDistrato] = useState<DistratoRecord | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [signatureStatus, setSignatureStatus] = useState<SignatureStatus | null>(null);
  const [isLoadingSignatures, setIsLoadingSignatures] = useState(false);

  const [isSendingZap, setIsSendingZap] = useState(false);
  const [signerName, setSignerName] = useState("");
  const [signerEmail, setSignerEmail] = useState("");
  const [signerPhone, setSignerPhone] = useState("");

  const fetchDistratos = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("distratos")
      .select("id, company_name, company_cnpj, project_name, distrato_date, created_at, pdf_url, zapsign_document_token, zapsign_document_url, zapsign_signers, zapsign_sent_at")
      .order("created_at", { ascending: false });
    if (error) {
      toast.error("Erro ao carregar histórico");
    } else {
      setDistratos((data as DistratoRecord[]) || []);
    }
    setLoading(false);

    // Batch refresh ZapSign statuses
    const withZapSign = (data || []).filter((d: any) => d.zapsign_document_token);
    if (withZapSign.length > 0) {
      refreshZapSignStatuses(withZapSign as DistratoRecord[]);
    }
  };

  const refreshZapSignStatuses = async (items: DistratoRecord[]) => {
    const results = await Promise.allSettled(
      items.map(async (d) => {
        try {
          const { data, error } = await supabase.functions.invoke("check-zapsign-status", {
            body: { documentToken: d.zapsign_document_token },
          });
          if (error || !data?.signers) return null;
          const signersChanged = JSON.stringify(data.signers.map((s: any) => s.status)) !==
            JSON.stringify((d.zapsign_signers || []).map((s: any) => s.status));
          if (signersChanged) {
            await supabase.from("distratos").update({ zapsign_signers: data.signers }).eq("id", d.id);
          }
          return { id: d.id, signers: data.signers };
        } catch { return null; }
      })
    );

    const updates = results
      .filter((r): r is PromiseFulfilledResult<{ id: string; signers: any[] } | null> => r.status === "fulfilled")
      .map(r => r.value)
      .filter(Boolean) as { id: string; signers: any[] }[];

    if (updates.length > 0) {
      setDistratos(prev => prev.map(d => {
        const update = updates.find(u => u.id === d.id);
        return update ? { ...d, zapsign_signers: update.signers } : d;
      }));
    }
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
    setSignatureStatus(null);

    if (distrato.zapsign_document_token) {
      await checkSignatureStatus(distrato.zapsign_document_token);
    }
  };

  const checkSignatureStatus = async (documentToken: string) => {
    setIsLoadingSignatures(true);
    try {
      const { data, error } = await supabase.functions.invoke("check-zapsign-status", {
        body: { documentToken },
      });
      if (error) { console.error(error); return; }
      setSignatureStatus({
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

  const handleSendToZapSign = async () => {
    if (!selectedDistrato) return;
    if (!selectedDistrato.pdf_url) {
      toast.error("Distrato sem PDF salvo. Gere novamente pela tela de criação.");
      return;
    }
    if (!signerName || !signerEmail) {
      toast.error("Preencha nome e e-mail do signatário");
      return;
    }
    setIsSendingZap(true);
    try {
      const documentName = `Distrato - ${selectedDistrato.company_name} - ${format(new Date(selectedDistrato.distrato_date), "dd-MM-yyyy")}`;
      const { data: zapData, error: zapError } = await supabase.functions.invoke("send-to-zapsign", {
        body: {
          pdfUrl: selectedDistrato.pdf_url,
          documentName,
          signers: [
            { name: "Fabrício Nunnes", email: "fabricio@universidadevendas.com.br" },
            { name: signerName, email: signerEmail, phone: signerPhone || undefined },
          ],
          sendAutomatically: true,
        },
      });
      if (zapError) throw zapError;

      await supabase.from("distratos").update({
        zapsign_document_token: zapData.documentToken,
        zapsign_document_url: zapData.documentUrl,
        zapsign_signers: zapData.signers,
        zapsign_sent_at: new Date().toISOString(),
      }).eq("id", selectedDistrato.id);

      toast.success("Distrato enviado para assinatura via ZapSign!");
      setSignerName(""); setSignerEmail(""); setSignerPhone("");
      const updated = { ...selectedDistrato,
        zapsign_document_token: zapData.documentToken,
        zapsign_document_url: zapData.documentUrl,
        zapsign_signers: zapData.signers,
        zapsign_sent_at: new Date().toISOString(),
      };
      setSelectedDistrato(updated);
      setDistratos(prev => prev.map(d => d.id === updated.id ? updated : d));
      await checkSignatureStatus(zapData.documentToken);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao enviar para ZapSign");
    } finally {
      setIsSendingZap(false);
    }
  };

  const getZapSignBadge = (d: DistratoRecord) => {
    if (!d.zapsign_document_token) return null;
    const signers = (d.zapsign_signers || []) as any[];
    const allSigned = signers.length > 0 && signers.every(s => s.status === "signed");
    const someSigned = signers.some(s => s.status === "signed");

    if (allSigned) return <Badge className="bg-green-600 text-white text-[10px]">Assinado</Badge>;
    if (someSigned) return <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 text-[10px]">Parcial</Badge>;
    return <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 text-[10px]">Pendente</Badge>;
  };

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
                      {getZapSignBadge(d)}
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

      {/* Detail Dialog with ZapSign Status */}
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

              {/* ZapSign Section */}
              {selectedDistrato.zapsign_document_token && (
                <>
                  <Separator />
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-medium flex items-center gap-2">
                        <Send className="h-4 w-4 text-primary" />
                        Assinatura Digital (ZapSign)
                      </h4>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => checkSignatureStatus(selectedDistrato.zapsign_document_token!)}
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
                    ) : signatureStatus ? (
                      <div className="space-y-2">
                        {signatureStatus.signers.map((signer, index) => (
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

                        {signatureStatus.allSigned && signatureStatus.signedFileUrl && (
                          <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900 rounded-lg p-4">
                            <div className="flex items-center gap-2 mb-3">
                              <CheckCircle2 className="h-5 w-5 text-green-600" />
                              <span className="text-sm font-medium text-green-800 dark:text-green-300">
                                Todas as partes assinaram!
                              </span>
                            </div>
                            <Button
                              onClick={() => window.open(signatureStatus.signedFileUrl!, "_blank")}
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

              {/* Send to ZapSign (when not yet sent) */}
              {!selectedDistrato.zapsign_document_token && (
                <>
                  <Separator />
                  <div className="space-y-3">
                    <h4 className="text-sm font-medium flex items-center gap-2">
                      <Send className="h-4 w-4 text-primary" />
                      Enviar para assinatura (ZapSign)
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
                      <div>
                        <Label htmlFor="signer-phone" className="text-xs">Telefone (opcional)</Label>
                        <Input id="signer-phone" value={signerPhone} onChange={(e) => setSignerPhone(e.target.value)} placeholder="(11) 99999-9999" />
                      </div>
                    </div>
                    <Button
                      onClick={handleSendToZapSign}
                      disabled={isSendingZap || !selectedDistrato.pdf_url}
                      className="w-full gap-2"
                    >
                      {isSendingZap ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      Enviar para ZapSign
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
