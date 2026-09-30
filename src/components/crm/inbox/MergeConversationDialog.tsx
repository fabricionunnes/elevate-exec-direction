// Mesclar conversas duplicadas (30/09/2026). Caso Be Gym: o mesmo número em dois canais
// (Evolution e API oficial) virou duas conversas. Aqui o atendente escolhe a outra
// conversa (sugestões pelo telefone, ou busca por nome/telefone), vê as duas lado a lado,
// decide qual fica como principal e confirma. O banco faz o resto (crm_merge_conversations):
// mensagens, agente e agendadas vão pra principal; a secundária some da lista.
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Search, Merge, ArrowLeftRight, Check } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ConvRow {
  id: string;
  instance_id: string | null;
  official_instance_id: string | null;
  status: string;
  lead_id: string | null;
  last_message: string | null;
  last_message_at: string | null;
  created_at: string;
  unread_count: number | null;
  contact?: { id: string; phone: string; name: string | null } | null;
  lead?: { name: string; company?: string | null } | null;
  instance?: { instance_name: string; display_name: string | null } | null;
  official_instance?: { display_name: string | null } | null;
  assigned_staff?: { name: string } | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversation: ConvRow;
  onMerged: (primaryId: string, secondaryId: string) => void;
}

const SELECT = "id, instance_id, official_instance_id, status, lead_id, last_message, last_message_at, created_at, unread_count, contact:crm_whatsapp_contacts(id, phone, name), lead:crm_leads(name, company), instance:whatsapp_instances(instance_name, display_name), official_instance:whatsapp_official_instances(display_name), assigned_staff:onboarding_staff(name)";
const digits = (p?: string | null) => String(p || "").replace(/\D/g, "");
const nomeDe = (c?: ConvRow | null) => {
  const n = String(c?.contact?.name || "").trim();
  return /[\p{L}]/u.test(n) ? n : c?.lead?.name || c?.contact?.phone || "Sem nome";
};
const numeroDe = (c?: ConvRow | null) =>
  c?.instance ? c.instance.display_name || c.instance.instance_name : c?.official_instance ? `${c.official_instance.display_name || "API oficial"} (API oficial)` : "sem número";

