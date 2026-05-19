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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CreditCard, MessageCircle, Plus, Trash2, Loader2, CheckCircle2, Building2, Star, Link2 } from "lucide-react";
import { toast } from "sonner";

interface AsaasAccount {
  id: string;
  name: string;
  api_key_secret_name: string;
  is_active: boolean;
  is_default: boolean;
  bank_id: string | null;
  created_at: string;
}

interface Bank {
  id: string;
  name: string;
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
  // tenant === null means master UNV platform admin — still show integrations
  // (platform-level accounts have tenant_id = null in the database)
  const tenantId = tenant?.id ?? null;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Integrações</h2>
        <p className="text-sm text-muted-foreground">
          Configure as integrações da plataforma. Apenas administradores têm acesso a estes dados.
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
          <AsaasIntegration tenantId={tenantId} />
        </TabsContent>

        <TabsContent value="whatsapp">
          <WhatsappIntegration tenantId={tenantId} />
        </TabsContent>

        <TabsContent value="others">
          <OtherIntegrations />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ------------------------- Asaas ------------------------- */
export function AsaasIntegration({ tenantId }: { tenantId: string | null }) {
  const [accounts, setAccounts] = useState<AsaasAccount[]>([]);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [bankId, setBankId] = useState<string>("");
  const [editingBankId, setEditingBankId] = useState<{ accountId: string; bankId: string } | null>(null);
  const [savingBank, setSavingBank] = useState(false);

  const load = async () => {
    setLoading(true);
    const accountsQuery = tenantId
      ? supabase.from("asaas_accounts").select("*").eq("tenant_id", tenantId)
      : supabase.from("asaas_accounts").select("*").is("tenant_id", null);
    const [accountsRes, banksRes] = await Promise.all([
      accountsQuery.order("created_at", { ascending: false }),
      supabase
        .from("financial_banks")
        .select("id, name")
        .eq("is_active", true)
        .order("name"),
    ]);
    if (accountsRes.error) toast.error("Erro ao carregar contas: " + accountsRes.error.message);
    setAccounts((accountsRes.data as AsaasAccount[]) || []);
    setBanks((banksRes.data as Bank[]) || []);
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
      // Step 1: create via edge function (stores API key securely)
      const { data: result, error } = await supabase.functions.invoke("tenant-asaas-account", {
        body: { action: "create", name: name.trim(), api_key: apiKey.trim() },
      });
      if (error) throw error;

      // Step 2: if bank was selected, link it to the new account
      if (bankId && result?.account?.id) {
        await supabase
          .from("asaas_accounts")
          .update({ bank_id: bankId } as any)
          .eq("id", result.account.id);
      }

      toast.success("Conta Asaas configurada!");
      setName("");
      setApiKey("");
      setBankId("");
      setOpen(false);
      load();
    } catch (e: any) {
      toast.error("Erro: " + (e.message || "falha ao salvar"));
    } finally {
      setSaving(false);
    }
  };

  const handleSetDefault = async (id: string) => {
    // Remove default from all in this tenant scope, then set on selected
    const resetQuery = tenantId
      ? supabase.from("asaas_accounts").update({ is_default: false } as any).eq("tenant_id", tenantId)
      : supabase.from("asaas_accounts").update({ is_default: false } as any).is("tenant_id", null);
    await resetQuery;
    const { error } = await supabase.from("asaas_accounts").update({ is_default: true } as any).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Conta definida como padrão");
    load();
  };

  const handleUpdateBank = async (accountId: string, newBankId: string) => {
    setSavingBank(true);
    const updateValue = newBankId === "none" ? null : newBankId;
    const { error } = await supabase
      .from("asaas_accounts")
      .update({ bank_id: updateValue } as any)
      .eq("id", accountId);
    setSavingBank(false);
    if (error) return toast.error("Erro ao vincular banco: " + error.message);
    toast.success("Banco vinculado com sucesso");
    setEditingBankId(null);
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Remover esta conta Asaas?")) return;
    const { error } = await supabase.from("asaas_accounts").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Conta removida");
    load();
  };

