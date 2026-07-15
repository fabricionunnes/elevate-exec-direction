import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, Paperclip, FileText, AlertTriangle } from "lucide-react";
import type { Envelope, Signer } from "@/types/signatures";

interface Attachment { id: string; filename: string; size_bytes: number | null; sort_order: number; }
interface EditSigner { id?: string; name: string; email: string; }

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  envelope: Envelope;
  signers: Signer[];
  onSaved: () => void;
}

export function EnvelopeEditDialog({ open, onOpenChange, envelope, signers, onSaved }: Props) {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [editSigners, setEditSigners] = useState<EditSigner[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [removedAttIds, setRemovedAttIds] = useState<string[]>([]);
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const someViewed = signers.some((s) => s.status === "viewed");

  useEffect(() => {
    if (!open) return;
    setTitle(envelope.title || "");
    setMessage(envelope.message || "");
    setEditSigners(signers.map((s) => ({ id: s.id, name: s.name, email: s.email })));
    setRemovedAttIds([]);
    setNewFiles([]);
    (async () => {
      const { data } = await supabase
        .from("envelope_attachments")
        .select("id, filename, size_bytes, sort_order")
        .eq("envelope_id", envelope.id)
        .order("sort_order");
      setAttachments((data as Attachment[]) ?? []);
    })();
  }, [open, envelope, signers]);

  const addFiles = (files: FileList | null) => {
    if (!files) return;
    const pdfs = Array.from(files).filter((f) => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf"));
    if (pdfs.length !== files.length) toast.error("Só PDFs podem ser anexados");
    if (pdfs.some((f) => f.size > 20 * 1024 * 1024)) { toast.error("Anexo acima de 20MB"); return; }
    setNewFiles((prev) => [...prev, ...pdfs]);
  };

  const save = async () => {
    if (!title.trim()) { toast.error("Título é obrigatório"); return; }
    const valid = editSigners.filter((s) => s.name.trim() && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s.email.trim()));
    if (valid.length === 0) { toast.error("Informe ao menos um signatário válido"); return; }

    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error("Sessão expirada"); return; }

      const fd = new FormData();
      fd.append("envelope_id", envelope.id);
      fd.append("title", title.trim());
      fd.append("message", message);
      fd.append("signers", JSON.stringify(valid.map((s, i) => ({ id: s.id, name: s.name.trim(), email: s.email.trim(), order_index: i }))));
      if (removedAttIds.length) fd.append("removed_attachment_ids", JSON.stringify(removedAttIds));
      newFiles.forEach((f) => fd.append("attachments", f));

      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/edit-envelope`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: fd,
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error ?? "Erro ao salvar");

      toast.success("Envelope atualizado" + (newFiles.length || removedAttIds.length ? " — documento remontado com os anexos" : ""));
      onSaved();
      onOpenChange(false);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar envelope</DialogTitle>
          <DialogDescription>Edite os dados, os signatários e anexe arquivos para assinar junto.</DialogDescription>
        </DialogHeader>

        {someViewed && (
          <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-2.5 text-xs text-amber-800 dark:text-amber-300">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            Algum signatário já abriu o documento. Ao anexar/alterar, o documento é remontado e ele verá a versão nova ao abrir o link novamente.
          </div>
        )}

        <div className="space-y-4">
          <div className="grid gap-2">
            <Label>Título</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>Mensagem (opcional)</Label>
            <Textarea rows={2} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Mensagem que vai no e-mail de assinatura" />
          </div>

          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label>Signatários</Label>
              <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={() => setEditSigners((p) => [...p, { name: "", email: "" }])}>
                <Plus className="h-3.5 w-3.5" /> Adicionar
              </Button>
            </div>
            {editSigners.map((s, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input className="flex-1" placeholder="Nome" value={s.name}
                  onChange={(e) => setEditSigners((p) => p.map((x, xi) => xi === i ? { ...x, name: e.target.value } : x))} />
                <Input className="flex-1" placeholder="E-mail" value={s.email}
                  onChange={(e) => setEditSigners((p) => p.map((x, xi) => xi === i ? { ...x, email: e.target.value } : x))} />
                <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0"
                  onClick={() => setEditSigners((p) => p.filter((_, xi) => xi !== i))}>
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </div>
            ))}
          </div>

          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-1.5"><Paperclip className="h-3.5 w-3.5" /> Anexos (assinados junto)</Label>
              <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => fileRef.current?.click()}>
                <Plus className="h-3.5 w-3.5" /> Anexar PDF
              </Button>
              <input ref={fileRef} type="file" accept="application/pdf,.pdf" multiple className="hidden"
                onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
            </div>
            {attachments.filter((a) => !removedAttIds.includes(a.id)).map((a) => (
              <div key={a.id} className="flex items-center justify-between rounded border px-2.5 py-1.5 text-xs">
                <span className="flex items-center gap-1.5 min-w-0"><FileText className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{a.filename}</span></span>
                <button className="text-destructive ml-2" onClick={() => setRemovedAttIds((p) => [...p, a.id])}>remover</button>
              </div>
            ))}
            {newFiles.map((f, i) => (
              <div key={`new-${i}`} className="flex items-center justify-between rounded border border-dashed px-2.5 py-1.5 text-xs">
                <span className="flex items-center gap-1.5 min-w-0"><FileText className="h-3.5 w-3.5 shrink-0 text-primary" /><span className="truncate">{f.name}</span><span className="text-muted-foreground">(novo)</span></span>
                <button className="text-destructive ml-2" onClick={() => setNewFiles((p) => p.filter((_, xi) => xi !== i))}>remover</button>
              </div>
            ))}
            {attachments.filter((a) => !removedAttIds.includes(a.id)).length === 0 && newFiles.length === 0 && (
              <p className="text-[11px] text-muted-foreground">Nenhum anexo. O anexo vira páginas extras do mesmo documento e é assinado junto.</p>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Salvar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
