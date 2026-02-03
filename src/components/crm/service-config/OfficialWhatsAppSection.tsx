import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { 
  ArrowLeft, 
  Plus, 
  Trash2, 
  Loader2, 
  CheckCircle2, 
  XCircle, 
  Copy,
  RefreshCw,
  ExternalLink,
  MessageSquare
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface OfficialInstance {
  id: string;
  display_name: string;
  waba_id: string;
  phone_number_id: string;
  phone_number: string | null;
  status: string;
  webhook_verify_token: string;
  last_error: string | null;
  created_at: string;
}

interface OfficialWhatsAppSectionProps {
  onBack: () => void;
}

export const OfficialWhatsAppSection = ({ onBack }: OfficialWhatsAppSectionProps) => {
  const [instances, setInstances] = useState<OfficialInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [deleteInstance, setDeleteInstance] = useState<OfficialInstance | null>(null);
  const [verifying, setVerifying] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    display_name: '',
    waba_id: '',
    phone_number_id: '',
    access_token: '',
  });
  const [saving, setSaving] = useState(false);

  const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-official-webhook`;

  useEffect(() => {
    fetchInstances();
  }, []);

  const fetchInstances = async () => {
    try {
      const { data, error } = await supabase
        .from('whatsapp_official_instances')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setInstances(data || []);
    } catch (err: any) {
      console.error('Error fetching official instances:', err);
      toast.error('Erro ao carregar instâncias');
    } finally {
      setLoading(false);
    }
  };

  const handleAddInstance = async () => {
    if (!formData.display_name || !formData.waba_id || !formData.phone_number_id || !formData.access_token) {
      toast.error('Preencha todos os campos');
      return;
    }

    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('whatsapp_official_instances')
        .insert({
          display_name: formData.display_name,
          waba_id: formData.waba_id,
          phone_number_id: formData.phone_number_id,
          access_token: formData.access_token,
          status: 'pending',
        })
        .select()
        .single();

      if (error) throw error;

      setInstances(prev => [data, ...prev]);
      setShowAddDialog(false);
      setFormData({ display_name: '', waba_id: '', phone_number_id: '', access_token: '' });
      toast.success('Instância adicionada! Configure o webhook no Meta para conectar.');
    } catch (err: any) {
      console.error('Error adding instance:', err);
      toast.error(err.message || 'Erro ao adicionar instância');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteInstance = async () => {
    if (!deleteInstance) return;

    try {
      const { error } = await supabase
        .from('whatsapp_official_instances')
        .delete()
        .eq('id', deleteInstance.id);

      if (error) throw error;

      setInstances(prev => prev.filter(i => i.id !== deleteInstance.id));
      setDeleteInstance(null);
      toast.success('Instância removida');
    } catch (err: any) {
      console.error('Error deleting instance:', err);
      toast.error('Erro ao remover instância');
    }
  };

  const handleVerifyConnection = async (instance: OfficialInstance) => {
    setVerifying(instance.id);
    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-official-api', {
        body: {
          action: 'verifyConnection',
          instanceId: instance.id,
        },
      });

      if (error || data?.error) {
        throw new Error(data?.error || 'Erro ao verificar conexão');
      }

      // Update instance with phone number
      await supabase
        .from('whatsapp_official_instances')
        .update({ 
          phone_number: data.phoneNumber,
          status: 'connected',
          last_error: null,
        })
        .eq('id', instance.id);

      await fetchInstances();
      toast.success(`Conectado! Número: ${data.phoneNumber}`);
    } catch (err: any) {
      console.error('Error verifying connection:', err);
      
      await supabase
        .from('whatsapp_official_instances')
        .update({ 
          status: 'error',
          last_error: err.message,
        })
        .eq('id', instance.id);

      await fetchInstances();
      toast.error(err.message || 'Erro ao verificar conexão');
    } finally {
      setVerifying(null);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado!`);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'connected':
        return <Badge className="bg-green-500"><CheckCircle2 className="h-3 w-3 mr-1" /> Conectado</Badge>;
      case 'error':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" /> Erro</Badge>;
      default:
        return <Badge variant="secondary">Pendente</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-green-600" />
              WhatsApp API Oficial
            </h2>
            <p className="text-sm text-muted-foreground">
              Gerencie conexões via Meta Cloud API
            </p>
          </div>
        </div>
        <Button onClick={() => setShowAddDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Nova Instância
        </Button>
      </div>

      {/* Setup Guide */}
      <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2 text-amber-900 dark:text-amber-100">
            📋 Guia de Configuração
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3 text-sm">
            <div className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-amber-200 dark:bg-amber-800 flex items-center justify-center text-xs font-bold">1</span>
              <div>
                <p className="font-medium">Acesse o Meta Developers</p>
                <p className="text-muted-foreground text-xs">Vá em developers.facebook.com → Criar App → Tipo "Business" → Adicionar produto "WhatsApp"</p>
              </div>
            </div>
            <div className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-amber-200 dark:bg-amber-800 flex items-center justify-center text-xs font-bold">2</span>
              <div>
                <p className="font-medium">Copie suas credenciais</p>
                <p className="text-muted-foreground text-xs">Em "WhatsApp → API Setup": copie o <strong>Phone Number ID</strong> e <strong>WABA ID</strong> (WhatsApp Business Account ID)</p>
              </div>
            </div>
            <div className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-amber-200 dark:bg-amber-800 flex items-center justify-center text-xs font-bold">3</span>
              <div>
                <p className="font-medium">Gere um Token Permanente</p>
                <p className="text-muted-foreground text-xs">Vá em "Business Settings → System Users" → Crie um usuário → Gere um token com permissões whatsapp_business_messaging</p>
              </div>
            </div>
            <div className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-amber-200 dark:bg-amber-800 flex items-center justify-center text-xs font-bold">4</span>
              <div>
                <p className="font-medium">Crie a instância aqui</p>
                <p className="text-muted-foreground text-xs">Clique em "Nova Instância" e preencha os dados copiados</p>
              </div>
            </div>
            <div className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-amber-200 dark:bg-amber-800 flex items-center justify-center text-xs font-bold">5</span>
              <div>
                <p className="font-medium">Configure o Webhook no Meta</p>
                <p className="text-muted-foreground text-xs">Em "WhatsApp → Configuration → Webhook": cole a URL e o Token de Verificação mostrados abaixo. Inscreva-se em: messages</p>
              </div>
            </div>
            <div className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-green-200 dark:bg-green-800 flex items-center justify-center text-xs font-bold">✓</span>
              <div>
                <p className="font-medium">Verifique a conexão</p>
                <p className="text-muted-foreground text-xs">Clique em "Verificar Conexão" na instância criada para confirmar que está funcionando</p>
              </div>
            </div>
          </div>
          <a 
            href="https://developers.facebook.com/docs/whatsapp/cloud-api/get-started" 
            target="_blank" 
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-amber-700 dark:text-amber-300 hover:underline"
          >
            <ExternalLink className="h-3 w-3" />
            Documentação oficial do Meta
          </a>
        </CardContent>
      </Card>

      {/* Webhook URL Info */}
      <Card className="bg-blue-50 dark:bg-blue-950/20 border-blue-200">
        <CardContent className="pt-4">
          <div className="flex items-start gap-3">
            <ExternalLink className="h-5 w-5 text-blue-600 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                URL do Webhook para configurar no Meta
              </p>
              <div className="flex items-center gap-2 mt-1">
                <code className="text-xs bg-blue-100 dark:bg-blue-900 px-2 py-1 rounded flex-1 overflow-x-auto">
                  {webhookUrl}
                </code>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => copyToClipboard(webhookUrl, 'URL do Webhook')}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Instances List */}
      <div className="space-y-4">
        {instances.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-medium">Nenhuma instância configurada</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Adicione uma instância para começar a usar a API Oficial
              </p>
            </CardContent>
          </Card>
        ) : (
          instances.map((instance) => (
            <Card key={instance.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base">{instance.display_name}</CardTitle>
                    <CardDescription>
                      {instance.phone_number || 'Número não verificado'}
                    </CardDescription>
                  </div>
                  {getStatusBadge(instance.status)}
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                  <div>
                    <span className="text-muted-foreground">WABA ID:</span>
                    <span className="ml-2 font-mono">{instance.waba_id}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Phone Number ID:</span>
                    <span className="ml-2 font-mono">{instance.phone_number_id}</span>
                  </div>
                </div>

                {/* Webhook Verify Token */}
                <div className="bg-muted/50 rounded-lg p-3 mb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">Token de Verificação do Webhook</p>
                      <code className="text-xs font-mono">{instance.webhook_verify_token}</code>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => copyToClipboard(instance.webhook_verify_token, 'Token')}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {instance.last_error && (
                  <div className="bg-destructive/10 text-destructive rounded-lg p-3 mb-4 text-sm">
                    <strong>Erro:</strong> {instance.last_error}
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleVerifyConnection(instance)}
                    disabled={verifying === instance.id}
                  >
                    {verifying === instance.id ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4 mr-2" />
                    )}
                    Verificar Conexão
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setDeleteInstance(instance)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Add Instance Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Instância - API Oficial</DialogTitle>
            <DialogDescription>
              Insira as credenciais da sua conta WhatsApp Business API
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="display_name">Nome de Exibição</Label>
              <Input
                id="display_name"
                placeholder="Ex: WhatsApp Principal"
                value={formData.display_name}
                onChange={(e) => setFormData(prev => ({ ...prev, display_name: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="waba_id">WABA ID</Label>
              <Input
                id="waba_id"
                placeholder="WhatsApp Business Account ID"
                value={formData.waba_id}
                onChange={(e) => setFormData(prev => ({ ...prev, waba_id: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">
                Encontre em: Meta Business &gt; WhatsApp &gt; Configurações
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone_number_id">Phone Number ID</Label>
              <Input
                id="phone_number_id"
                placeholder="ID do número de telefone"
                value={formData.phone_number_id}
                onChange={(e) => setFormData(prev => ({ ...prev, phone_number_id: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">
                Encontre em: Meta Developers &gt; WhatsApp &gt; API Setup
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="access_token">Access Token (Permanente)</Label>
              <Input
                id="access_token"
                type="password"
                placeholder="Token de acesso"
                value={formData.access_token}
                onChange={(e) => setFormData(prev => ({ ...prev, access_token: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">
                Gere um token permanente em: Meta Developers &gt; System Users
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleAddInstance} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteInstance} onOpenChange={() => setDeleteInstance(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover Instância</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover a instância "{deleteInstance?.display_name}"? 
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteInstance} className="bg-destructive text-destructive-foreground">
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
