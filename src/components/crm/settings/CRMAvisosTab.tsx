// Central de Avisos (03/11/2026, Fabrício: "recebo várias notificações durante o dia, quero melhorar isso").
// Cada tipo de aviso que vai pro WhatsApp dele tem um nível: na hora, no resumo (8h10 e 20h40) ou desligado.
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { BellRing, Loader2, Send } from "lucide-react";
import { useStaffPermissions } from "@/hooks/useStaffPermissions";

type Nivel = "hora" | "resumo" | "off";
type Cfg = { tipo: string; titulo: string; origem: string; nivel: Nivel; updated_at: string };
type Settings = { telefone: string; instancia: string; ativo: boolean };
const NIVEIS: { v: Nivel; label: string; desc: string }[] = [
  { v: "hora", label: "Na hora", desc: "chega assim que acontece" },
  { v: "resumo", label: "No resumo", desc: "junta no resumo das 8h10 e das 20h40" },
  { v: "off", label: "Desligado", desc: "não chega" },
];

export function CRMAvisosTab() {
  const { isMaster } = useStaffPermissions();
  const [cfgs, setCfgs] = useState<Cfg[]>([]);
  const [st, setSt] = useState<Settings | null>(null);
  const [pend, setPend] = useState<Record<string, number>>({});
  const [carregando, setCarregando] = useState(true);
  const [testando, setTestando] = useState(false);

  const carregar = useCallback(async () => {
    const [{ data: c }, { data: s }, { data: f }] = await Promise.all([
      (supabase as any).from("avisos_config").select("*").order("origem").order("titulo"),
      (supabase as any).from("avisos_settings").select("telefone, instancia, ativo").eq("id", true).maybeSingle(),
      (supabase as any).from("avisos_fila").select("tipo").is("enviado_em", null),
    ]);
    setCfgs((c as Cfg[]) || []);
    setSt((s as Settings) || null);
    const m: Record<string, number> = {};
    ((f as { tipo: string }[]) || []).forEach((r) => { m[r.tipo] = (m[r.tipo] || 0) + 1; });
    setPend(m);
    setCarregando(false);
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  const mudarNivel = async (tipo: string, nivel: Nivel) => {
    const antes = cfgs;
    setCfgs((p) => p.map((c) => (c.tipo === tipo ? { ...c, nivel } : c)));
    const { error } = await (supabase as any).from("avisos_config").update({ nivel, updated_at: new Date().toISOString() }).eq("tipo", tipo);
    if (error) { setCfgs(antes); toast.error("Sem permissão para alterar"); }
  };
  const salvarSettings = async (patch: Partial<Settings>) => {
    const novo = { ...(st || { telefone: "", instancia: "fabricionunnes", ativo: true }), ...patch };
    setSt(novo);
    const { error } = await (supabase as any).from("avisos_settings").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", true);
    if (error) toast.error("Sem permissão para alterar");
  };
  const testar = async () => {
    setTestando(true);
    const { data, error } = await supabase.functions.invoke("avisos", { body: { action: "testar" } });
    setTestando(false);
    if (error || !data?.ok) toast.error(data?.erro || error?.message || "Falhou o envio de teste");
    else toast.success("Mensagem de teste enviada");
  };

  if (carregando) return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;

  const grupos = [
    { k: "nexus", label: "Nexus" },
    { k: "marcelo", label: "Agente Marcelo" },
  ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2"><BellRing className="h-4 w-4 text-primary" /> Central de Avisos (WhatsApp do Fabrício)</CardTitle>
        <CardDescription>
          Tudo que o sistema manda pro WhatsApp passa por aqui. "Na hora" chega imediatamente; "No resumo" junta num texto só às 8h10 e às 20h40; "Desligado" não chega.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
          <div>
            <Label className="text-xs">Telefone que recebe</Label>
            <Input value={st?.telefone || ""} disabled={!isMaster} onChange={(e) => setSt((p) => ({ ...(p || { instancia: "fabricionunnes", ativo: true, telefone: "" }), telefone: e.target.value }))} onBlur={(e) => isMaster && salvarSettings({ telefone: e.target.value.replace(/\D/g, "") })} />
          </div>
          <div>
            <Label className="text-xs">Instância que envia</Label>
            <Input value={st?.instancia || ""} disabled={!isMaster} onChange={(e) => setSt((p) => ({ ...(p || { telefone: "", ativo: true, instancia: "" }), instancia: e.target.value }))} onBlur={(e) => isMaster && salvarSettings({ instancia: e.target.value.trim() })} />
          </div>
          <div className="flex items-center gap-3 h-10">
            <Switch checked={st?.ativo !== false} disabled={!isMaster} onCheckedChange={(v) => salvarSettings({ ativo: v })} />
            <span className="text-sm">{st?.ativo !== false ? "Avisos ligados" : "Tudo desligado"}</span>
            <Button variant="outline" size="sm" onClick={testar} disabled={testando || !isMaster} className="ml-auto gap-1">
              {testando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} Testar envio
            </Button>
          </div>
        </div>

        {grupos.map((g) => {
          const lista = cfgs.filter((c) => c.origem === g.k);
          if (!lista.length) return null;
          return (
            <div key={g.k} className="space-y-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{g.label}</p>
              <div className="divide-y rounded-md border">
                {lista.map((c) => (
                  <div key={c.tipo} className="flex items-center gap-3 px-3 py-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{c.titulo}</p>
                      <p className="text-[11px] text-muted-foreground">{c.tipo}{pend[c.tipo] ? ` · ${pend[c.tipo]} no próximo resumo` : ""}</p>
                    </div>
                    <Badge variant={c.nivel === "hora" ? "default" : c.nivel === "off" ? "outline" : "secondary"} className="text-[10px] hidden sm:inline-flex">
                      {NIVEIS.find((n) => n.v === c.nivel)?.label}
                    </Badge>
                    <Select value={c.nivel} onValueChange={(v) => mudarNivel(c.tipo, v as Nivel)} disabled={!isMaster}>
                      <SelectTrigger className="w-36 h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {NIVEIS.map((n) => <SelectItem key={n.v} value={n.v}>{n.label} <span className="text-muted-foreground">· {n.desc}</span></SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
        {cfgs.filter((c) => !grupos.some((g) => g.k === c.origem)).length > 0 && (
          <p className="text-xs text-muted-foreground">Outros tipos aparecem aqui automaticamente na primeira vez que disparam.</p>
        )}
      </CardContent>
    </Card>
  );
}