  const getBankName = (bankId: string | null) => {
    if (!bankId) return null;
    return banks.find(b => b.id === bankId)?.name || null;
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
              Configure as chaves do Asaas para emitir boletos, PIX e cobranças recorrentes. Vincule cada conta a um banco do sistema para reconciliação automática.
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
              <div className="space-y-4">
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
                <div className="space-y-2">
                  <Label className="flex items-center gap-1">
                    <Building2 className="h-3.5 w-3.5" />
                    Banco vinculado (para reconciliação automática)
                  </Label>
                  <Select value={bankId} onValueChange={setBankId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um banco..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhum banco</SelectItem>
                      {banks.map((b) => (
                        <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Quando um pagamento for confirmado, o sistema creditará automaticamente este banco.
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
          <div className="text-center py-8 space-y-2">
            <CreditCard className="h-10 w-10 mx-auto text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">Nenhuma conta Asaas configurada.</p>
            <p className="text-xs text-muted-foreground">Adicione sua chave de API para ativar cobranças e assinaturas.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {accounts.map((a) => {
              const linkedBankName = getBankName(a.bank_id);
              const isEditingBank = editingBankId?.accountId === a.id;
              return (
                <div
                  key={a.id}
                  className="p-4 rounded-lg border border-border space-y-3"
                >
                  {/* Header row */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                      <div>
                        <div className="font-medium text-sm flex items-center gap-2">
                          {a.name}
                          {a.is_default && (
                            <Badge variant="secondary" className="text-xs">
                              <Star className="h-3 w-3 mr-0.5" /> Padrão
                            </Badge>
                          )}
                          {a.is_active ? (
                            <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-xs">Ativa</Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs">Inativa</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {!a.is_default && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs h-7"
                          onClick={() => handleSetDefault(a.id)}
                          title="Definir como padrão"
                        >
                          <Star className="h-3 w-3 mr-1" /> Padrão
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDelete(a.id)}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  </div>

                  {/* Bank linkage row */}
                  <div className="flex items-center gap-2 pl-7">
                    <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    {isEditingBank ? (
                      <div className="flex items-center gap-2 flex-1">
                        <Select
                          value={editingBankId.bankId}
                          onValueChange={(v) => setEditingBankId({ accountId: a.id, bankId: v })}
                        >
                          <SelectTrigger className="h-7 text-xs flex-1">
                            <SelectValue placeholder="Selecione um banco..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Nenhum banco</SelectItem>
                            {banks.map((b) => (
                              <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          size="sm"
                          className="h-7 text-xs"
                          disabled={savingBank}
                          onClick={() => handleUpdateBank(a.id, editingBankId.bankId)}
                        >
                          {savingBank ? <Loader2 className="h-3 w-3 animate-spin" /> : "Salvar"}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => setEditingBankId(null)}
                        >
                          Cancelar
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 flex-1">
                        <span className="text-xs text-muted-foreground">
                          {linkedBankName
                            ? <><span className="text-foreground font-medium">{linkedBankName}</span> — pagamentos confirmados creditam este banco automaticamente</>
                            : "Nenhum banco vinculado — configure para reconciliação automática"}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 text-xs ml-auto shrink-0"
                          onClick={() => setEditingBankId({ accountId: a.id, bankId: a.bank_id || "none" })}
                        >
                          {linkedBankName ? "Alterar" : "Vincular banco"}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ----------------------- WhatsApp ----------------------- */
function WhatsappIntegration({ tenantId }: { tenantId: string | null }) {
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
    const whatsappQuery = tenantId
      ? supabase.from("whatsapp_instances").select("id,instance_name,display_name,phone_number,status,is_default,api_url,created_at").eq("tenant_id", tenantId)
      : supabase.from("whatsapp_instances").select("id,instance_name,display_name,phone_number,status,is_default,api_url,created_at").is("tenant_id", null);
    const { data, error } = await whatsappQuery.order("created_at", { ascending: false });
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
        ...(tenantId ? { tenant_id: tenantId } : {}),
        status: "disconnected",
      } as any);
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
