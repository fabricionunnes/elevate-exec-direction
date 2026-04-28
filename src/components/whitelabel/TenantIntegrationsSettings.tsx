import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { CreditCard, MessageCircle, Plus, Trash2, Loader2, CheckCircle2, Clock, Link2 } from "lucide-react";
import { toast } from "sonner";

interface AsaasAccount {
  id: string;
  name: string;
  api_key_secret_name: string;
  is_active: boolean;
  is_default: boolean;
  created_at: string;
}

interface WhatsappInstance {
  id: string;
  instance_name: string;
  display_name: string | null;
  phone_number: string | null;
  status: string | null;
  is_default: boolean;
  api_url: string | null;
  created_at: string;
}

export function TenantIntegrationsSettings() {
  const { tenant } = useTenant();

  if (!tenant) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Nenhum tenant ativo.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Integrações</h2>
        <p className="text-sm text-muted-foreground">
          Configure as integrações exclusivas do seu tenant. Apenas você terá acesso a estes dados.
        </p>
      </div>

      <Tabs defaultValue="asaas" className="space-y-4">
        <TabsList>
          <TabsTrigger value="asaas" className="gap-1.5">
            <CreditCard className="h-4 w-4" /> Asaas
          </TabsTrigger>
          <TabsTrigger value="whatsapp" className="gap-1.5">
            <MessageCircle className="h-4 w-4" /> WhatsApp
          </TabsTrigger>
          <TabsTrigger value="others" className="gap-1.5">
            <Link2 className="h-4 w-4" /> Outras
          </TabsTrigger>
        </TabsList>

        <TabsContent value="asaas">
          <AsaasIntegration tenantId={tenant.id} />
        </TabsContent>

        <TabsContent value="whatsapp">
          <WhatsappIntegration tenantId={tenant.id} />
        </TabsContent>

        <TabsContent value="others">
          <OtherIntegrations />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ------------------------- Asaas ------------------------- */
export function AsaasIntegration({ tenantId }: { tenantId: string }) {
  const [accounts, setAccounts] = useState<AsaasAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [apiKey, setApiKey] = useState("");

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("asaas_accounts")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });
    if (error) toast.error("Erro ao carregar: " + error.message);
    setAccounts((data as AsaasAccount[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [tenantId]);

  const handleCreate = async () => {
    if (!name.trim() || !apiKey.trim()) {
      toast.error("Preencha nome e chave da API");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.functions.invoke("tenant-asaas-account", {
        body: { action: "create", name: name.trim(), api_key: apiKey.trim() },
      });
      if (error) throw error;
      toast.success("Conta Asaas adicionada!");
      setName("");
      setApiKey("");
      setOpen(false);
      load();
    } catch (e: any) {
      toast.error("Erro: " + (e.message || "falha ao salvar"));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Remover esta conta Asaas?")) return;
    const { error } = await supabase.from("asaas_accounts").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Conta removida");
    load();
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" /> Contas Asaas
            </CardTitle>
            <CardDescription>
              Cadastre suas próprias chaves Asaas para emitir boletos, PIX e cobranças.
            </CardDescription>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-1" /> Nova conta
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Adicionar conta Asaas</DialogTitle>
                <DialogDescription>
                  A chave é armazenada de forma segura e usada apenas pelo backend.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>Nome da conta</Label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ex.: Conta Principal"
                    maxLength={100}
                  />
                </div>
                <div className="space-y-2">
                  <Label>API Key (Asaas)</Label>
                  <Input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="$aact_..."
                    maxLength={500}
                  />
                  <p className="text-xs text-muted-foreground">
                    Encontre em: Asaas → Integrações → Chave de API
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
                  Cancelar
                </Button>
                <Button onClick={handleCreate} disabled={saving}>
                  {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Salvar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : accounts.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground">
            Nenhuma conta Asaas cadastrada ainda.
          </div>
        ) : (
          <div className="space-y-2">
            {accounts.map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between p-3 rounded-md border border-border"
              >
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  <div>
                    <div className="font-medium text-sm">{a.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {a.is_default && <Badge variant="secondary" className="mr-1">Padrão</Badge>}
                      {a.is_active ? "Ativa" : "Inativa"}
                    </div>
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => handleDelete(a.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ----------------------- WhatsApp ----------------------- */
function WhatsappIntegration({ tenantId }: { tenantId: string }) {
  const [instances, setInstances] = useState<WhatsappInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    instance_name: "",
    display_name: "",
    phone_number: "",
    api_url: "",
    api_key: "",
  });

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("whatsapp_instances")
      .select("id,instance_name,display_name,phone_number,status,is_default,api_url,created_at")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });
    if (error) toast.error("Erro ao carregar: " + error.message);
    setInstances((data as WhatsappInstance[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [tenantId]);

  const handleCreate = async () => {
    if (!form.instance_name.trim()) {
      toast.error("Nome da instância é obrigatório");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from("whatsapp_instances").insert({
        instance_name: form.instance_name.trim(),
        display_name: form.display_name.trim() || form.instance_name.trim(),
        phone_number: form.phone_number.trim() || null,
        api_url: form.api_url.trim() || null,
        api_key: form.api_key.trim() || null,
        tenant_id: tenantId,
        status: "disconnected",
      });
      if (error) throw error;
      toast.success("Instância adicionada!");
      setForm({ instance_name: "", display_name: "", phone_number: "", api_url: "", api_key: "" });
      setOpen(false);
      load();
    } catch (e: any) {
      toast.error("Erro: " + (e.message || "falha ao salvar"));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Remover esta instância?")) return;
    const { error } = await supabase.from("whatsapp_instances").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Instância removida");
    load();
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5" /> Números de WhatsApp
            </CardTitle>
            <CardDescription>
              Conecte instâncias da Evolution API exclusivas do seu tenant.
            </CardDescription>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-1" /> Nova instância
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Adicionar instância de WhatsApp</DialogTitle>
                <DialogDescription>
                  Os dados ficam isolados ao seu tenant.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>Nome técnico (instance_name)</Label>
                  <Input
                    value={form.instance_name}
                    onChange={(e) => setForm({ ...form, instance_name: e.target.value })}
                    placeholder="ex.: minhaempresa-vendas"
                    maxLength={100}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Nome de exibição</Label>
                  <Input
                    value={form.display_name}
                    onChange={(e) => setForm({ ...form, display_name: e.target.value })}
                    placeholder="Ex.: Comercial"
                    maxLength={100}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Telefone</Label>
                  <Input
                    value={form.phone_number}
                    onChange={(e) => setForm({ ...form, phone_number: e.target.value })}
                    placeholder="5511999999999"
                    maxLength={20}
                  />
                </div>
                <div className="space-y-2">
                  <Label>API URL (opcional)</Label>
                  <Input
                    value={form.api_url}
                    onChange={(e) => setForm({ ...form, api_url: e.target.value })}
                    placeholder="https://evolution.seudominio.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label>API Key (opcional)</Label>
                  <Input
                    type="password"
                    value={form.api_key}
                    onChange={(e) => setForm({ ...form, api_key: e.target.value })}
                    placeholder="••••••••"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
                  Cancelar
                </Button>
                <Button onClick={handleCreate} disabled={saving}>
                  {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Salvar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : instances.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground">
            Nenhuma instância de WhatsApp cadastrada.
          </div>
        ) : (
          <div className="space-y-2">
            {instances.map((i) => (
              <div
                key={i.id}
                className="flex items-center justify-between p-3 rounded-md border border-border"
              >
                <div className="flex items-center gap-3">
                  <MessageCircle className="h-4 w-4 text-primary" />
                  <div>
                    <div className="font-medium text-sm">
                      {i.display_name || i.instance_name}
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center gap-2">
                      <span>{i.phone_number || "sem telefone"}</span>
                      <Badge
                        variant={i.status === "connected" ? "default" : "secondary"}
                        className="text-xs"
                      >
                        {i.status || "desconectado"}
                      </Badge>
                    </div>
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => handleDelete(i.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ----------------------- Outras ----------------------- */
function OtherIntegrations() {
  const items = [
    { name: "Conta Azul", desc: "Sincronização contábil e financeira", status: "Em breve" },
    { name: "Pagar.me", desc: "Cobranças via cartão e boleto", status: "Em breve" },
    { name: "Mercado Pago", desc: "Recebimento de pagamentos", status: "Em breve" },
    { name: "Google Calendar", desc: "Agendamentos sincronizados", status: "Em breve" },
    { name: "Meta Ads", desc: "Captura de leads do Facebook/Instagram", status: "Em breve" },
    { name: "Twilio", desc: "Voz e SMS", status: "Em breve" },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Link2 className="h-5 w-5" /> Outras integrações
        </CardTitle>
        <CardDescription>
          Disponíveis em breve para tenants white-label.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-2 md:grid-cols-2">
          {items.map((i) => (
            <div
              key={i.name}
              className="flex items-center justify-between p-3 rounded-md border border-border"
            >
              <div>
                <div className="font-medium text-sm">{i.name}</div>
                <div className="text-xs text-muted-foreground">{i.desc}</div>
              </div>
              <Badge variant="secondary" className="gap-1">
                <Clock className="h-3 w-3" />
                {i.status}
              </Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
