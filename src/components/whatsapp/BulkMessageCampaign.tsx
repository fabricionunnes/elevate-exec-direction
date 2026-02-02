import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
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
import {
  Upload,
  Send,
  Calendar,
  Users,
  FileSpreadsheet,
  Play,
  Pause,
  XCircle,
  CheckCircle2,
  Clock,
  Loader2,
  Plus,
  Trash2,
  Eye,
  RefreshCw,
  Database,
  Edit3,
  MessageSquare,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import Papa from "papaparse";
import { GroupSelector } from "./GroupSelector";
import { SavedListsManager } from "./SavedListsManager";
import { MediaUploader } from "./MediaUploader";

interface WhatsAppInstance {
  id: string;
  instance_name: string;
  display_name: string;
  status: string;
}

interface Campaign {
  id: string;
  name: string;
  message_template: string;
  instance_id: string | null;
  status: string;
  scheduled_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  total_recipients: number;
  sent_count: number;
  failed_count: number;
  delay_between_messages: number;
  created_at: string;
  instance?: { display_name: string } | null;
}

interface Recipient {
  id: string;
  campaign_id: string;
  phone_number: string;
  name: string | null;
  company: string | null;
  custom_vars: Record<string, string>;
  status: string;
  sent_at: string | null;
  error_message: string | null;
}

interface CRMContact {
  id: string;
  name: string;
  phone_number: string;
  company_name?: string;
}

interface BulkMessageCampaignProps {
  projectId?: string;
  isClientMode?: boolean;
}

export const BulkMessageCampaign = ({ projectId, isClientMode = false }: BulkMessageCampaignProps) => {
  const [instances, setInstances] = useState<WhatsAppInstance[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("campaigns");
  
  // New campaign modal
  const [showNewCampaign, setShowNewCampaign] = useState(false);
  const [newCampaign, setNewCampaign] = useState({
    name: "",
    message_template: "",
    instance_id: "",
    delay_between_messages: 3,
    scheduled_at: "",
    media_type: null as "image" | "video" | "audio" | "document" | null,
    media_url: null as string | null,
  });
  const [saving, setSaving] = useState(false);
  
  // Recipients
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [importedContacts, setImportedContacts] = useState<Array<{
    phone_number: string;
    name: string;
    company: string;
    [key: string]: string;
  }>>([]);
  
  // Campaign details modal
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [campaignRecipients, setCampaignRecipients] = useState<Recipient[]>([]);
  const [loadingRecipients, setLoadingRecipients] = useState(false);
  
  // CRM contacts modal
  const [showCRMContacts, setShowCRMContacts] = useState(false);
  const [crmContacts, setCrmContacts] = useState<CRMContact[]>([]);
  const [selectedCRMContacts, setSelectedCRMContacts] = useState<Set<string>>(new Set());
  const [loadingCRM, setLoadingCRM] = useState(false);
  
  // Manual contacts input
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualContactsText, setManualContactsText] = useState("");
  
  // Group selection
  const [showGroupSelector, setShowGroupSelector] = useState(false);
  const [selectedGroups, setSelectedGroups] = useState<Array<{
    id: string;
    name: string;
    size: number;
  }>>([]);
  
  // Delete confirmation
  const [campaignToDelete, setCampaignToDelete] = useState<Campaign | null>(null);

  useEffect(() => {
    loadData();
    
    // Subscribe to realtime updates
    const campaignsChannel = supabase
      .channel('campaigns-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'whatsapp_campaigns' }, () => {
        loadCampaigns();
      })
      .subscribe();
    
    return () => {
      supabase.removeChannel(campaignsChannel);
    };
  }, []);

  const loadData = async () => {
    setLoading(true);
    await Promise.all([loadInstances(), loadCampaigns()]);
    setLoading(false);
  };

  const loadInstances = async () => {
    let query = supabase
      .from("whatsapp_instances")
      .select("id, instance_name, display_name, status")
      .eq("status", "connected");
    
    // Filter by project in client mode
    if (projectId) {
      query = query.eq("project_id", projectId);
    } else if (!isClientMode) {
      // Admin sees global instances (project_id is null)
      query = query.is("project_id", null);
    }
    
    const { data } = await query;
    setInstances(data || []);
  };

  const loadCampaigns = async () => {
    let query = supabase
      .from("whatsapp_campaigns")
      .select(`
        *,
        instance:whatsapp_instances(display_name)
      `);
    
    // Filter by project in client mode
    if (projectId) {
      query = query.eq("project_id", projectId);
    } else if (!isClientMode) {
      // Admin sees global campaigns (project_id is null)
      query = query.is("project_id", null);
    }
    
    const { data } = await query.order("created_at", { ascending: false });
    setCampaigns((data as Campaign[]) || []);
  };

  const loadCampaignRecipients = async (campaignId: string) => {
    setLoadingRecipients(true);
    const { data } = await supabase
      .from("whatsapp_campaign_recipients")
      .select("*")
      .eq("campaign_id", campaignId)
      .order("created_at", { ascending: true });
    setCampaignRecipients((data as Recipient[]) || []);
    setLoadingRecipients(false);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const contacts = results.data.map((row: any) => ({
          phone_number: (row.telefone || row.phone || row.phone_number || row.celular || "").replace(/\D/g, ""),
          name: row.nome || row.name || "",
          company: row.empresa || row.company || "",
          ...row,
        })).filter((c: any) => c.phone_number.length >= 10);

        if (contacts.length === 0) {
          toast.error("Nenhum contato válido encontrado. Verifique se há uma coluna 'telefone' ou 'phone'.");
          return;
        }

        setImportedContacts(contacts);
        toast.success(`${contacts.length} contatos importados`);
      },
      error: (error) => {
        toast.error("Erro ao ler arquivo: " + error.message);
      },
    });
  };

  const loadCRMContacts = async () => {
    setLoadingCRM(true);
    const { data } = await supabase
      .from("crm_whatsapp_contacts")
      .select("id, name, phone_number")
      .not("phone_number", "is", null)
      .order("name");
    
    setCrmContacts((data || []).map((c: any) => ({
      id: c.id,
      name: c.name || "Sem nome",
      phone_number: c.phone_number,
    })));
    setLoadingCRM(false);
  };

  const handleAddCRMContacts = () => {
    const selectedContacts = crmContacts.filter(c => selectedCRMContacts.has(c.id));
    const newContacts = selectedContacts.map(c => ({
      phone_number: c.phone_number.replace(/\D/g, ""),
      name: c.name,
      company: "",
    }));
    
    // Merge with existing, avoiding duplicates
    const existingPhones = new Set(importedContacts.map(c => c.phone_number));
    const uniqueNew = newContacts.filter(c => !existingPhones.has(c.phone_number));
    
    setImportedContacts([...importedContacts, ...uniqueNew]);
    setShowCRMContacts(false);
    setSelectedCRMContacts(new Set());
    toast.success(`${uniqueNew.length} contatos adicionados`);
  };

  const handleAddManualContacts = () => {
    if (!manualContactsText.trim()) {
      toast.error("Digite pelo menos um contato");
      return;
    }

    const lines = manualContactsText.trim().split("\n").filter(line => line.trim());
    const newContacts: Array<{ phone_number: string; name: string; company: string }> = [];
    
    for (const line of lines) {
      // Formato esperado: telefone | nome | empresa (nome e empresa são opcionais)
      // ou apenas: telefone
      const parts = line.split(/[|;,\t]/).map(p => p.trim());
      const phone = parts[0]?.replace(/\D/g, "") || "";
      
      if (phone.length >= 10) {
        newContacts.push({
          phone_number: phone,
          name: parts[1] || "",
          company: parts[2] || "",
        });
      }
    }

    if (newContacts.length === 0) {
      toast.error("Nenhum telefone válido encontrado. Verifique o formato (mínimo 10 dígitos).");
      return;
    }

    // Merge with existing, avoiding duplicates
    const existingPhones = new Set(importedContacts.map(c => c.phone_number));
    const uniqueNew = newContacts.filter(c => !existingPhones.has(c.phone_number));
    
    setImportedContacts([...importedContacts, ...uniqueNew]);
    setShowManualInput(false);
    setManualContactsText("");
    toast.success(`${uniqueNew.length} contatos adicionados`);
  };

  const handleCreateCampaign = async () => {
    if (!newCampaign.name.trim() || !newCampaign.message_template.trim()) {
      toast.error("Preencha o nome e a mensagem da campanha");
      return;
    }
    if (!newCampaign.instance_id) {
      toast.error("Selecione uma instância do WhatsApp");
      return;
    }
    // Allow either contacts OR groups (or both)
    if (importedContacts.length === 0 && selectedGroups.length === 0) {
      toast.error("Importe pelo menos um contato ou selecione um grupo");
      return;
    }

    setSaving(true);
    try {
      // Get current user info - use auth.uid() for RLS
      const { data: { user } } = await supabase.auth.getUser();
      const createdBy = user?.id || null;

      // Combine contacts + groups as recipients
      const totalRecipients = importedContacts.length + selectedGroups.length;

      // Convert scheduled_at to São Paulo timezone (UTC-3) for proper storage
      let scheduledAtISO: string | null = null;
      if (newCampaign.scheduled_at) {
        // datetime-local gives us "2026-02-03T14:00" - treat this as São Paulo time
        // São Paulo is UTC-3, so we append the offset
        scheduledAtISO = `${newCampaign.scheduled_at}:00-03:00`;
      }

      // Create campaign
      const { data: campaign, error: campaignError } = await supabase
        .from("whatsapp_campaigns")
        .insert({
          name: newCampaign.name.trim(),
          message_template: newCampaign.message_template.trim(),
          instance_id: newCampaign.instance_id,
          delay_between_messages: newCampaign.delay_between_messages,
          scheduled_at: scheduledAtISO,
          status: newCampaign.scheduled_at ? "scheduled" : "draft",
          total_recipients: totalRecipients,
          created_by: createdBy,
          project_id: projectId || null,
          media_type: newCampaign.media_type || null,
          media_url: newCampaign.media_url || null,
          media_caption: newCampaign.message_template.trim() || null,
        })
        .select()
        .single();

      if (campaignError) throw campaignError;

      // Insert contact recipients
      const recipientsToInsert: Array<{
        campaign_id: string;
        phone_number: string;
        name: string | null;
        company: string | null;
        custom_vars: Record<string, any>;
      }> = [];

      // Add individual contacts
      for (const c of importedContacts) {
        recipientsToInsert.push({
          campaign_id: campaign.id,
          phone_number: c.phone_number,
          name: c.name || null,
          company: c.company || null,
          custom_vars: Object.fromEntries(
            Object.entries(c).filter(([k]) => !["phone_number", "name", "company"].includes(k))
          ),
        });
      }

      // Add groups as recipients (using JID as phone_number with @g.us suffix)
      for (const group of selectedGroups) {
        recipientsToInsert.push({
          campaign_id: campaign.id,
          phone_number: group.id, // JID like "120363XXX@g.us"
          name: group.name,
          company: null,
          custom_vars: { 
            is_group: "true", 
            group_size: String(group.size) 
          },
        });
      }

      const { error: recipientsError } = await supabase
        .from("whatsapp_campaign_recipients")
        .insert(recipientsToInsert);

      if (recipientsError) throw recipientsError;

      toast.success("Campanha criada com sucesso!");
      setShowNewCampaign(false);
      setNewCampaign({
        name: "",
        message_template: "",
        instance_id: "",
        delay_between_messages: 3,
        scheduled_at: "",
        media_type: null,
        media_url: null,
      });
      setImportedContacts([]);
      setSelectedGroups([]);
      loadCampaigns();
    } catch (error: any) {
      toast.error(error.message || "Erro ao criar campanha");
    } finally {
      setSaving(false);
    }
  };

  const handleStartCampaign = async (campaign: Campaign) => {
    try {
      // Call edge function to start processing
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-bulk-send`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ campaignId: campaign.id, action: "start" }),
        }
      );

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || "Erro ao iniciar campanha");
      }

      toast.success("Campanha iniciada!");
      loadCampaigns();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handlePauseCampaign = async (campaign: Campaign) => {
    await supabase
      .from("whatsapp_campaigns")
      .update({ status: "paused" })
      .eq("id", campaign.id);
    toast.info("Campanha pausada");
    loadCampaigns();
  };

  const handleCancelCampaign = async (campaign: Campaign) => {
    await supabase
      .from("whatsapp_campaigns")
      .update({ status: "cancelled" })
      .eq("id", campaign.id);
    toast.info("Campanha cancelada");
    loadCampaigns();
  };

  const handleDeleteCampaign = async () => {
    if (!campaignToDelete) return;
    
    await supabase
      .from("whatsapp_campaigns")
      .delete()
      .eq("id", campaignToDelete.id);
    
    toast.success("Campanha excluída");
    setCampaignToDelete(null);
    loadCampaigns();
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "draft":
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Rascunho</Badge>;
      case "scheduled":
        return <Badge className="bg-blue-500"><Calendar className="h-3 w-3 mr-1" />Agendada</Badge>;
      case "running":
        return <Badge className="bg-yellow-500"><Loader2 className="h-3 w-3 mr-1 animate-spin" />Enviando</Badge>;
      case "paused":
        return <Badge variant="outline"><Pause className="h-3 w-3 mr-1" />Pausada</Badge>;
      case "completed":
        return <Badge className="bg-green-500"><CheckCircle2 className="h-3 w-3 mr-1" />Concluída</Badge>;
      case "cancelled":
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Cancelada</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getRecipientStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="secondary">Pendente</Badge>;
      case "sent":
        return <Badge className="bg-green-500">Enviado</Badge>;
      case "failed":
        return <Badge variant="destructive">Falhou</Badge>;
      case "skipped":
        return <Badge variant="outline">Ignorado</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getProgress = (campaign: Campaign) => {
    if (campaign.total_recipients === 0) return 0;
    return Math.round(((campaign.sent_count + campaign.failed_count) / campaign.total_recipients) * 100);
  };

  const previewMessage = (template: string, recipient?: { name?: string; company?: string; [key: string]: any }) => {
    let message = template;
    if (recipient) {
      message = message.replace(/\{\{nome\}\}/gi, recipient.name || "");
      message = message.replace(/\{\{empresa\}\}/gi, recipient.company || "");
      // Replace any custom vars
      Object.entries(recipient).forEach(([key, value]) => {
        if (typeof value === "string") {
          message = message.replace(new RegExp(`\\{\\{${key}\\}\\}`, "gi"), value);
        }
      });
    }
    return message;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Send className="h-5 w-5" />
            Disparo em Massa
          </h2>
          <p className="text-sm text-muted-foreground">
            Envie mensagens personalizadas para múltiplos contatos
          </p>
        </div>
        <Button onClick={() => setShowNewCampaign(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Nova Campanha
        </Button>
      </div>

      {instances.length === 0 && (
        <Card className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950">
          <CardContent className="pt-4">
            <p className="text-sm text-yellow-700 dark:text-yellow-300">
              ⚠️ Nenhuma instância do WhatsApp conectada. Conecte uma instância na aba "Instâncias" para fazer disparos.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Campaigns List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Campanhas</CardTitle>
        </CardHeader>
        <CardContent>
          {campaigns.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Send className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Nenhuma campanha criada ainda</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Campanha</TableHead>
                  <TableHead>Instância</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Progresso</TableHead>
                  <TableHead>Agendamento</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaigns.map((campaign) => (
                  <TableRow key={campaign.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{campaign.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {campaign.total_recipients} destinatários
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      {campaign.instance?.display_name || "-"}
                    </TableCell>
                    <TableCell>{getStatusBadge(campaign.status)}</TableCell>
                    <TableCell>
                      <div className="w-32">
                        <Progress value={getProgress(campaign)} className="h-2" />
                        <p className="text-xs text-muted-foreground mt-1">
                          {campaign.sent_count}/{campaign.total_recipients} enviados
                          {campaign.failed_count > 0 && (
                            <span className="text-destructive"> ({campaign.failed_count} falhas)</span>
                          )}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      {campaign.scheduled_at
                        ? format(new Date(campaign.scheduled_at), "dd/MM/yyyy HH:mm", { locale: ptBR })
                        : "-"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setSelectedCampaign(campaign);
                            loadCampaignRecipients(campaign.id);
                          }}
                          title="Ver detalhes"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        
                        {campaign.status === "draft" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleStartCampaign(campaign)}
                            title="Iniciar envio"
                            className="text-green-600"
                          >
                            <Play className="h-4 w-4" />
                          </Button>
                        )}
                        
                        {campaign.status === "running" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handlePauseCampaign(campaign)}
                            title="Pausar"
                          >
                            <Pause className="h-4 w-4" />
                          </Button>
                        )}
                        
                        {campaign.status === "paused" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleStartCampaign(campaign)}
                            title="Continuar"
                            className="text-green-600"
                          >
                            <Play className="h-4 w-4" />
                          </Button>
                        )}
                        
                        {["draft", "scheduled", "paused"].includes(campaign.status) && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleCancelCampaign(campaign)}
                            title="Cancelar"
                            className="text-destructive"
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                        )}
                        
                        {["draft", "completed", "cancelled"].includes(campaign.status) && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setCampaignToDelete(campaign)}
                            title="Excluir"
                            className="text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* New Campaign Modal */}
      <Dialog open={showNewCampaign} onOpenChange={setShowNewCampaign}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nova Campanha de Disparo</DialogTitle>
            <DialogDescription>
              Crie uma campanha para enviar mensagens em massa
            </DialogDescription>
          </DialogHeader>
          
          <Tabs defaultValue="config" className="mt-4">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="config">1. Configuração</TabsTrigger>
              <TabsTrigger value="contacts">2. Contatos ({importedContacts.length})</TabsTrigger>
              <TabsTrigger value="preview">3. Pré-visualização</TabsTrigger>
            </TabsList>
            
            <TabsContent value="config" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Nome da Campanha</Label>
                <Input
                  value={newCampaign.name}
                  onChange={(e) => setNewCampaign({ ...newCampaign, name: e.target.value })}
                  placeholder="Ex: Promoção Janeiro"
                />
              </div>
              
              <div className="space-y-2">
                <Label>Instância do WhatsApp</Label>
                <Select
                  value={newCampaign.instance_id}
                  onValueChange={(v) => setNewCampaign({ ...newCampaign, instance_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma instância" />
                  </SelectTrigger>
                  <SelectContent>
                    {instances.map((instance) => (
                      <SelectItem key={instance.id} value={instance.id}>
                        {instance.display_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {/* Media Uploader */}
              <MediaUploader
                mediaType={newCampaign.media_type}
                mediaUrl={newCampaign.media_url}
                onMediaChange={(type, url) => 
                  setNewCampaign({ ...newCampaign, media_type: type, media_url: url })
                }
              />
              
              <div className="space-y-2">
                <Label>{newCampaign.media_type ? "Legenda / Mensagem" : "Mensagem"}</Label>
                <Textarea
                  value={newCampaign.message_template}
                  onChange={(e) => setNewCampaign({ ...newCampaign, message_template: e.target.value })}
                  placeholder={newCampaign.media_type 
                    ? "Escreva uma legenda para a mídia (opcional)..." 
                    : "Olá {{nome}}, temos uma oferta especial para você!"
                  }
                  rows={newCampaign.media_type ? 3 : 5}
                />
                <p className="text-xs text-muted-foreground">
                  Use variáveis: {"{{nome}}"}, {"{{empresa}}"}, ou qualquer coluna do seu CSV
                </p>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Intervalo entre mensagens (segundos)</Label>
                  <Input
                    type="number"
                    min={1}
                    max={60}
                    value={newCampaign.delay_between_messages}
                    onChange={(e) => setNewCampaign({ ...newCampaign, delay_between_messages: parseInt(e.target.value) || 3 })}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>Agendar para (opcional)</Label>
                  <Input
                    type="datetime-local"
                    value={newCampaign.scheduled_at}
                    onChange={(e) => setNewCampaign({ ...newCampaign, scheduled_at: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">Horário de Brasília (UTC-3)</p>
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="contacts" className="space-y-4 mt-4">
              {/* Saved Lists Manager */}
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Importe via CSV, selecione do CRM, digite manualmente ou escolha grupos do WhatsApp
                </p>
                <SavedListsManager
                  instanceId={newCampaign.instance_id}
                  currentContacts={importedContacts}
                  currentGroups={selectedGroups}
                  onLoadContacts={(contacts) => {
                    const existingPhones = new Set(importedContacts.map(c => c.phone_number));
                    const uniqueNew = contacts.filter(c => !existingPhones.has(c.phone_number));
                    setImportedContacts([...importedContacts, ...uniqueNew]);
                  }}
                  onLoadGroups={(groups) => {
                    const existingIds = new Set(selectedGroups.map(g => g.id));
                    const uniqueNew = groups.filter(g => !existingIds.has(g.id));
                    setSelectedGroups([...selectedGroups, ...uniqueNew]);
                  }}
                />
              </div>

              <div className="flex gap-2">
                <div className="flex-1">
                  <Label
                    htmlFor="csv-upload"
                    className="flex items-center justify-center gap-2 p-4 border-2 border-dashed rounded-lg cursor-pointer hover:border-primary transition-colors"
                  >
                    <FileSpreadsheet className="h-5 w-5" />
                    Importar CSV/Excel
                  </Label>
                  <Input
                    id="csv-upload"
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                </div>
                
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowCRMContacts(true);
                    loadCRMContacts();
                  }}
                >
                  <Database className="h-4 w-4 mr-2" />
                  Do CRM
                </Button>
                
                <Button
                  variant="outline"
                  onClick={() => setShowManualInput(true)}
                >
                  <Edit3 className="h-4 w-4 mr-2" />
                  Digitar
                </Button>
                
                <Button
                  variant="outline"
                  onClick={() => {
                    if (!newCampaign.instance_id) {
                      toast.error("Selecione uma instância do WhatsApp primeiro");
                      return;
                    }
                    setShowGroupSelector(true);
                  }}
                  className="border-green-500 text-green-700 hover:bg-green-50"
                >
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Grupos
                </Button>
              </div>
              
              {/* Selected Groups Display */}
              {selectedGroups.length > 0 && (
                <div className="border rounded-lg border-green-500/50 bg-green-50/50 dark:bg-green-950/20">
                  <div className="flex items-center justify-between p-2 border-b border-green-500/30 bg-green-100/50 dark:bg-green-900/20">
                    <span className="text-sm font-medium flex items-center gap-2">
                      <MessageSquare className="h-4 w-4 text-green-600" />
                      {selectedGroups.length} grupo(s) selecionado(s)
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedGroups([])}
                      className="text-destructive"
                    >
                      Limpar
                    </Button>
                  </div>
                  <div className="p-2 space-y-2">
                    {selectedGroups.map((group) => (
                      <div
                        key={group.id}
                        className="flex items-center justify-between p-2 bg-white dark:bg-background rounded border"
                      >
                        <div>
                          <p className="font-medium text-sm">{group.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {group.size} participantes
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            setSelectedGroups((prev) =>
                              prev.filter((g) => g.id !== group.id)
                            )
                          }
                          className="h-8 w-8 text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {importedContacts.length > 0 && (
                <div className="border rounded-lg">
                  <div className="flex items-center justify-between p-2 border-b bg-muted">
                    <span className="text-sm font-medium">{importedContacts.length} contatos</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setImportedContacts([])}
                      className="text-destructive"
                    >
                      Limpar
                    </Button>
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Telefone</TableHead>
                          <TableHead>Nome</TableHead>
                          <TableHead>Empresa</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {importedContacts.slice(0, 50).map((contact, i) => (
                          <TableRow key={i}>
                            <TableCell className="font-mono text-sm">{contact.phone_number}</TableCell>
                            <TableCell>{contact.name || "-"}</TableCell>
                            <TableCell>{contact.company || "-"}</TableCell>
                          </TableRow>
                        ))}
                        {importedContacts.length > 50 && (
                          <TableRow>
                            <TableCell colSpan={3} className="text-center text-muted-foreground">
                              ... e mais {importedContacts.length - 50} contatos
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="preview" className="space-y-4 mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Pré-visualização da Mensagem</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="bg-green-100 dark:bg-green-900 rounded-lg p-4 max-w-md">
                    <p className="whitespace-pre-wrap">
                      {previewMessage(
                        newCampaign.message_template || "Sua mensagem aparecerá aqui...",
                        importedContacts[0]
                      )}
                    </p>
                  </div>
                  {importedContacts[0] && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Exemplo usando o primeiro contato: {importedContacts[0].name || importedContacts[0].phone_number}
                    </p>
                  )}
                </CardContent>
              </Card>
              
              <div className="p-4 bg-muted rounded-lg">
                <h4 className="font-medium mb-2">Resumo da Campanha</h4>
                <ul className="text-sm space-y-1 text-muted-foreground">
                  <li>• Nome: {newCampaign.name || "(não definido)"}</li>
                  <li>• Destinatários: {importedContacts.length}</li>
                  <li>• Intervalo: {newCampaign.delay_between_messages}s entre mensagens</li>
                  <li>• Agendamento: {newCampaign.scheduled_at ? format(new Date(newCampaign.scheduled_at), "dd/MM/yyyy HH:mm") : "Envio imediato (rascunho)"}</li>
                  <li>• Tempo estimado: ~{Math.ceil((importedContacts.length * newCampaign.delay_between_messages) / 60)} minutos</li>
                </ul>
              </div>
            </TabsContent>
          </Tabs>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewCampaign(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreateCampaign} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
              Criar Campanha
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Campaign Details Modal */}
      <Dialog open={!!selectedCampaign} onOpenChange={() => setSelectedCampaign(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedCampaign?.name}</DialogTitle>
            <DialogDescription>
              Detalhes e destinatários da campanha
            </DialogDescription>
          </DialogHeader>
          
          {selectedCampaign && (
            <div className="space-y-4">
              <div className="grid grid-cols-4 gap-4">
                <Card>
                  <CardContent className="pt-4">
                    <p className="text-2xl font-bold">{selectedCampaign.total_recipients}</p>
                    <p className="text-sm text-muted-foreground">Total</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <p className="text-2xl font-bold text-green-600">{selectedCampaign.sent_count}</p>
                    <p className="text-sm text-muted-foreground">Enviados</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <p className="text-2xl font-bold text-destructive">{selectedCampaign.failed_count}</p>
                    <p className="text-sm text-muted-foreground">Falhas</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <p className="text-2xl font-bold">
                      {selectedCampaign.total_recipients - selectedCampaign.sent_count - selectedCampaign.failed_count}
                    </p>
                    <p className="text-sm text-muted-foreground">Pendentes</p>
                  </CardContent>
                </Card>
              </div>
              
              <div className="p-4 bg-muted rounded-lg">
                <h4 className="font-medium mb-2">Mensagem</h4>
                <p className="whitespace-pre-wrap text-sm">{selectedCampaign.message_template}</p>
              </div>
              
              <div className="flex items-center justify-between">
                <h4 className="font-medium">Destinatários</h4>
                <Button variant="ghost" size="sm" onClick={() => loadCampaignRecipients(selectedCampaign.id)}>
                  <RefreshCw className="h-4 w-4 mr-1" />
                  Atualizar
                </Button>
              </div>
              
              {loadingRecipients ? (
                <div className="flex justify-center p-4">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : (
                <div className="border rounded-lg max-h-64 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Telefone</TableHead>
                        <TableHead>Nome</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Enviado em</TableHead>
                        <TableHead>Erro</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {campaignRecipients.map((recipient) => (
                        <TableRow key={recipient.id}>
                          <TableCell className="font-mono text-sm">{recipient.phone_number}</TableCell>
                          <TableCell>{recipient.name || "-"}</TableCell>
                          <TableCell>{getRecipientStatusBadge(recipient.status)}</TableCell>
                          <TableCell>
                            {recipient.sent_at
                              ? format(new Date(recipient.sent_at), "dd/MM HH:mm")
                              : "-"}
                          </TableCell>
                          <TableCell className="text-destructive text-xs max-w-xs truncate">
                            {recipient.error_message || "-"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* CRM Contacts Modal */}
      <Dialog open={showCRMContacts} onOpenChange={setShowCRMContacts}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Selecionar Contatos do CRM</DialogTitle>
          </DialogHeader>
          
          {loadingCRM ? (
            <div className="flex justify-center p-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {selectedCRMContacts.size} selecionados de {crmContacts.length}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (selectedCRMContacts.size === crmContacts.length) {
                      setSelectedCRMContacts(new Set());
                    } else {
                      setSelectedCRMContacts(new Set(crmContacts.map(c => c.id)));
                    }
                  }}
                >
                  {selectedCRMContacts.size === crmContacts.length ? "Desmarcar todos" : "Selecionar todos"}
                </Button>
              </div>
              
              <div className="border rounded-lg max-h-64 overflow-y-auto">
                {crmContacts.map((contact) => (
                  <div
                    key={contact.id}
                    className={`flex items-center gap-3 p-3 border-b cursor-pointer hover:bg-muted ${
                      selectedCRMContacts.has(contact.id) ? "bg-primary/10" : ""
                    }`}
                    onClick={() => {
                      const newSet = new Set(selectedCRMContacts);
                      if (newSet.has(contact.id)) {
                        newSet.delete(contact.id);
                      } else {
                        newSet.add(contact.id);
                      }
                      setSelectedCRMContacts(newSet);
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedCRMContacts.has(contact.id)}
                      readOnly
                      className="rounded"
                    />
                    <div className="flex-1">
                      <p className="font-medium">{contact.name}</p>
                      <p className="text-sm text-muted-foreground">{contact.phone_number}</p>
                    </div>
                  </div>
                ))}
                {crmContacts.length === 0 && (
                  <p className="text-center py-8 text-muted-foreground">
                    Nenhum contato encontrado no CRM
                  </p>
                )}
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCRMContacts(false)}>
              Cancelar
            </Button>
            <Button onClick={handleAddCRMContacts} disabled={selectedCRMContacts.size === 0}>
              Adicionar {selectedCRMContacts.size} contatos
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manual Contacts Input Modal */}
      <Dialog open={showManualInput} onOpenChange={setShowManualInput}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit3 className="h-5 w-5" />
              Digitar Contatos
            </DialogTitle>
            <DialogDescription>
              Digite os contatos manualmente, um por linha
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Contatos</Label>
              <Textarea
                value={manualContactsText}
                onChange={(e) => setManualContactsText(e.target.value)}
                placeholder={`Formato: telefone | nome | empresa (nome e empresa são opcionais)\n\nExemplos:\n11999998888\n11988887777 | João Silva\n11977776666 | Maria Santos | Empresa XYZ`}
                rows={10}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Separadores aceitos: | ; , ou Tab
              </p>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowManualInput(false)}>
              Cancelar
            </Button>
            <Button onClick={handleAddManualContacts}>
              Adicionar Contatos
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!campaignToDelete} onOpenChange={() => setCampaignToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Campanha?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A campanha "{campaignToDelete?.name}" e todos os seus destinatários serão excluídos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteCampaign} className="bg-destructive text-destructive-foreground">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Group Selector Modal */}
      <GroupSelector
        open={showGroupSelector}
        onOpenChange={setShowGroupSelector}
        instanceId={newCampaign.instance_id}
        onSelectGroups={(groups) => {
          // Merge with existing, avoiding duplicates
          const existingIds = new Set(selectedGroups.map((g) => g.id));
          const uniqueNew = groups.filter((g) => !existingIds.has(g.id));
          setSelectedGroups([...selectedGroups, ...uniqueNew]);
          toast.success(`${uniqueNew.length} grupo(s) adicionado(s)`);
        }}
      />
    </div>
  );
};
