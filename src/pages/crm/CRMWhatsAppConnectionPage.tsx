// Conexão WhatsApp no CRM — autoatendimento do vendedor.
// Mostra SÓ as instâncias que o usuário logado tem acesso liberado
// (whatsapp_instance_access.can_view — o filtro é aplicado no backend wa-connections,
// que também recusa criar/excluir pra quem não é admin/master).
// Objetivo: o closer reconectar o próprio número sem depender do admin.
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, MessageSquare, QrCode, RefreshCw, Wifi, WifiOff } from "lucide-react";
import { toast } from "sonner";

interface Instance {
  id: string;
  instance_name: string;
  display_name: string | null;
  phone_number: string | null;
  status: string | null;
  server: "stevo" | "unv";
}

async function callApi(action: string, body: Record<string, unknown> = {}) {
  const { data, error } = await supabase.functions.invoke("wa-connections", { body: { action, ...body } });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  return data;
}

export default function CRMWhatsAppConnectionPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [instances, setInstances] = useState<Instance[]>([]);
  const [qrFor, setQrFor] = useState<string | null>(null);
  const [qrImg, setQrImg] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const timers = useRef<number[]>([]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const data = await callApi("status-all");
      setInstances(data.instances || []);
    } catch (e: unknown) {
      toast.error((e as Error).message);
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    return () => { timers.current.forEach(clearTimeout); };
  }, [refresh]);

  const stopLoops = () => { timers.current.forEach(clearTimeout); timers.current = []; };
  const openQr = async (name: string) => {
    stopLoops();
    setQrFor(name);
    setQrImg(null);
    await fetchQr(name);
    poll(name);
  };
  const fetchQr = async (name: string) => {
    setQrLoading(true);
    try {
      const data = await callApi("qr", { instance_name: name });
      if (data.connected) { toast.success("Já conectado!"); closeQr(); await refresh(); return; }
      setQrImg(data.base64 || null);
      timers.current.push(window.setTimeout(() => fetchQr(name), 30000)); // QR expira ~40s
    } catch (e: unknown) {
      toast.error((e as Error).message);
    } finally {
      setQrLoading(false);
    }
  };
  const poll = (name: string) => {
    timers.current.push(window.setTimeout(async () => {
      try {
        const { state } = await callApi("status", { instance_name: name });
        if (state === "open") { toast.success("WhatsApp conectado!"); closeQr(); await refresh(); return; }
      } catch { /* segue tentando */ }
      poll(name);
    }, 3000));
  };
  const closeQr = () => { stopLoops(); setQrFor(null); setQrImg(null); };

  const restart = async (name: string) => {
    try {
      await callApi("restart", { instance_name: name });
      toast.success("Reconexão disparada. Atualize em ~15s.");
    } catch (e: unknown) { toast.error((e as Error).message); }
  };

  const connected = (s: string | null) => s === "connected" || s === "connecting";

  if (loading) {
    return <div className="flex items-center justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="container max-w-4xl mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} title="Voltar">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <MessageSquare className="h-6 w-6 text-primary" /> Conexão WhatsApp
          </h1>
          <p className="text-sm text-muted-foreground">Conecte o seu número por aqui. Aparecem só as conexões liberadas pra você.</p>
          </div>
        </div>
        <Button variant="outline" size="sm" className="gap-2" onClick={refresh} disabled={refreshing}>
          <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} /> Atualizar
        </Button>
      </div>

      {!instances.length ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Nenhuma conexão liberada pra você ainda. Fale com um administrador pra liberar o acesso à sua instância.
          </CardContent>
        </Card>
      ) : (
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
                  {connected(inst.status)
                    ? <Badge className="bg-emerald-500 text-white border-0 text-xs">Conectada</Badge>
                    : <Badge variant="destructive" className="text-xs">Desconectada</Badge>}
                </div>
                <CardDescription className="font-mono text-xs">
                  {inst.phone_number || inst.instance_name}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2 pt-2">
                {!connected(inst.status) && (
                  <Button size="sm" className="gap-1.5" onClick={() => openQr(inst.instance_name)}>
                    <QrCode className="h-3.5 w-3.5" /> Conectar (QR)
                  </Button>
                )}
                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => restart(inst.instance_name)}>
                  <RefreshCw className="h-3.5 w-3.5" /> Reconectar
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!qrFor} onOpenChange={(o) => { if (!o) closeQr(); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Conectar WhatsApp</DialogTitle>
            <DialogDescription>
              No seu celular: WhatsApp → Configurações → Aparelhos conectados → Conectar aparelho. O QR renova sozinho a cada 30s.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-center min-h-[280px]">
            {qrLoading && !qrImg
              ? <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              : qrImg
                ? <img src={qrImg} alt="QR Code" className="w-64 h-64 rounded-lg bg-white p-2" />
                : <p className="text-sm text-muted-foreground">QR indisponível — tente Reconectar e abrir de novo.</p>}
          </div>
          <Button variant="outline" size="sm" className="gap-2" onClick={() => qrFor && fetchQr(qrFor)} disabled={qrLoading}>
            <RefreshCw className={`h-4 w-4 ${qrLoading ? "animate-spin" : ""}`} /> Gerar novo QR
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
