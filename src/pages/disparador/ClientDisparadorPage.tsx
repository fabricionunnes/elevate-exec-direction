import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  ArrowLeft,
  Download,
  Loader2,
  MessageSquare,
  Phone,
  Plus,
  Send,
  CheckCircle2,
  XCircle,
  QrCode,
  RefreshCw,
  Trash2,
  Star,
  LogOut,
  RotateCcw,
  Settings,
} from "lucide-react";
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
import { BulkMessageCampaign } from "@/components/whatsapp/BulkMessageCampaign";
import { WhatsAppQRCodeModal } from "@/components/onboarding-tasks/WhatsAppQRCodeModal";
import { ClientImportInstanceModal } from "@/components/disparador/ClientImportInstanceModal";
import { EvolutionConfigForm } from "@/components/disparador/EvolutionConfigForm";
import { formatPhone } from "@/lib/utils";

interface WhatsAppInstance {
  id: string;
  instance_name: string;
  display_name: string;
  phone_number: string | null;
  status: string;
  qr_code: string | null;
  is_default: boolean;
  created_at: string;
}

const ClientDisparadorPage = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [instances, setInstances] = useState<WhatsAppInstance[]>([]);
  const [showImportModal, setShowImportModal] = useState(false);
  const [qrModalInstance, setQrModalInstance] = useState<WhatsAppInstance | null>(null);
  const [deleteInstance, setDeleteInstance] = useState<WhatsAppInstance | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState<string>("");
  const [hasEvolutionConfig, setHasEvolutionConfig] = useState(false);

  useEffect(() => {
    checkAuthAndLoad();
  }, [projectId]);

  const checkAuthAndLoad = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Faça login para acessar");
        navigate("/onboarding-tasks/login");
        return;
      }

      // Check if user has access to this project
      const { data: userAccess } = await supabase
        .from("onboarding_users")
        .select("id, role, project:onboarding_projects(id, product_name, onboarding_company_id, company:onboarding_companies(name))")
        .eq("user_id", session.user.id)
        .eq("project_id", projectId)
        .single();

      if (!userAccess || !["client", "gerente"].includes(userAccess.role)) {
        toast.error("Acesso não autorizado");
        navigate("/");
        return;
      }

      setAuthorized(true);
      setCompanyName(
        (userAccess.project as any)?.company?.name || 
        (userAccess.project as any)?.product_name || 
        "Empresa"
      );
      
      await checkEvolutionConfig();
      await fetchInstances();
    } catch (error) {
      console.error("Auth error:", error);
      toast.error("Erro ao verificar acesso");
    } finally {
      setLoading(false);
    }
  };

  const checkEvolutionConfig = async () => {
    const { data } = await supabase
      .from("client_evolution_config")
      .select("id")
      .eq("project_id", projectId)
      .maybeSingle();
    
    setHasEvolutionConfig(!!data);
  };

  const fetchInstances = async () => {
    const { data, error } = await supabase
      .from("whatsapp_instances")
      .select("*")
      .eq("project_id", projectId)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching instances:", error);
      return;
    }
    setInstances(data || []);
  };

  // Get client's Evolution API config
  const getClientConfig = async () => {
    const { data } = await supabase
      .from("client_evolution_config")
      .select("api_url, api_key")
      .eq("project_id", projectId)
      .maybeSingle();
    
    if (!data) {
      throw new Error("Configure sua Evolution API primeiro");
    }
    return data;
  };

  // Call client's own Evolution API directly
  const callClientEvolutionAPI = async (
    endpoint: string,
    method: "GET" | "POST" | "DELETE" = "GET",
    body?: any
  ) => {
    const config = await getClientConfig();
    
    const response = await fetch(`${config.api_url}${endpoint}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        "apikey": config.api_key,
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });

    const data = await response.json().catch(() => ({ error: 'Resposta inválida' }));

    if (!response.ok) {
      const errorMsg = 
        data?.error || 
        data?.response?.message?.join(', ') || 
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
      null;

    if (!raw || typeof raw !== "string") return null;
    return raw.replace(/^data:image\/(png|jpeg);base64,/, "");
  };

  const handleConnect = async (instance: WhatsAppInstance) => {
    const phone = (instance.phone_number || "").replace(/\D/g, "");
    if (!phone || phone.length < 12) {
      toast.error("Número inválido. Use DDI (ex: 5511999999999)");
      return;
    }

    setActionLoading(instance.id);
    try {
      const result = await callClientEvolutionAPI(
        `/instance/connect/${instance.instance_name}?number=${phone}`,
        "GET"
      );

      const base64 = extractQrBase64(result);
      const code = result?.code ?? null;
      const qrPayload = base64 || code;

      if (qrPayload) {
        await supabase
          .from("whatsapp_instances")
          .update({ qr_code: qrPayload, status: "connecting" })
          .eq("id", instance.id);
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
      const result = await callClientEvolutionAPI(
        `/instance/connectionState/${instance.instance_name}`,
        "GET"
      );

      const inst = result?.instance ?? result;
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
      toast.error(error.message || "Erro ao verificar status");
    } finally {
      setActionLoading(null);
    }
  };

  const handleSetDefault = async (instance: WhatsAppInstance) => {
    try {
      await supabase
        .from("whatsapp_instances")
        .update({ is_default: false })
        .eq("project_id", projectId)
        .neq("id", instance.id);

      await supabase
        .from("whatsapp_instances")
        .update({ is_default: true })
        .eq("id", instance.id);

      toast.success(`${instance.display_name} definida como padrão`);
      fetchInstances();
    } catch (error: any) {
      toast.error("Erro ao definir padrão");
    }
  };

  const handleLogout = async (instance: WhatsAppInstance) => {
    setActionLoading(instance.id);
    try {
      await callClientEvolutionAPI(
        `/instance/logout/${instance.instance_name}`,
        "DELETE"
      );
      
      await supabase
        .from("whatsapp_instances")
        .update({ status: "disconnected", qr_code: null })
        .eq("id", instance.id);
      
      toast.success("Logout realizado");
      fetchInstances();
    } catch (error: any) {
      toast.error(error.message || "Erro ao fazer logout");
    } finally {
      setActionLoading(null);
    }
  };

  const handleRestart = async (instance: WhatsAppInstance) => {
    setActionLoading(instance.id);
    try {
      await callClientEvolutionAPI(
        `/instance/restart/${instance.instance_name}`,
        "POST"
      );
      
      await supabase
        .from("whatsapp_instances")
        .update({ status: "disconnected", qr_code: null })
        .eq("id", instance.id);
      
      toast.success("Instância reiniciada");
      fetchInstances();
    } catch (error: any) {
      toast.error(error.message || "Erro ao reiniciar");
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteInstance = async () => {
    if (!deleteInstance) return;

    setActionLoading(deleteInstance.id);
    try {
      await callClientEvolutionAPI(
        `/instance/delete/${deleteInstance.instance_name}`,
        "DELETE"
      );

      await supabase
        .from("whatsapp_instances")
        .delete()
        .eq("id", deleteInstance.id);

      toast.success("Instância excluída");
      setDeleteInstance(null);
      fetchInstances();
    } catch (error: any) {
      toast.error(error.message || "Erro ao excluir");
    } finally {
      setActionLoading(null);
    }
  };

  const handleImportSuccess = () => {
    // Update imported instance with projectId
    fetchInstances();
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

  if (!authorized) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <XCircle className="h-12 w-12 mx-auto text-destructive mb-4" />
            <h2 className="text-xl font-bold mb-2">Acesso Negado</h2>
            <p className="text-muted-foreground">
              Você não tem permissão para acessar esta página.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(`/onboarding-client/${projectId}`)}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-green-500" />
              <div>
                <h1 className="text-xl font-bold">UNV Disparador</h1>
                <p className="text-sm text-muted-foreground">{companyName}</p>
              </div>
            </div>
          </div>
        </div>

        <Tabs defaultValue={hasEvolutionConfig ? "instances" : "config"} className="space-y-4">
          <TabsList>
            <TabsTrigger value="config" className="gap-2">
              <Settings className="h-4 w-4" />
              Configuração
            </TabsTrigger>
            <TabsTrigger value="instances" className="gap-2" disabled={!hasEvolutionConfig}>
              <Phone className="h-4 w-4" />
              Instâncias
            </TabsTrigger>
            <TabsTrigger value="bulk" className="gap-2" disabled={!hasEvolutionConfig}>
              <Send className="h-4 w-4" />
              Disparo em Massa
            </TabsTrigger>
          </TabsList>

          {/* Config Tab */}
          <TabsContent value="config" className="space-y-4">
            <EvolutionConfigForm 
              projectId={projectId!} 
              onConfigured={() => {
                setHasEvolutionConfig(true);
                checkEvolutionConfig();
              }} 
            />
          </TabsContent>

          {/* Instances Tab */}
          <TabsContent value="instances" className="space-y-4">
            {/* Import from Evolution */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Download className="h-5 w-5 text-green-500" />
                  Conectar WhatsApp
                </CardTitle>
                <CardDescription>
                  Importe uma instância da sua Evolution API para usar no disparador
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button onClick={() => setShowImportModal(true)} className="gap-2">
                  <Download className="h-4 w-4" />
                  Importar Instância
                </Button>
              </CardContent>
            </Card>

            {/* Instances List */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Suas Instâncias</CardTitle>
              </CardHeader>
              <CardContent>
                {instances.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Phone className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>Nenhuma instância configurada</p>
                    <p className="text-sm">Importe uma instância do STEVO para começar</p>
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
                            title="Reiniciar"
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
                            title="Excluir"
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

          {/* Bulk Message Tab */}
          <TabsContent value="bulk" className="space-y-4">
            <BulkMessageCampaign projectId={projectId} isClientMode={true} />
          </TabsContent>
        </Tabs>
      </div>

      {/* QR Code Modal */}
      {qrModalInstance && (
        <WhatsAppQRCodeModal
          instance={qrModalInstance}
          onClose={() => {
            setQrModalInstance(null);
            fetchInstances();
          }}
          onConnected={() => {
            setQrModalInstance(null);
            fetchInstances();
          }}
        />
      )}

      {/* Import Modal */}
      <ClientImportInstanceModal
        open={showImportModal}
        onOpenChange={setShowImportModal}
        projectId={projectId!}
        existingInstanceNames={instances.map(i => i.instance_name)}
        onImported={handleImportSuccess}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteInstance} onOpenChange={() => setDeleteInstance(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir instância?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A instância "{deleteInstance?.display_name}" será
              removida permanentemente.
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

export default ClientDisparadorPage;
