// Chaves de API do CRM (Configurações > API e Webhooks), 01/10/2026.
// Uma chave por integração: o valor aparece UMA vez na criação (no banco fica só o
// sha256 e os 8 primeiros caracteres), dá pra ver quando foi usada pela última vez e
// revogar sem derrubar as outras. Criar e revogar passam por RPC (crm_api_key_create,
// crm_api_key_revoke); a leitura é liberada por RLS só pra master/admin da UNV.
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { SearchableSelect } from "@/components/crm/traffic/SearchableSelect";
import { toast } from "sonner";
import { AlertTriangle, BookOpen, Check, Copy, KeyRound, Loader2, Plus } from "lucide-react";

interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  scopes: string[];
  pipeline_id: string | null;
  created_by: string | null;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
}

const ESCOPOS = [
  { value: "leads:create", label: "Criar leads", hint: "POST receive-external-lead" },
  { value: "leads:status", label: "Marcar ganho ou perda", hint: "POST update-lead-status" },
];
const SEM_FUNIL = "nenhum";
const dataHora = (iso: string) => format(new Date(iso), "dd/MM/yyyy HH:mm", { locale: ptBR });

export function CRMApiKeysCard({ pipelines, showDocsLink }: { pipelines: { id: string; name: string }[]; showDocsLink: boolean }) {
  const [chaves, setChaves] = useState<ApiKey[]>([]);
  const [autores, setAutores] = useState<Record<string, string>>({});
  const [carregando, setCarregando] = useState(true);
  const [ocupado, setOcupado] = useState(false);
  const [novaAberta, setNovaAberta] = useState(false);
  const [form, setForm] = useState({ name: "", scopes: ["leads:create", "leads:status"], pipeline: SEM_FUNIL });
  const [criada, setCriada] = useState<{ name: string; key: string } | null>(null);
  const [copiou, setCopiou] = useState(false);
  const [revogar, setRevogar] = useState<ApiKey | null>(null);

  const carregar = useCallback(async () => {
    const { data, error } = await (supabase as any)
      .from("crm_api_keys")
      .select("id, name, key_prefix, scopes, pipeline_id, created_by, created_at, last_used_at, revoked_at")
      .order("created_at", { ascending: false });
    if (error) toast.error(`Não consegui carregar as chaves: ${error.message}`);
    const linhas = (data as ApiKey[]) || [];
    setChaves(linhas);
    setCarregando(false);
    const ids = [...new Set(linhas.map((c) => c.created_by).filter(Boolean))] as string[];
    if (ids.length) {
      const { data: staff } = await supabase.from("onboarding_staff").select("id, name").in("id", ids);
      setAutores(Object.fromEntries((staff || []).map((s: any) => [s.id, s.name])));
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const abrirNova = () => {
    setForm({ name: "", scopes: ["leads:create", "leads:status"], pipeline: SEM_FUNIL });
    setNovaAberta(true);
  };

  const criar = async () => {
    if (!form.name.trim()) { toast.error("Dê um nome pra chave (quem vai usar)"); return; }
    if (!form.scopes.length) { toast.error("Escolha pelo menos uma permissão"); return; }
    setOcupado(true);
    const { data, error } = await (supabase as any).rpc("crm_api_key_create", {
      p_name: form.name.trim(),
      p_scopes: form.scopes,
      p_pipeline_id: form.pipeline === SEM_FUNIL ? null : form.pipeline,
    });
    setOcupado(false);
    if (error || !data?.key) { toast.error(`Erro ao gerar a chave: ${error?.message || "resposta vazia"}`); return; }
    setNovaAberta(false);
    setCopiou(false);
    setCriada({ name: data.name, key: data.key });
    carregar();
  };

  const copiar = async () => {
    if (!criada) return;
    try {
      await navigator.clipboard.writeText(criada.key);
      setCopiou(true);
      toast.success("Chave copiada");
    } catch {
      toast.error("Não consegui copiar. Selecione o texto e copie na mão.");
    }
  };

  const confirmarRevogacao = async () => {
    if (!revogar) return;
    setOcupado(true);
    const { error } = await (supabase as any).rpc("crm_api_key_revoke", { p_id: revogar.id });
    setOcupado(false);
    if (error) { toast.error(`Erro ao revogar: ${error.message}`); return; }
    toast.success("Chave revogada");
    setRevogar(null);
    carregar();
  };

  const alternarEscopo = (escopo: string, marcado: boolean) =>
    setForm((f) => ({ ...f, scopes: marcado ? [...new Set([...f.scopes, escopo])] : f.scopes.filter((s) => s !== escopo) }));

  const nomeFunil = (id: string | null) => (id ? pipelines.find((p) => p.id === id)?.name || "funil removido" : null);

  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-start justify-between gap-3 space-y-0">
        <div className="space-y-1.5">
          <CardTitle className="text-base flex items-center gap-2"><KeyRound className="h-4 w-4" />Chaves de API</CardTitle>
          <CardDescription>
            Uma chave por integração (landing page, ERP, automação). Vai no header x-api-key das chamadas.
            A chave fixa antiga continua funcionando.
          </CardDescription>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {showDocsLink && (
            <Button size="sm" variant="outline" asChild>
              <Link to="/crm/api"><BookOpen className="h-4 w-4 mr-1" />Documentação</Link>
            </Button>
          )}
          <Button size="sm" onClick={abrirNova}><Plus className="h-4 w-4 mr-1" />Nova chave</Button>
        </div>
      </CardHeader>
      <CardContent>
        {carregando ? (
          <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
        ) : chaves.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">Nenhuma chave gerada ainda.</p>
        ) : (
          <div className="divide-y divide-border rounded-md border">
            {chaves.map((c) => (
              <div key={c.id} className="flex flex-col sm:flex-row sm:items-center gap-2 px-3 py-2.5">
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-sm font-medium ${c.revoked_at ? "text-muted-foreground line-through" : ""}`}>{c.name}</span>
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">{c.key_prefix}…</code>
                    {c.revoked_at
                      ? <Badge variant="outline" className="text-[10px]">revogada em {dataHora(c.revoked_at)}</Badge>
                      : <Badge variant="secondary" className="text-[10px]">ativa</Badge>}
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap text-xs text-muted-foreground">
                    {c.scopes.map((s) => (
                      <Badge key={s} variant="outline" className="text-[10px] font-normal">{ESCOPOS.find((e) => e.value === s)?.label || s}</Badge>
                    ))}
                    {nomeFunil(c.pipeline_id) && <span>Funil padrão: {nomeFunil(c.pipeline_id)}</span>}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Criada em {dataHora(c.created_at)}{c.created_by && autores[c.created_by] ? ` por ${autores[c.created_by]}` : ""}
                    {" · "}
                    {c.last_used_at ? `último uso em ${dataHora(c.last_used_at)}` : "nunca usada"}
                  </p>
                </div>
                {!c.revoked_at && (
                  <Button size="sm" variant="outline" className="text-destructive hover:text-destructive shrink-0" onClick={() => setRevogar(c)}>
                    Revogar
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {/* Nova chave */}
      <Dialog open={novaAberta} onOpenChange={setNovaAberta}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova chave de API</DialogTitle>
            <DialogDescription>O valor da chave aparece uma única vez, logo depois de gerar.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome (quem vai usar)</Label>
              <Input className="mt-1" autoFocus placeholder="Ex.: Landing page Imersão, ERP do cliente X" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Permissões</Label>
              {ESCOPOS.map((e) => (
                <label key={e.value} className="flex items-start gap-2 cursor-pointer">
                  <Checkbox className="mt-0.5" checked={form.scopes.includes(e.value)} onCheckedChange={(v) => alternarEscopo(e.value, v === true)} />
                  <span className="text-sm">
                    {e.label}
                    <span className="block text-xs text-muted-foreground font-mono">{e.hint}</span>
                  </span>
                </label>
              ))}
            </div>
            <div>
              <Label>Funil padrão (opcional)</Label>
              <SearchableSelect
                className="mt-1"
                value={form.pipeline}
                onChange={(v) => setForm({ ...form, pipeline: v })}
                options={[{ value: SEM_FUNIL, label: "Nenhum (usa o funil enviado na chamada)" }, ...pipelines.map((p) => ({ value: p.id, label: p.name }))]}
              />
              <p className="text-xs text-muted-foreground mt-1">Quando a chamada não informa pipeline_id nem pipeline_name, o lead entra neste funil.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNovaAberta(false)}>Cancelar</Button>
            <Button onClick={criar} disabled={ocupado}>
              {ocupado && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Gerar chave
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Valor da chave, uma única vez */}
      <Dialog open={!!criada} onOpenChange={(o) => { if (!o) setCriada(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Chave gerada: {criada?.name}</DialogTitle>
            <DialogDescription>Copie agora e guarde num lugar seguro.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs bg-muted px-3 py-2.5 rounded font-mono break-all select-all">{criada?.key}</code>
              <Button size="icon" variant="outline" onClick={copiar} title="Copiar">
                {copiou ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <div className="flex items-start gap-2 p-3 rounded-lg bg-muted border border-border">
              <AlertTriangle className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground">
                Depois de fechar esta janela não dá pra ver a chave de novo: o sistema guarda só o começo dela pra identificação.
                Se perder, revogue e gere outra.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setCriada(null)}>{copiou ? "Fechar" : "Já copiei, fechar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revogar */}
      <AlertDialog open={!!revogar} onOpenChange={(o) => { if (!o) setRevogar(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revogar a chave "{revogar?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Quem usa esta chave passa a receber erro 401 na hora. Não dá pra desfazer: pra voltar, gere uma chave nova.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmarRevogacao} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Revogar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
