// Conexões WhatsApp — Operações (somente master/admin).
// Gerencia as instâncias do servidor WhatsApp próprio da UNV: criar conexão,
// parear por QR na própria tela, status ao vivo, reconectar, excluir e
// controlar QUEM pode ver/enviar conversas de cada instância
// (whatsapp_instance_access — o RLS já restringe a escrita a master/admin).
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, Loader2, MessageSquare, Plus, QrCode, RefreshCw, Shield, Trash2, Users, Wifi, WifiOff } from "lucide-react";
import { toast } from "sonner";

interface Instance {
  id: string;
  instance_name: string;
  display_name: string | null;
  phone_number: string | null;
  status: string | null;
  server: "stevo" | "unv";
  is_default: boolean | null;
}
interface StaffRow { id: string; name: string; role: string }
interface AccessRow { staff_id: string; can_view: boolean; can_send: boolean }

async function callApi(action: string, body: Record<string, unknown> = {}) {
  const { data, error } = await supabase.functions.invoke("wa-connections", { body: { action, ...body } });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  return data;
}

export default function WhatsAppConnectionsPage() {
  const navigate = useNavigate();
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [instances, setInstances] = useState<Instance[]>([]);

  // Nova conexão
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDisplay, setNewDisplay] = useState("");
  const [creating, setCreating] = useState(false);

  // QR
  const [qrFor, setQrFor] = useState<string | null>(null);
  const [qrImg, setQrImg] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const qrTimers = useRef<number[]>([]);

  // Acessos
  const [accessFor, setAccessFor] = useState<Instance | null>(null);
  const [staffList, setStaffList] = useState<StaffRow[]>([]);
  const [accessMap, setAccessMap] = useState<Map<string, AccessRow>>(new Map());
  const [savingAccess, setSavingAccess] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      const { data: staff } = await supabase.from("onboarding_staff").select("role").eq("user_id", user.id).maybeSingle();
      setRole(staff?.role || null);
      if (staff?.role === "master" || staff?.role === "admin") await refresh();
      setLoading(false);
    })();
    return () => { qrTimers.current.forEach(clearTimeout); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const data = await callApi("status-all");
      setInstances(data.instances || []);
    } catch (e: unknown) {
      toast.error(`Erro ao carregar: ${(e as Error).message}`);
    } finally {
      setRefreshing(false);
    }
  }, []);

  // ── QR: busca + auto-refresh (QR expira ~40s) + polling de conexão ──
  const stopQrLoops = () => { qrTimers.current.forEach(clearTimeout); qrTimers.current = []; };
  const openQr = async (instanceName: string) => {
    stopQrLoops();
    setQrFor(instanceName);
    setQrImg(null);
    await fetchQr(instanceName);
    pollConnection(instanceName);
  };
  const fetchQr = async (instanceName: string) => {
    setQrLoading(true);
    try {
      const data = await callApi("qr", { instance_name: instanceName });
      if (data.connected) {
        toast.success("Já conectada!");
        closeQr(); await refresh(); return;
      }
      setQrImg(data.base64 || null);
      qrTimers.current.push(window.setTimeout(() => fetchQr(instanceName), 30000));
    } catch (e: unknown) {
      toast.error((e as Error).message);
    } finally {
      setQrLoading(false);
    }
  };
  const pollConnection = (instanceName: string) => {
    qrTimers.current.push(window.setTimeout(async () => {
      try {
        const { state } = await callApi("status", { instance_name: instanceName });
        if (state === "open") {
          toast.success("WhatsApp conectado!");
          closeQr(); await refresh(); return;
        }
      } catch { /* segue tentando */ }
      pollConnection(instanceName);
    }, 3000));
  };
  const closeQr = () => { stopQrLoops(); setQrFor(null); setQrImg(null); };

  const handleCreate = async () => {
    const slug = newName.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    if (slug.length < 3) { toast.error("Nome muito curto"); return; }
    setCreating(true);
    try {
      await callApi("create", { instance_name: slug, display_name: newDisplay.trim() || slug });
      toast.success("Conexão criada. Escaneie o QR pra parear.");
      setShowCreate(false); setNewName(""); setNewDisplay("");
      await refresh();
      openQr(slug);
    } catch (e: unknown) {
      toast.error((e as Error).message);
    } finally {
      setCreating(false);
    }
  };

  const handleRestart = async (inst: Instance) => {
    try {
      await callApi("restart", { instance_name: inst.instance_name });
      toast.success("Reconexão disparada. Atualize o status em ~15s.");
    } catch (e: unknown) { toast.error((e as Error).message); }
  };

  const handleDelete = async (inst: Instance) => {
    try {
      await callApi("delete", { instance_name: inst.instance_name });
      toast.success("Instância excluída");
      await refresh();
    } catch (e: unknown) { toast.error((e as Error).message); }
  };

  // ── Acessos por instância (quem vê / quem envia) ──
  const openAccess = async (inst: Instance) => {
    setAccessFor(inst);
    const [{ data: staff }, { data: access }] = await Promise.all([
      supabase.from("onboarding_staff").select("id, name, role").eq("is_active", true).order("name"),
      supabase.from("whatsapp_instance_access").select("staff_id, can_view, can_send").eq("instance_id", inst.id),
    ]);
    setStaffList((staff || []) as StaffRow[]);
    setAccessMap(new Map(((access || []) as AccessRow[]).map((a) => [a.staff_id, a])));
  };
  const toggleAccess = (staffId: string, field: "can_view" | "can_send", value: boolean) => {
    setAccessMap((prev) => {
      const next = new Map(prev);
      const cur = next.get(staffId) || { staff_id: staffId, can_view: false, can_send: false };
      const updated = { ...cur, [field]: value };
      if (field === "can_send" && value) updated.can_view = true;      // enviar exige ver
      if (field === "can_view" && !value) updated.can_send = false;    // sem ver, não envia
      next.set(staffId, updated);
      return next;
    });
  };
  const saveAccess = async () => {
    if (!accessFor) return;
    setSavingAccess(true);
    try {
      // granted_by tem FK pra onboarding_staff(id) — precisa do id do STAFF,
      // não do usuário de login (era a causa do erro de foreign key ao salvar).
      const { data: { user } } = await supabase.auth.getUser();
      const { data: me } = await supabase
        .from("onboarding_staff").select("id").eq("user_id", user?.id ?? "").maybeSingle();
      const rows = [...accessMap.values()];
      const keep = rows.filter((r) => r.can_view || r.can_send);
      const drop = rows.filter((r) => !r.can_view && !r.can_send).map((r) => r.staff_id);
      if (drop.length) {
        await supabase.from("whatsapp_instance_access").delete().eq("instance_id", accessFor.id).in("staff_id", drop);
      }
      for (const r of keep) {
        const { error } = await supabase.from("whatsapp_instance_access").upsert(
          { instance_id: accessFor.id, staff_id: r.staff_id, can_view: r.can_view, can_send: r.can_send, granted_by: me?.id ?? null },
          { onConflict: "instance_id,staff_id" },
        );
        if (error) throw error;
      }
      toast.success("Acessos atualizados");
      setAccessFor(null);
    } catch (e: unknown) {
      toast.error(`Erro ao salvar: ${(e as Error).message}`);
    } finally {
      setSavingAccess(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }
  if (role !== "master" && role !== "admin") {
    return (
      <div className="max-w-lg mx-auto py-24 text-center space-y-3">
        <Shield className="h-10 w-10 mx-auto text-muted-foreground" />
        <p className="text-lg font-medium">Acesso restrito</p>
        <p className="text-sm text-muted-foreground">Somente administradores e master podem gerenciar as conexões de WhatsApp.</p>
      </div>
    );
  }

  const connected = (s: string | null) => s === "connected" || s === "connecting";

  return (
    <div className="container max-w-5xl mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/onboarding-tasks")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <MessageSquare className="h-6 w-6 text-primary" /> Conexões WhatsApp
            </h1>
            <p className="text-sm text-muted-foreground">Servidor próprio da UNV — conecte números, gere o QR e controle quem vê cada instância.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-2" onClick={refresh} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} /> Atualizar
          </Button>
          <Button size="sm" className="gap-2" onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4" /> Nova conexão
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {instances.map((inst) => (
          <Card key={inst.id} className={connected(inst.status) ? "border-emerald-500/30" : "border-destructive/30"}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  {connected(inst.status)
                    ? <Wifi className="h-4 w-4 text-emerald-500" />
                    : <WifiOff className="h-4 w-4 text-destructive" />}
                  {inst.display_name || inst.instance_name}
                </CardTitle>
                <div className="flex items-center gap-1.5">
                  {inst.is_default && <Badge variant="outline" className="text-xs">Padrão</Badge>}
                  {inst.server === "unv"
                    ? <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30 text-xs">Servidor UNV</Badge>
                    : <Badge className="bg-amber-500/15 text-amber-600 border-amber-500/30 text-xs">Stevo — migrar</Badge>}
                  {connected(inst.status)
                    ? <Badge className="bg-emerald-500 text-white border-0 text-xs">Conectada</Badge>
                    : <Badge variant="destructive" className="text-xs">Desconectada</Badge>}
                </div>
              </div>
              <CardDescription className="font-mono text-xs">
                {inst.instance_name}{inst.phone_number ? ` · ${inst.phone_number}` : ""}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2 pt-2">
              {inst.server === "unv" ? (
                !connected(inst.status) && (
                  <Button size="sm" variant="default" className="gap-1.5" onClick={() => openQr(inst.instance_name)}>
                    <QrCode className="h-3.5 w-3.5" /> Conectar (QR)
                  </Button>
                )
              ) : (
                // Instância ainda no Stevo: o QR cria a homônima no servidor UNV e,
                // ao conectar, o backend vira o cadastro sozinho (migração em 1 passo).
                <Button size="sm" variant="default" className="gap-1.5" onClick={() => openQr(inst.instance_name)}>
                  <QrCode className="h-3.5 w-3.5" /> Migrar (QR)
                </Button>
              )}
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => handleRestart(inst)}>
                <RefreshCw className="h-3.5 w-3.5" /> Reconectar
              </Button>
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => openAccess(inst)}>
                <Users className="h-3.5 w-3.5" /> Acessos
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" variant="ghost" className="gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10">
                    <Trash2 className="h-3.5 w-3.5" /> Excluir
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Excluir {inst.display_name || inst.instance_name}?</AlertDialogTitle>
                    <AlertDialogDescription>
                      A sessão do WhatsApp será desconectada e a instância removida. Automações que usam esta instância param de enviar.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => handleDelete(inst)}>
                      Excluir
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardContent>
          </Card>
        ))}
        {!instances.length && (
          <Card className="sm:col-span-2">
            <CardContent className="py-12 text-center text-muted-foreground">
              Nenhuma instância. Clique em "Nova conexão" pra conectar o primeiro número.
            </CardContent>
          </Card>
        )}
      </div>

      {/* Nova conexão */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nova conexão de WhatsApp</DialogTitle>
            <DialogDescription>A instância é criada no servidor da UNV. Depois é só escanear o QR com o celular do número.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Identificador (sem espaços)</Label>
              <Input placeholder="ex: natalia-amador" value={newName} onChange={(e) => setNewName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Nome de exibição</Label>
              <Input placeholder="ex: Natália Amador" value={newDisplay} onChange={(e) => setNewDisplay(e.target.value)} />
            </div>
            <Button className="w-full" onClick={handleCreate} disabled={creating}>
              {creating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
              Criar e gerar QR
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* QR */}
      <Dialog open={!!qrFor} onOpenChange={(o) => { if (!o) closeQr(); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Conectar {qrFor}</DialogTitle>
            <DialogDescription>
              No celular do número: WhatsApp → Configurações → Aparelhos conectados → Conectar aparelho. O QR renova sozinho a cada 30s. Ao conectar, a instância passa a operar no servidor UNV automaticamente.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-center min-h-[280px]">
            {qrLoading && !qrImg
              ? <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              : qrImg
                ? <img src={qrImg} alt="QR Code" className="w-64 h-64 rounded-lg bg-white p-2" />
                : <p className="text-sm text-muted-foreground">QR indisponível — tenta reconectar a instância.</p>}
          </div>
          <Button variant="outline" size="sm" className="gap-2" onClick={() => qrFor && fetchQr(qrFor)} disabled={qrLoading}>
            <RefreshCw className={`h-4 w-4 ${qrLoading ? "animate-spin" : ""}`} /> Gerar novo QR
          </Button>
        </DialogContent>
      </Dialog>

      {/* Acessos por instância */}
      <Dialog open={!!accessFor} onOpenChange={(o) => { if (!o) setAccessFor(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Acessos — {accessFor?.display_name || accessFor?.instance_name}</DialogTitle>
            <DialogDescription>
              Quem pode ver e enviar conversas desta instância no Atendimento. Só o master tem acesso total automático — administradores também precisam ser liberados aqui.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[50vh] overflow-y-auto space-y-1">
            <div className="grid grid-cols-[1fr_70px_70px] gap-2 px-2 pb-1 text-xs font-medium text-muted-foreground">
              <span>Usuário</span><span className="text-center">Ver</span><span className="text-center">Enviar</span>
            </div>
            {staffList.filter((s) => s.role !== "master").map((s) => {
              const a = accessMap.get(s.id);
              return (
                <div key={s.id} className="grid grid-cols-[1fr_70px_70px] gap-2 items-center rounded-md px-2 py-1.5 hover:bg-muted/50">
                  <div className="min-w-0">
                    <p className="text-sm truncate">{s.name}</p>
                    <p className="text-xs text-muted-foreground">{s.role}</p>
                  </div>
                  <div className="flex justify-center">
                    <Checkbox checked={!!a?.can_view} onCheckedChange={(v) => toggleAccess(s.id, "can_view", v === true)} />
                  </div>
                  <div className="flex justify-center">
                    <Checkbox checked={!!a?.can_send} onCheckedChange={(v) => toggleAccess(s.id, "can_send", v === true)} />
                  </div>
                </div>
              );
            })}
          </div>
          <Button onClick={saveAccess} disabled={savingAccess} className="w-full">
            {savingAccess && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Salvar acessos
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
