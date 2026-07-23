import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { UsersRound, Loader2, Link2, Send, Copy, CheckCircle2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

const DEFAULT_MSG = "Fala, {nome}. Aqui é o Fabrício.\n\nTô te chamando pro grupo do UNV Mastermind — nosso círculo de empresários. Entra por aqui:\n\n{link}";

type Group = { jid: string; name: string };
type Preview = { link: string; total: number; sample: { name: string; company: string }[]; example_message: string };
type Result = { link: string; total: number; sent: number; failed: number; errors: { company: string; error: string }[] };

export function MastermindGroupInviteDialog() {
  const [open, setOpen] = useState(false);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [groups, setGroups] = useState<Group[]>([]);
  const [groupJid, setGroupJid] = useState("");
  const [message, setMessage] = useState(DEFAULT_MSG);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [working, setWorking] = useState(false);

  const call = async (action: string, extra: Record<string, unknown> = {}) => {
    const { data, error } = await supabase.functions.invoke("mastermind-group-invite", {
      body: { action, instance_name: "fabricionunnes", ...extra },
    });
    if (error) throw new Error(error.message);
    if (!data?.ok) throw new Error(data?.error || "Falha na operação");
    return data;
  };

  const loadGroups = async () => {
    setLoadingGroups(true);
    try {
      const d = await call("list_groups");
      setGroups(d.groups || []);
      const mm = (d.groups || []).find((g: Group) => /master\s?mind/i.test(g.name));
      if (mm) setGroupJid(mm.jid);
    } catch (e: any) { toast.error(e.message); }
    finally { setLoadingGroups(false); }
  };

  const onOpenChange = (o: boolean) => {
    setOpen(o);
    if (o && groups.length === 0) loadGroups();
    if (!o) { setPreview(null); setResult(null); }
  };

  const doPreview = async () => {
    if (!groupJid) { toast.error("Escolha o grupo"); return; }
    setWorking(true); setResult(null);
    try {
      const d = await call("preview", { group_jid: groupJid, message_template: message });
      setPreview(d as Preview);
    } catch (e: any) { toast.error(e.message); }
    finally { setWorking(false); }
  };

  const doSend = async () => {
    if (!groupJid) return;
    if (!confirm(`Enviar o convite do grupo para ${preview?.total ?? "todos os"} clientes ativos? Cada um recebe uma mensagem no WhatsApp.`)) return;
    setWorking(true);
    try {
      const d = await call("send", { group_jid: groupJid, message_template: message });
      setResult(d as Result);
      toast.success(`Convite enviado para ${d.sent} de ${d.total} clientes`);
    } catch (e: any) { toast.error(e.message); }
    finally { setWorking(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button className="gap-2 bg-amber-600 hover:bg-amber-700 text-white">
          <UsersRound className="h-4 w-4" /> Convidar clientes pro grupo
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><UsersRound className="h-5 w-5 text-amber-500" /> Convite do grupo Mastermind</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="text-xs">Grupo (do WhatsApp do Fabrício)</Label>
            <Select value={groupJid} onValueChange={(v) => { setGroupJid(v); setPreview(null); setResult(null); }} disabled={loadingGroups}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder={loadingGroups ? "Carregando grupos..." : "Escolha o grupo"} />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {groups.map((g) => <SelectItem key={g.jid} value={g.jid}>{g.name}</SelectItem>)}
              </SelectContent>
            </Select>
            {loadingGroups && <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> lendo os grupos...</p>}
          </div>

          <div>
            <Label className="text-xs">Mensagem — use {"{nome}"} e {"{link}"}</Label>
            <Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={5} className="mt-1 text-sm" />
          </div>

          {preview && !result && (
            <div className="rounded-lg border bg-muted/40 p-3 space-y-2 text-sm">
              <div className="flex items-center gap-2 text-emerald-600 font-medium"><Link2 className="h-4 w-4" /> Link gerado</div>
              <div className="flex items-center gap-2">
                <code className="text-xs bg-background rounded px-2 py-1 truncate flex-1">{preview.link}</code>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { navigator.clipboard.writeText(preview.link); toast.success("Link copiado"); }}><Copy className="h-3.5 w-3.5" /></Button>
              </div>
              <p><Badge variant="secondary">{preview.total} clientes ativos com WhatsApp</Badge></p>
              <div className="text-xs text-muted-foreground whitespace-pre-wrap border-l-2 border-amber-400 pl-2 mt-1">{preview.example_message}</div>
            </div>
          )}

          {result && (
            <div className="rounded-lg border bg-muted/40 p-3 space-y-2 text-sm">
              <div className="flex items-center gap-2 text-emerald-600 font-medium"><CheckCircle2 className="h-4 w-4" /> Enviado</div>
              <div className="flex gap-4">
                <span>Enviados: <b className="text-emerald-600">{result.sent}</b></span>
                <span>Falhas: <b className={result.failed ? "text-rose-500" : ""}>{result.failed}</b></span>
                <span>Total: <b>{result.total}</b></span>
              </div>
              {result.failed > 0 && (
                <div className="text-[11px] text-muted-foreground">
                  <div className="flex items-center gap-1 text-amber-600"><AlertTriangle className="h-3 w-3" /> Algumas falharam:</div>
                  {result.errors.map((e, i) => <div key={i}>{e.company}: {e.error}</div>)}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={doPreview} disabled={working || !groupJid}>
            {working && !result ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />} Ver prévia
          </Button>
          <Button onClick={doSend} disabled={working || !groupJid} className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white">
            {working ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Enviar pros clientes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
