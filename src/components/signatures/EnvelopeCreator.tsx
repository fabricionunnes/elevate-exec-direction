import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Plus, Trash2, Upload, Send, GripVertical, FileText } from "lucide-react";
import type { SignerInput } from "@/types/signatures";

interface Props {
  onCreated?: (envelopeId: string) => void;
}

export function EnvelopeCreator({ onCreated }: Props) {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [expiresInDays, setExpiresInDays] = useState("30");
  const [sequential, setSequential] = useState(false);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [signers, setSigners] = useState<SignerInput[]>([{ name: "", email: "", order_index: 0 }]);
  const [loading, setLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const addSigner = () => {
    setSigners(prev => [...prev, { name: "", email: "", order_index: prev.length }]);
  };

  const removeSigner = (idx: number) => {
    setSigners(prev => prev.filter((_, i) => i !== idx).map((s, i) => ({ ...s, order_index: sequential ? i : 0 })));
  };

  const updateSigner = (idx: number, field: keyof SignerInput, value: string) => {
    setSigners(prev => prev.map((s, i) => i === idx ? { ...s, [field]: value } : s));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file?.type === "application/pdf") setPdfFile(file);
    else toast.error("Somente arquivos PDF são aceitos");
  };

  const handleSubmit = async () => {
    if (!title.trim()) return toast.error("Título obrigatório");
    if (!pdfFile) return toast.error("Selecione um PDF");
    if (signers.some(s => !s.name.trim() || !s.email.trim())) return toast.error("Preencha nome e e-mail de todos os signatários");

    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return toast.error("Sessão expirada");

      const signersWithOrder = sequential
        ? signers.map((s, i) => ({ ...s, order_index: i }))
        : signers.map(s => ({ ...s, order_index: 0 }));

      // Criar envelope
      const formData = new FormData();
      formData.append("title", title.trim());
      if (message.trim()) formData.append("message", message.trim());
      formData.append("signers", JSON.stringify(signersWithOrder));
      formData.append("expires_in_days", expiresInDays);
      formData.append("pdf", pdfFile);

      const createRes = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-envelope`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${session.access_token}` },
          body: formData,
        }
      );
      const createData = await createRes.json();
      if (!createData.success) throw new Error(createData.error ?? "Erro ao criar envelope");

      const envelopeId = createData.data.envelope_id;

      // Enviar e-mails
      const sendRes = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-envelope`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ envelope_id: envelopeId }),
        }
      );
      const sendData = await sendRes.json();
      if (!sendData.success) throw new Error(sendData.error ?? "Erro ao enviar e-mails");

      toast.success(`Envelope criado e ${sendData.data.emails_sent} e-mail(s) enviado(s)`);
      onCreated?.(envelopeId);

      // Reset
      setTitle(""); setMessage(""); setPdfFile(null); setExpiresInDays("30"); setSequential(false);
      setSigners([{ name: "", email: "", order_index: 0 }]);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-5 w-5" />
            Novo Documento para Assinatura
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Upload PDF */}
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/30 hover:border-primary/50"}`}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => document.getElementById("pdf-input")?.click()}
          >
            <input id="pdf-input" type="file" accept="application/pdf" className="hidden" onChange={e => setPdfFile(e.target.files?.[0] ?? null)} />
            <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
            {pdfFile ? (
              <div>
                <p className="font-medium text-sm">{pdfFile.name}</p>
                <p className="text-xs text-muted-foreground">{(pdfFile.size / 1024 / 1024).toFixed(2)} MB</p>
              </div>
            ) : (
              <div>
                <p className="text-sm font-medium">Arraste um PDF ou clique para selecionar</p>
                <p className="text-xs text-muted-foreground mt-1">Máximo 50 MB</p>
              </div>
            )}
          </div>

          {/* Título */}
          <div className="space-y-1">
            <Label>Título do documento *</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex: Contrato de Prestação de Serviços" maxLength={255} />
          </div>

          {/* Mensagem */}
          <div className="space-y-1">
            <Label>Mensagem para os signatários (opcional)</Label>
            <Textarea value={message} onChange={e => setMessage(e.target.value)} placeholder="Prezado(a), por favor assine o documento abaixo." rows={3} maxLength={1000} />
          </div>

          {/* Validade */}
          <div className="space-y-1">
            <Label>Validade do link (dias)</Label>
            <Input type="number" value={expiresInDays} onChange={e => setExpiresInDays(e.target.value)} min={1} max={365} className="w-32" />
          </div>

          {/* Ordem sequencial */}
          <div className="flex items-center gap-3">
            <Switch checked={sequential} onCheckedChange={setSequential} id="seq-switch" />
            <Label htmlFor="seq-switch" className="cursor-pointer">
              Assinatura sequencial
              <span className="text-xs text-muted-foreground ml-1">(cada signatário recebe o e-mail somente após o anterior assinar)</span>
            </Label>
          </div>
        </CardContent>
      </Card>

      {/* Signatários */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Signatários</CardTitle>
            <Button size="sm" variant="outline" onClick={addSigner} disabled={signers.length >= 20}>
              <Plus className="h-4 w-4 mr-1" /> Adicionar
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {signers.map((signer, idx) => (
            <div key={idx} className="flex gap-2 items-start p-3 border rounded-lg bg-muted/30">
              {sequential && <GripVertical className="h-4 w-4 mt-2 text-muted-foreground flex-shrink-0" />}
              {sequential && <Badge variant="outline" className="mt-1.5 flex-shrink-0 text-xs">{idx + 1}º</Badge>}
              <div className="flex-1 grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Nome *</Label>
                  <Input value={signer.name} onChange={e => updateSigner(idx, "name", e.target.value)} placeholder="Nome completo" className="h-8 text-sm" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">E-mail *</Label>
                  <Input type="email" value={signer.email} onChange={e => updateSigner(idx, "email", e.target.value)} placeholder="email@exemplo.com" className="h-8 text-sm" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">CPF (opcional)</Label>
                  <Input value={signer.cpf ?? ""} onChange={e => updateSigner(idx, "cpf", e.target.value)} placeholder="00000000000" maxLength={14} className="h-8 text-sm" />
                </div>
              </div>
              {signers.length > 1 && (
                <Button size="icon" variant="ghost" className="h-8 w-8 mt-5 text-destructive hover:text-destructive" onClick={() => removeSigner(idx)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <Button onClick={handleSubmit} disabled={loading} className="w-full" size="lg">
        {loading ? (
          <span className="flex items-center gap-2"><span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />Criando e enviando...</span>
        ) : (
          <span className="flex items-center gap-2"><Send className="h-4 w-4" />Criar Envelope e Enviar</span>
        )}
      </Button>
    </div>
  );
}
