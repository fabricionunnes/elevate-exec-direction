// Comunicado da UNV (só master/admin): vira notificação no sino e push pra clientes, uma empresa ou a equipe.
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Loader2, Megaphone } from "lucide-react";
import { toast } from "sonner";

export function SendAnnouncementDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [audience, setAudience] = useState<"clients" | "company" | "staff" | "all">("clients");
  const [companyId, setCompanyId] = useState("");
  const [url, setUrl] = useState("");
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle(""); setMessage(""); setAudience("clients"); setCompanyId(""); setUrl("");
    (async () => {
      const { data } = await supabase.from("onboarding_companies").select("id, name").order("name");
      setCompanies((data || []) as any);
    })();
  }, [open]);

  const enviar = async () => {
    if (!title.trim() || !message.trim()) { toast.error("Escreva o título e a mensagem"); return; }
    if (audience === "company" && !companyId) { toast.error("Escolha a empresa"); return; }
    const alvo = audience === "clients" ? "TODOS os clientes" : audience === "company" ? `os usuários de ${companies.find((c) => c.id === companyId)?.name}` : audience === "staff" ? "toda a equipe" : "TODOS os clientes e toda a equipe";
    if (!confirm(`Enviar este comunicado para ${alvo}? Não dá pra desfazer depois de enviado.`)) return;
    setSending(true);
    const { data, error } = await (supabase as any).rpc("send_announcement", { p_title: title, p_message: message, p_audience: audience, p_company: audience === "company" ? companyId : null, p_action_url: url || null });
    setSending(false);
    if (error) { toast.error("Não consegui enviar: " + error.message); return; }
    toast.success(`Comunicado enviado para ${(data as any)?.enviadas ?? 0} pessoa(s).`);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Megaphone className="h-5 w-5 text-primary" />Enviar comunicado</DialogTitle>
          <DialogDescription>Aparece no sino de quem receber e chega como push pra quem ativou. Comunicado não pode ser desligado nas preferências.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5"><Label>Para quem</Label>
            <Select value={audience} onValueChange={(v) => setAudience(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="clients">Todos os clientes</SelectItem>
                <SelectItem value="company">Uma empresa</SelectItem>
                <SelectItem value="staff">Toda a equipe</SelectItem>
                <SelectItem value="all">Clientes e equipe</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {audience === "company" && (
            <div className="space-y-1.5"><Label>Empresa</Label>
              <SearchableSelect value={companyId} onValueChange={setCompanyId} options={companies.map((c) => ({ value: c.id, label: c.name }))} placeholder="Digite o nome da empresa" emptyMessage="Nenhuma empresa encontrada." />
            </div>
          )}
          <div className="space-y-1.5"><Label>Título</Label><Input value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Aula ao vivo hoje às 19h" /></div>
          <div className="space-y-1.5"><Label>Mensagem</Label><Textarea rows={4} value={message} maxLength={800} onChange={(e) => setMessage(e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Link ao clicar (opcional)</Label><Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>Cancelar</Button>
          <Button onClick={enviar} disabled={sending}>{sending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Enviar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