function Cartao({ c, titulo, principal, onEscolher, contagem }: { c: ConvRow; titulo: string; principal: boolean; onEscolher: () => void; contagem: number | null }) {
  return (
    <button type="button" onClick={onEscolher}
      className={cn("text-left rounded-lg border p-3 space-y-1 transition-colors w-full", principal ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border hover:bg-muted/40")}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] uppercase font-semibold text-muted-foreground">{titulo}</span>
        <span className={cn("text-[10px] rounded-full px-1.5 py-0.5 flex items-center gap-1", principal ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
          {principal && <Check className="h-3 w-3" />}{principal ? "Principal" : "Vai ser absorvida"}
        </span>
      </div>
      <p className="text-sm font-medium truncate">{nomeDe(c)}</p>
      <p className="text-xs text-muted-foreground truncate">{c.contact?.phone} · {numeroDe(c)}</p>
      <p className="text-xs text-muted-foreground truncate">
        {contagem === null ? "..." : `${contagem} mensagens`} · {c.status === "closed" ? "fechada" : "aberta"}
        {c.last_message_at ? ` · última ${format(new Date(c.last_message_at), "dd/MM HH:mm")}` : ""}
      </p>
      <p className="text-xs truncate">{c.lead ? `Negócio: ${c.lead.name}${c.lead.company ? ` (${c.lead.company})` : ""}` : "Sem negócio"}{c.assigned_staff ? ` · ${c.assigned_staff.name.split(" ")[0]}` : ""}</p>
      {c.last_message && <p className="text-[11px] text-muted-foreground truncate italic">"{c.last_message}"</p>}
    </button>
  );
}

export function MergeConversationDialog({ open, onOpenChange, conversation, onMerged }: Props) {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<ConvRow[]>([]);
  const [searching, setSearching] = useState(false);
  const [other, setOther] = useState<ConvRow | null>(null);
  const [primaryId, setPrimaryId] = useState<string>(conversation.id);
  const [force, setForce] = useState(false);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSearch(""); setOther(null); setPrimaryId(conversation.id); setForce(false); setResults([]);
    // Sugestões: outras conversas do mesmo telefone (últimos 8 dígitos), em qualquer número/canal
    (async () => {
      const d = digits(conversation.contact?.phone);
      if (d.length < 8) return;
      setSearching(true);
      const { data: contatos } = await (supabase as any).from("crm_whatsapp_contacts").select("id").ilike("phone", `%${d.slice(-8)}`).limit(30);
      const ids = ((contatos || []) as any[]).map((c) => c.id);
      if (ids.length) {
        const { data } = await (supabase as any).from("crm_whatsapp_conversations").select(SELECT)
          .in("contact_id", ids).neq("id", conversation.id).is("merged_into", null)
          .order("last_message_at", { ascending: false, nullsFirst: false }).limit(20);
        setResults((data || []) as ConvRow[]);
      }
      setSearching(false);
    })();
  }, [open, conversation.id]);

  useEffect(() => {
    if (!open) return;
    const termo = search.trim();
    if (termo.length < 2) return;
    let ativo = true;
    const t = setTimeout(async () => {
      setSearching(true);
      const dq = termo.replace(/\D/g, "");
      const or = dq.length >= 4 ? `name.ilike.%${termo}%,phone.ilike.%${dq}%` : `name.ilike.%${termo}%`;
      const { data: contatos } = await (supabase as any).from("crm_whatsapp_contacts").select("id").or(or).limit(40);
      const ids = ((contatos || []) as any[]).map((c) => c.id);
      let convs: any[] = [];
      if (ids.length) {
        const { data } = await (supabase as any).from("crm_whatsapp_conversations").select(SELECT)
          .in("contact_id", ids).neq("id", conversation.id).is("merged_into", null)
          .order("last_message_at", { ascending: false, nullsFirst: false }).limit(20);
        convs = data || [];
      }
      if (!ativo) return;
      setResults(convs as ConvRow[]);
      setSearching(false);
    }, 350);
    return () => { ativo = false; clearTimeout(t); };
  }, [search, open, conversation.id]);

  // contagem de mensagens das duas (head count, sem baixar as linhas)
  useEffect(() => {
    if (!open) return;
    const ids = [conversation.id, other?.id].filter(Boolean) as string[];
    ids.forEach(async (id) => {
      if (counts[id] !== undefined) return;
      const { count } = await supabase.from("crm_whatsapp_messages").select("id", { count: "exact", head: true }).eq("conversation_id", id);
      setCounts((m) => ({ ...m, [id]: count || 0 }));
    });
  }, [open, conversation.id, other?.id]);

  const telefonesDiferentes = useMemo(() => {
    if (!other) return false;
    const a = digits(conversation.contact?.phone), b = digits(other.contact?.phone);
    return !a || !b || a.slice(-8) !== b.slice(-8);
  }, [other, conversation]);

  const confirmar = async () => {
    if (!other) return;
    const secondaryId = primaryId === conversation.id ? other.id : conversation.id;
    setSaving(true);
    const { data, error } = await (supabase as any).rpc("crm_merge_conversations", { p_primary: primaryId, p_secondary: secondaryId, p_force: force });
    setSaving(false);
    if (error) { toast.error(error.message || "Não consegui mesclar as conversas"); return; }
    const r = (data || {}) as any;
    toast.success(`Conversas mescladas: ${r.messages_moved ?? 0} mensagens passaram pra principal`);
    onMerged(primaryId, secondaryId);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Merge className="h-4 w-4" />Mesclar com outra conversa</DialogTitle>
          <DialogDescription>
            As mensagens, o agente e as mensagens agendadas da conversa absorvida passam pra principal, que herda o negócio, o atendente e o setor se não tiver. A absorvida some da lista.
          </DialogDescription>
        </DialogHeader>

        {!other ? (
          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input autoFocus className="pl-8" placeholder="Buscar por nome ou telefone (sugestões: mesmo número em outro canal)" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <div className="max-h-72 overflow-y-auto rounded-md border">
              {searching ? (
                <div className="flex items-center justify-center py-8 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Buscando...</div>
              ) : results.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">{search.trim().length < 2 ? "Nenhuma outra conversa com este telefone. Busque por nome ou telefone." : "Nenhuma conversa encontrada"}</p>
              ) : (
                results.map((c) => (
                  <button key={c.id} type="button" onClick={() => setOther(c)} className="w-full text-left px-3 py-2 border-b last:border-b-0 hover:bg-muted/50">
                    <p className="text-sm font-medium truncate">{nomeDe(c)} <span className="text-muted-foreground font-normal">· {c.contact?.phone}</span></p>
                    <p className="text-xs text-muted-foreground truncate">{numeroDe(c)} · {c.status === "closed" ? "fechada" : "aberta"}{c.last_message_at ? ` · última ${format(new Date(c.last_message_at), "dd/MM/yyyy HH:mm")}` : ""}{c.lead ? ` · ${c.lead.name}` : ""}</p>
                  </button>
                ))
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground flex items-center gap-1"><ArrowLeftRight className="h-3.5 w-3.5" /> Clique no cartão que deve ficar como principal.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Cartao c={conversation} titulo="Esta conversa" principal={primaryId === conversation.id} onEscolher={() => setPrimaryId(conversation.id)} contagem={counts[conversation.id] ?? null} />
              <Cartao c={other} titulo="Outra conversa" principal={primaryId === other.id} onEscolher={() => setPrimaryId(other.id)} contagem={counts[other.id] ?? null} />
            </div>
            {telefonesDiferentes && (
              <label className="flex items-start gap-2 text-xs rounded-md border border-amber-500/40 bg-amber-500/10 p-2 cursor-pointer">
                <Checkbox checked={force} onCheckedChange={(v) => setForce(v === true)} className="mt-0.5" />
                <span>Os telefones são diferentes ({conversation.contact?.phone || "?"} e {other.contact?.phone || "?"}). Confirmo que é a mesma pessoa e quero mesclar mesmo assim.</span>
              </label>
            )}
            <Button variant="link" size="sm" className="h-6 px-0 text-xs" onClick={() => setOther(null)}>Escolher outra conversa</Button>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={confirmar} disabled={!other || saving || (telefonesDiferentes && !force)}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Merge className="h-4 w-4 mr-2" />}
            Mesclar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
