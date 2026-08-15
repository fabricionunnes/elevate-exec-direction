// Aba Mastermind nos detalhes da empresa: contatos reconhecidos no grupo
// Mastermind UNV + tudo que a empresa contribuiu ou recebeu nas trocas do grupo
// (classificado pelo mastermind-harvest, 2x/dia).
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Loader2, Plus, Trash2, Users, ArrowUpRight, ArrowDownLeft, Crown, RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Member {
  id: string; name: string; phone: string | null; status: string; created_at: string;
}
interface Contribution {
  id: string; direction: "given" | "received"; kind: string | null; summary: string;
  message_at: string | null; member_id: string;
  member?: { name: string } | null;
  counterpart_company?: { name: string } | null;
}

const KIND_LABEL: Record<string, string> = {
  resposta_duvida: "Resposta a dúvida", indicacao: "Indicação", material: "Material",
  aprendizado: "Aprendizado", oferta_ajuda: "Oferta de ajuda", outro: "Outro",
};

export function MastermindPanel({ companyId, canEdit }: { companyId: string; canEdit: boolean }) {
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<Member[]>([]);
  const [contribs, setContribs] = useState<Contribution[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [mRes, cRes] = await Promise.all([
      (supabase as any).from("mastermind_members")
        .select("id, name, phone, status, created_at")
        .eq("company_id", companyId).neq("status", "removed").order("created_at"),
      (supabase as any).from("mastermind_contributions")
        .select("id, direction, kind, summary, message_at, member_id, member:mastermind_members!mastermind_contributions_member_id_fkey(name), counterpart_company:onboarding_companies!mastermind_contributions_counterpart_company_id_fkey(name)")
        .eq("company_id", companyId).order("message_at", { ascending: false }).limit(200),
    ]);
    setMembers((mRes.data as Member[]) || []);
    setContribs((cRes.data as Contribution[]) || []);
    setLoading(false);
  }, [companyId]);
  useEffect(() => { load(); }, [load]);

  const addMember = async () => {
    if (!newName.trim()) { toast.error("Informe o nome"); return; }
    setSaving(true);
    try {
      const { error } = await (supabase as any).from("mastermind_members").insert({
        company_id: companyId, name: newName.trim(),
        phone: newPhone.replace(/\D/g, "") || null,
        status: "active", source: "manual",
      });
      if (error) throw error;
      toast.success("Contato adicionado — passa a ser reconhecido no grupo");
      setAddOpen(false); setNewName(""); setNewPhone("");
      load();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao adicionar");
    } finally {
      setSaving(false);
    }
  };

  const removeMember = async (m: Member) => {
    const { error } = await (supabase as any).from("mastermind_members")
      .update({ status: "removed", removed_at: new Date().toISOString() }).eq("id", m.id);
    if (error) { toast.error("Sem permissão para remover"); return; }
    toast.success(`${m.name} removido do reconhecimento`);
    load();
  };

  const given = contribs.filter((c) => c.direction === "given");
  const received = contribs.filter((c) => c.direction === "received");

  if (loading) {
    return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-4">
      {/* saldo de trocas */}
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="pt-5 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
              <ArrowUpRight className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold leading-none">{given.length}</p>
              <p className="text-xs text-muted-foreground mt-1">contribuições dadas ao grupo</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-blue-500/10 flex items-center justify-center">
              <ArrowDownLeft className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold leading-none">{received.length}</p>
              <p className="text-xs text-muted-foreground mt-1">contribuições recebidas do grupo</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* contatos reconhecidos */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" /> Contatos reconhecidos no grupo
            </CardTitle>
            {canEdit && (
              <Button size="sm" className="gap-1.5" onClick={() => setAddOpen(true)}>
                <Plus className="h-3.5 w-3.5" /> Adicionar
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            As mensagens dessas pessoas no grupo Mastermind UNV contam para esta empresa.
          </p>
        </CardHeader>
        <CardContent className="space-y-2">
          {members.length === 0 ? (
            <p className="text-sm text-muted-foreground py-3 text-center">
              Nenhum contato cadastrado — adicione pra empresa ser reconhecida no grupo.
            </p>
          ) : members.map((m) => (
            <div key={m.id} className="flex items-center justify-between border rounded-md px-3 py-2">
              <div>
                <p className="text-sm font-medium">{m.name}</p>
                <p className="text-xs text-muted-foreground">{m.phone || "sem telefone — reconhecido pelo nome"}</p>
              </div>
              {canEdit && (
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeMember(m)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* linha do tempo das trocas */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Crown className="h-4 w-4 text-amber-500" /> Trocas no grupo
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {contribs.length === 0 ? (
            <p className="text-sm text-muted-foreground py-3 text-center">
              Nada registrado ainda. O robô lê o grupo 2x por dia e registra aqui o que a empresa
              contribuiu ou recebeu.
            </p>
          ) : contribs.map((c) => (
            <div key={c.id} className="flex items-start gap-3 border rounded-md px-3 py-2.5">
              {c.direction === "given"
                ? <ArrowUpRight className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
                : <ArrowDownLeft className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />}
              <div className="min-w-0 flex-1">
                <p className="text-sm">{c.summary}</p>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  <Badge variant="outline" className="text-[10px]">
                    {KIND_LABEL[c.kind || "outro"] || c.kind}
                  </Badge>
                  {c.member?.name && <span className="text-xs text-muted-foreground">{c.member.name}</span>}
                  {c.counterpart_company?.name && (
                    <span className="text-xs text-muted-foreground">
                      {c.direction === "given" ? "para" : "de"} {c.counterpart_company.name}
                    </span>
                  )}
                  {c.message_at && (
                    <span className="text-xs text-muted-foreground ml-auto">
                      {format(new Date(c.message_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* adicionar contato */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Adicionar contato do Mastermind</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Nome (como aparece no WhatsApp)" value={newName} onChange={(e) => setNewName(e.target.value)} />
            <Input placeholder="Telefone com DDD (opcional, melhora o reconhecimento)" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancelar</Button>
            <Button onClick={addMember} disabled={saving} className="gap-1.5">
              {saving && <RefreshCw className="h-3.5 w-3.5 animate-spin" />} Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
