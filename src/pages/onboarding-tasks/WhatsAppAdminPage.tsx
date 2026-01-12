import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  ArrowLeft, 
  Plus, 
  RefreshCw, 
  Send, 
  Trash2, 
  QrCode, 
  Phone, 
  CheckCircle2, 
  XCircle, 
  Loader2, 
  MessageSquare,
  Star,
  History,
  LogOut,
  RotateCcw
} from "lucide-react";
import { NexusHeader } from "@/components/onboarding-tasks/NexusHeader";
import { WhatsAppQRCodeModal } from "@/components/onboarding-tasks/WhatsAppQRCodeModal";
import { WhatsAppMessageDialog } from "@/components/onboarding-tasks/WhatsAppMessageDialog";
import { formatPhone } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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

interface WhatsAppInstance {
  id: string;
  instance_name: string;
  display_name: string;
  phone_number: string | null;
  status: string;
  qr_code: string | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

interface MessageLog {
  id: string;
  phone_number: string;
  message: string;
  message_type: string;
  status: string;
  created_at: string;
  error_message: string | null;
  instance: { display_name: string } | null;
  company: { name: string } | null;
  staff: { name: string } | null;
}

const WhatsAppAdminPage = () => {
  const navigate = useNavigate();
  const [instances, setInstances] = useState<WhatsAppInstance[]>([]);
  const [messageLogs, setMessageLogs] = useState<MessageLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  const [currentStaffId, setCurrentStaffId] = useState<string | null>(null);
  
  // Form states
  const [newInstanceName, setNewInstanceName] = useState("");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [newInstancePhone, setNewInstancePhone] = useState("");

  // Test message states
  const [testPhone, setTestPhone] = useState("");
  const [testMessage, setTestMessage] = useState("Teste de mensagem via WhatsApp API 🚀");
  const [sending, setSending] = useState(false);
  
  // Modal states
  const [qrModalInstance, setQrModalInstance] = useState<WhatsAppInstance | null>(null);
  const [deleteInstance, setDeleteInstance] = useState<WhatsAppInstance | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    checkPermissions();
    fetchInstances();
    fetchMessageLogs();
    
    // Subscribe to realtime updates
    const instancesChannel = supabase
      .channel('whatsapp-instances')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'whatsapp_instances' }, () => {
        fetchInstances();
      })
      .subscribe();
      
    const logsChannel = supabase
      .channel('whatsapp-logs')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'whatsapp_message_log' }, () => {
        fetchMessageLogs();
      })
      .subscribe();
    
    return () => {
      supabase.removeChannel(instancesChannel);
      supabase.removeChannel(logsChannel);
    };
  }, []);

  const checkPermissions = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: staff } = await supabase
        .from("onboarding_staff")
        .select("id, role")
        .eq("user_id", user.id)
        .single();
      
      if (staff) {
        setCurrentUserRole(staff.role);
        setCurrentStaffId(staff.id);
        
        if (staff.role !== "admin") {
          toast.error("Acesso restrito a administradores");
          navigate("/onboarding-tasks");
        }
      }
    }
  };

  const fetchInstances = async () => {
    try {
      const { data, error } = await supabase
        .from("whatsapp_instances")
        .select("*")
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      setInstances(data || []);
    } catch (error: any) {
      console.error("Error fetching instances:", error);
      toast.error("Erro ao carregar instâncias");
    } finally {
      setLoading(false);
    }
  };

  const fetchMessageLogs = async () => {
    try {
      const { data, error } = await supabase
        .from("whatsapp_message_log")
        .select(`
          *,
          instance:whatsapp_instances(display_name),
          company:onboarding_companies(name),
          staff:onboarding_staff(name)
        `)
        .order("created_at", { ascending: false })
        .limit(100);
      
      if (error) throw error;
      setMessageLogs(data || []);
    } catch (error: any) {
      console.error("Error fetching message logs:", error);
    }
  };

  const callEvolutionAPI = async (
    action: string,
    body?: any,
    queryParams?: Record<string, string>
  ) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("Não autenticado");

    // Build URL with action and additional query parameters
    const params = new URLSearchParams({ action, ...queryParams });
    const functionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/evolution-api?${params.toString()}`;

    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
        'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
      body: JSON.stringify(body || {}),
    });

    const data = await response.json().catch(() => ({ error: 'Resposta inválida' }));

    if (!response.ok) {
      // Extract detailed error message from various response formats
      const errorMsg = 
        data?.error || 
        data?.response?.message?.join(', ') || 
        data?.details?.error ||
        `HTTP ${response.status}`;
      throw new Error(errorMsg);
    }

    return data;
  };

  const extractQrBase64 = (result: any): string | null => {
    const raw =
      result?.base64 ??
      result?.qrcode?.base64 ??
      result?.qrCode?.base64 ??
      result?.qr?.base64 ??
      result?.qrcode ??
      result?.qr_code ??
      null;

    if (!raw || typeof raw !== "string") return null;
    return raw.replace(/^data:image\/(png|jpeg);base64,/, "");
  };

  const extractInstance = (result: any) => result?.instance ?? result;


  const handleCreateInstance = async () => {
    if (!newInstanceName.trim() || !newDisplayName.trim()) {
      toast.error("Preencha todos os campos");
      return;
    }

    const phone = newInstancePhone.trim().replace(/\D/g, "");
    if (!phone) {
      toast.error("Informe o número com DDI (ex: 5511999999999)");
      return;
    }

    const instanceName = newInstanceName.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-");

    setCreating(true);
    try {
      // Create in Evolution API
      await callEvolutionAPI("create-instance", {
        instanceName,
        token: `token_${instanceName}_${Date.now()}`,
        number: phone,
        qrcode: true,
        integration: 'WHATSAPP-BAILEYS',
      });

      // Save to database
      const { error } = await supabase
        .from("whatsapp_instances")
        .insert({
          instance_name: instanceName,
          display_name: newDisplayName.trim(),
          phone_number: phone,
          status: "disconnected",
          is_default: instances.length === 0,
          created_by: currentStaffId,
        });

      if (error) throw error;

      toast.success("Instância criada com sucesso!");
      setNewInstanceName("");
      setNewDisplayName("");
      setNewInstancePhone("");
      fetchInstances();
    } catch (error: any) {
      console.error("Error creating instance:", error);
      toast.error(error.message || "Erro ao criar instância");
    } finally {
      setCreating(false);
    }
  };

  const handleConnect = async (instance: WhatsAppInstance) => {
    const phone = (instance.phone_number || "").trim().replace(/\D/g, "");

    // Require full country code digits (ex: 5511999999999)
    if (!phone || phone.length < 12) {
      toast.error("Número inválido. Salve o telefone com DDI (ex: 5511999999999) e recrie a instância.");
      return;
    }

    setActionLoading(instance.id);
    try {
      const result = await callEvolutionAPI(
        "connect",
        { instanceName: instance.instance_name },
        { number: phone }
      );

      // Check if qrcode count is 0 - means Evolution needs more time
      const qrCount = result?.qrcode?.count ?? result?.count ?? null;
      if (qrCount === 0) {
        toast.info("QR Code ainda não disponível. Abrindo o modal e tentando automaticamente...");
        setQrModalInstance({ ...instance, qr_code: null });
        return;
      }

      const base64 = extractQrBase64(result);
      const code = result?.code ?? null;

      // Preferimos salvar o que existir: base64 puro OU o texto do QR.
      const qrPayload = base64 || code;

      if (qrPayload) {
        await supabase
          .from("whatsapp_instances")
          .update({ qr_code: qrPayload, status: "connecting" })
          .eq("id", instance.id);
      } else {
        toast.info("QR Code ainda não disponível. Abrindo o modal e tentando automaticamente...");
      }

      setQrModalInstance({ ...instance, qr_code: qrPayload });
    } catch (error: any) {
      console.error("Error connecting:", error);
      toast.error(error.message || "Erro ao conectar");
    } finally {
      setActionLoading(null);
    }
  };

  const handleCheckStatus = async (instance: WhatsAppInstance) => {
    setActionLoading(instance.id);
    try {
      const result = await callEvolutionAPI("status", {}, {
        instanceName: instance.instance_name,
      });

      const inst = extractInstance(result);
      const state = inst?.state;

      const newStatus = state === "open" ? "connected" : "disconnected";
      const phoneNumber = inst?.phoneNumber || null;

      await supabase
        .from("whatsapp_instances")
        .update({
          status: newStatus,
          phone_number: phoneNumber,
          qr_code: newStatus === "connected" ? null : instance.qr_code,
        })
        .eq("id", instance.id);

      toast.success(`Status: ${newStatus === "connected" ? "Conectado" : "Desconectado"}`);
      fetchInstances();
    } catch (error: any) {
      console.error("Error checking status:", error);
      toast.error(error.message || "Erro ao verificar status");
    } finally {
      setActionLoading(null);
    }
  };

  const handleSetDefault = async (instance: WhatsAppInstance) => {
    try {
      // Remove default from all
      await supabase
        .from("whatsapp_instances")
        .update({ is_default: false })
        .neq("id", instance.id);
      
      // Set as default
      await supabase
        .from("whatsapp_instances")
        .update({ is_default: true })
        .eq("id", instance.id);
      
      toast.success(`${instance.display_name} definida como padrão`);
      fetchInstances();
    } catch (error: any) {
      console.error("Error setting default:", error);
      toast.error("Erro ao definir instância padrão");
    }
  };

  const handleLogout = async (instance: WhatsAppInstance) => {
    setActionLoading(instance.id);
    try {
      await callEvolutionAPI("logout", { instanceName: instance.instance_name });
      
      await supabase
        .from("whatsapp_instances")
        .update({ status: "disconnected", qr_code: null })
        .eq("id", instance.id);
      
      toast.success("Logout realizado. Agora clique em Conectar para gerar novo QR.");
      fetchInstances();
    } catch (error: any) {
      console.error("Error logging out:", error);
      toast.error(error.message || "Erro ao fazer logout");
    } finally {
      setActionLoading(null);
    }
  };

  const handleRestart = async (instance: WhatsAppInstance) => {
    setActionLoading(instance.id);
    try {
      await callEvolutionAPI("restart", { instanceName: instance.instance_name });
      
      await supabase
        .from("whatsapp_instances")
        .update({ status: "disconnected", qr_code: null })
        .eq("id", instance.id);
      
      toast.success("Instância reiniciada. Aguarde alguns segundos e clique em Conectar.");
      fetchInstances();
    } catch (error: any) {
      console.error("Error restarting:", error);
      toast.error(error.message || "Erro ao reiniciar");
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteInstance = async () => {
    if (!deleteInstance) return;
    
    setActionLoading(deleteInstance.id);
    try {
      // Delete from Evolution API
      await callEvolutionAPI("delete-instance", { 
        instanceName: deleteInstance.instance_name 
      });
      
      // Delete from database
      await supabase
        .from("whatsapp_instances")
        .delete()
        .eq("id", deleteInstance.id);
      
      toast.success("Instância excluída com sucesso");
      setDeleteInstance(null);
      fetchInstances();
    } catch (error: any) {
      console.error("Error deleting instance:", error);
      toast.error(error.message || "Erro ao excluir instância");
    } finally {
      setActionLoading(null);
    }
  };

  const handleSendTestMessage = async () => {
    const defaultInstance = instances.find(i => i.is_default && i.status === "connected");
    if (!defaultInstance) {
      toast.error("Nenhuma instância padrão conectada");
      return;
    }

    if (!testPhone.trim() || !testMessage.trim()) {
      toast.error("Preencha o telefone e a mensagem");
      return;
    }

    const cleanPhone = testPhone.replace(/\D/g, "");
    if (cleanPhone.length < 10) {
      toast.error("Telefone inválido");
      return;
    }

    setSending(true);
    try {
      await callEvolutionAPI("send-text", {
        instanceName: defaultInstance.instance_name,
        number: cleanPhone,
        text: testMessage,
      });

      // Log message
      await supabase
        .from("whatsapp_message_log")
        .insert({
          instance_id: defaultInstance.id,
          phone_number: cleanPhone,
          message: testMessage,
          message_type: "text",
          status: "sent",
          sent_by: currentStaffId,
        });

      toast.success("Mensagem enviada com sucesso!");
      setTestPhone("");
      fetchMessageLogs();
    } catch (error: any) {
      console.error("Error sending message:", error);
      
      // Log error
      await supabase
        .from("whatsapp_message_log")
        .insert({
          instance_id: defaultInstance.id,
          phone_number: cleanPhone,
          message: testMessage,
          message_type: "text",
          status: "error",
          error_message: error.message,
          sent_by: currentStaffId,
        });
      
      toast.error(error.message || "Erro ao enviar mensagem");
    } finally {
      setSending(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "connected":
        return (
          <Badge className="bg-green-500">
            <CheckCircle2 className="h-3 w-3 mr-1" />Conectado
          </Badge>
        );
      case "connecting":
        return (
          <Badge variant="secondary">
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />Conectando
          </Badge>
        );
      default:
        return (
          <Badge variant="destructive">
            <XCircle className="h-3 w-3 mr-1" />Desconectado
          </Badge>
        );
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/onboarding-tasks")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <NexusHeader />
            <div className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-green-500" />
              <h1 className="text-xl font-bold">WhatsApp Admin</h1>
            </div>
          </div>
        </div>

        <Tabs defaultValue="instances" className="space-y-4">
          <TabsList>
            <TabsTrigger value="instances" className="gap-2">
              <Phone className="h-4 w-4" />
              Instâncias
            </TabsTrigger>
            <TabsTrigger value="send" className="gap-2">
              <Send className="h-4 w-4" />
              Enviar Mensagem
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-2">
              <History className="h-4 w-4" />
              Histórico
            </TabsTrigger>
          </TabsList>

          {/* Instances Tab */}
          <TabsContent value="instances" className="space-y-4">
            {/* Create Instance Card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Plus className="h-5 w-5" />
                  Nova Instância
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-4">
                  <div className="space-y-2">
                    <Label htmlFor="instanceName">Nome Técnico</Label>
                    <Input
                      id="instanceName"
                      placeholder="minha-instancia"
                      value={newInstanceName}
                      onChange={(e) => setNewInstanceName(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
                    />
                    <p className="text-xs text-muted-foreground">
                      Apenas letras minúsculas, números e hífen
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="displayName">Nome de Exibição</Label>
                    <Input
                      id="displayName"
                      placeholder="WhatsApp Principal"
                      value={newDisplayName}
                      onChange={(e) => setNewDisplayName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="instancePhone">Número (com DDI)</Label>
                    <Input
                      id="instancePhone"
                      placeholder="5511999999999"
                      inputMode="numeric"
                      value={newInstancePhone}
                      onChange={(e) => setNewInstancePhone(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Use só números (ex: 55 + DDD + número)
                    </p>
                  </div>
                  <div className="flex items-end">
                    <Button onClick={handleCreateInstance} disabled={creating} className="w-full">
                      {creating ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Plus className="h-4 w-4 mr-2" />
                      )}
                      Criar Instância
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Instances List */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Instâncias Configuradas</CardTitle>
              </CardHeader>
              <CardContent>
                {instances.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Phone className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>Nenhuma instância configurada</p>
                    <p className="text-sm">Crie uma instância acima para começar</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {instances.map((instance) => (
                      <div 
                        key={instance.id} 
                        className="flex items-center justify-between p-4 border rounded-lg bg-card"
                      >
                        <div className="flex items-center gap-4">
                          <div className="flex flex-col">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{instance.display_name}</span>
                              {instance.is_default && (
                                <Badge variant="outline" className="text-xs">
                                  <Star className="h-3 w-3 mr-1 fill-yellow-400 text-yellow-400" />
                                  Padrão
                                </Badge>
                              )}
                            </div>
                            <span className="text-sm text-muted-foreground">
                              {instance.instance_name}
                              {instance.phone_number && ` • ${formatPhone(instance.phone_number)}`}
                            </span>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          {getStatusBadge(instance.status)}
                          
                          {instance.status !== "connected" && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleConnect(instance)}
                              disabled={actionLoading === instance.id}
                            >
                              {actionLoading === instance.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <QrCode className="h-4 w-4" />
                              )}
                            </Button>
                          )}
                          
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleCheckStatus(instance)}
                            disabled={actionLoading === instance.id}
                            title="Verificar Status"
                          >
                            {actionLoading === instance.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <RefreshCw className="h-4 w-4" />
                            )}
                          </Button>
                          
                          {(instance.status === "connecting" || instance.status === "connected") && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleLogout(instance)}
                              disabled={actionLoading === instance.id}
                              title="Fazer Logout"
                            >
                              {actionLoading === instance.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <LogOut className="h-4 w-4" />
                              )}
                            </Button>
                          )}
                          
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleRestart(instance)}
                            disabled={actionLoading === instance.id}
                            title="Reiniciar Instância"
                          >
                            {actionLoading === instance.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <RotateCcw className="h-4 w-4" />
                            )}
                          </Button>
                          
                          {!instance.is_default && instance.status === "connected" && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleSetDefault(instance)}
                              title="Definir como Padrão"
                            >
                              <Star className="h-4 w-4" />
                            </Button>
                          )}
                          
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeleteInstance(instance)}
                            className="text-destructive hover:text-destructive"
                            title="Excluir Instância"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Send Message Tab */}
          <TabsContent value="send" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Send className="h-5 w-5" />
                  Enviar Mensagem de Teste
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {instances.filter(i => i.is_default && i.status === "connected").length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <XCircle className="h-12 w-12 mx-auto mb-3 text-destructive opacity-50" />
                    <p>Nenhuma instância padrão conectada</p>
                    <p className="text-sm">Conecte uma instância na aba "Instâncias" e defina como padrão</p>
                  </div>
                ) : (
                  <>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="testPhone">Telefone</Label>
                        <Input
                          id="testPhone"
                          placeholder="11999999999"
                          value={testPhone}
                          onChange={(e) => setTestPhone(e.target.value.replace(/\D/g, ""))}
                        />
                        <p className="text-xs text-muted-foreground">
                          Apenas números com DDD
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="testMessage">Mensagem</Label>
                        <Textarea
                          id="testMessage"
                          placeholder="Digite sua mensagem..."
                          value={testMessage}
                          onChange={(e) => setTestMessage(e.target.value)}
                          rows={3}
                        />
                      </div>
                    </div>
                    <Button onClick={handleSendTestMessage} disabled={sending}>
                      {sending ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4 mr-2" />
                      )}
                      Enviar Mensagem
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <History className="h-5 w-5" />
                  Histórico de Mensagens
                </CardTitle>
              </CardHeader>
              <CardContent>
                {messageLogs.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>Nenhuma mensagem enviada ainda</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Telefone</TableHead>
                        <TableHead>Mensagem</TableHead>
                        <TableHead>Instância</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {messageLogs.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell className="whitespace-nowrap">
                            {format(new Date(log.created_at), "dd/MM HH:mm", { locale: ptBR })}
                          </TableCell>
                          <TableCell>{formatPhone(log.phone_number)}</TableCell>
                          <TableCell className="max-w-xs truncate">
                            {log.message}
                          </TableCell>
                          <TableCell>{log.instance?.display_name || "-"}</TableCell>
                          <TableCell>
                            {log.status === "sent" ? (
                              <Badge className="bg-green-500">Enviado</Badge>
                            ) : (
                              <Badge variant="destructive" title={log.error_message || ""}>
                                Erro
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* QR Code Modal */}
      {qrModalInstance && (
        <WhatsAppQRCodeModal
          instance={qrModalInstance}
          onClose={() => setQrModalInstance(null)}
          onConnected={() => {
            setQrModalInstance(null);
            fetchInstances();
          }}
        />
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteInstance} onOpenChange={() => setDeleteInstance(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Instância</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a instância "{deleteInstance?.display_name}"? 
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteInstance}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default WhatsAppAdminPage;
