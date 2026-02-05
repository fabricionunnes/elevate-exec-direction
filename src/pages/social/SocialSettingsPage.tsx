import { useState, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Save, Instagram, MessageSquare, Check, ExternalLink, Lock, Plus, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { PhoneInput } from "@/components/ui/phone-input";
import { useStaffPermissions } from "@/hooks/useStaffPermissions";

interface ContextType {
  project: { id: string; product_name: string | null; company_name: string | null };
  boardId: string;
}

interface WhatsAppInstance {
  id: string;
  name: string;
  phone_number: string | null;
}

interface InstagramAccount {
  id: string;
  instagram_username: string | null;
  is_connected: boolean;
}

interface ApprovalContact {
  id: string;
  phone: string;
  name: string;
  is_active: boolean;
  isNew?: boolean;
}

export const SocialSettingsPage = () => {
  const { project, boardId } = useOutletContext<ContextType>();
  const { isMaster, loading: permissionsLoading } = useStaffPermissions();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // WhatsApp settings
  const [instances, setInstances] = useState<WhatsAppInstance[]>([]);
  const [selectedInstance, setSelectedInstance] = useState<string>("");
  
  // Approval contacts
  const [approvalContacts, setApprovalContacts] = useState<ApprovalContact[]>([]);
  const [requiredApprovals, setRequiredApprovals] = useState<number>(1);
  
  // Instagram account
  const [instagramAccount, setInstagramAccount] = useState<InstagramAccount | null>(null);
  const [connectingInstagram, setConnectingInstagram] = useState(false);

  useEffect(() => {
    loadSettings();
  }, [project.id, boardId]);

  const loadSettings = async () => {
    setLoading(true);
    try {
      // Load WhatsApp instances
      const { data: instancesData } = await supabase
        .from("whatsapp_instances")
        .select("id, display_name, phone_number")
        .eq("status", "connected")
        .order("display_name");
      
      setInstances((instancesData || []).map(i => ({
        id: i.id,
        name: i.display_name || "Instância",
        phone_number: i.phone_number,
      })));

      // Load current WhatsApp settings
      const { data: whatsappSettings } = await supabase
        .from("social_whatsapp_settings")
        .select("*")
        .eq("project_id", project.id)
        .single();

      if (whatsappSettings) {
        setSelectedInstance(whatsappSettings.whatsapp_instance_id || "");
      }

      // Load approval contacts
      const { data: contactsData } = await supabase
        .from("social_approval_contacts")
        .select("*")
        .eq("project_id", project.id)
        .eq("is_active", true)
        .order("created_at");

      setApprovalContacts((contactsData || []).map(c => ({
        id: c.id,
        phone: c.phone,
        name: c.name || "",
        is_active: c.is_active,
      })));

      // Load board settings for required approvals
      if (boardId) {
        const { data: boardData } = await supabase
          .from("social_content_boards")
          .select("required_approvals")
          .eq("id", boardId)
          .single();

        if (boardData) {
          setRequiredApprovals(boardData.required_approvals || 1);
        }
      }

      // Load Instagram account
      const { data: igAccount } = await supabase
        .from("social_instagram_accounts")
        .select("*")
        .eq("project_id", project.id)
        .single();

      setInstagramAccount(igAccount || null);
    } catch (error) {
      console.error("Error loading settings:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddContact = () => {
    setApprovalContacts(prev => [
      ...prev,
      { id: `new-${Date.now()}`, phone: "", name: "", is_active: true, isNew: true }
    ]);
  };

  const handleRemoveContact = async (index: number) => {
    const contact = approvalContacts[index];
    
    if (!contact.isNew) {
      // Delete from database
      try {
        await supabase
          .from("social_approval_contacts")
          .delete()
          .eq("id", contact.id);
      } catch (error) {
        console.error("Error deleting contact:", error);
        toast.error("Erro ao remover contato");
        return;
      }
    }
    
    setApprovalContacts(prev => prev.filter((_, i) => i !== index));
  };

  const handleContactChange = (index: number, field: "phone" | "name", value: string) => {
    setApprovalContacts(prev => prev.map((c, i) => 
      i === index ? { ...c, [field]: value } : c
    ));
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      // Save WhatsApp instance
      const { error: whatsappError } = await supabase
        .from("social_whatsapp_settings")
        .upsert({
          project_id: project.id,
          whatsapp_instance_id: selectedInstance || null,
          is_active: true,
        }, { onConflict: "project_id" });

      if (whatsappError) throw whatsappError;

      // Save approval contacts
      for (const contact of approvalContacts) {
        if (!contact.phone) continue;
        
        if (contact.isNew) {
          await supabase
            .from("social_approval_contacts")
            .insert({
              project_id: project.id,
              phone: contact.phone,
              name: contact.name || null,
              is_active: true,
            });
        } else {
          await supabase
            .from("social_approval_contacts")
            .update({
              phone: contact.phone,
              name: contact.name || null,
            })
            .eq("id", contact.id);
        }
      }

      // Save required approvals to board
      if (boardId) {
        await supabase
          .from("social_content_boards")
          .update({ required_approvals: requiredApprovals })
          .eq("id", boardId);
      }

      toast.success("Configurações salvas!");
      loadSettings(); // Reload to get updated IDs
    } catch (error) {
      console.error("Error saving settings:", error);
      toast.error("Erro ao salvar configurações");
    } finally {
      setSaving(false);
    }
  };

  const handleConnectInstagram = async () => {
    setConnectingInstagram(true);
    try {
      const { data, error } = await supabase.functions.invoke("social-instagram-auth", {
        body: { projectId: project.id, action: "get_auth_url" },
      });

      if (error) throw error;

      if (data?.authUrl) {
        const popup = window.open(data.authUrl, "instagram_auth", "width=600,height=700");
        if (!popup) {
          toast.error("Popup bloqueado. Permita popups para continuar.");
        }
      }
    } catch (error) {
      console.error("Error connecting Instagram:", error);
      toast.error("Erro ao iniciar conexão com Instagram");
    } finally {
      setConnectingInstagram(false);
    }
  };

  const handleDisconnectInstagram = async () => {
    try {
      const { error } = await supabase
        .from("social_instagram_accounts")
        .update({ is_connected: false, access_token: null })
        .eq("project_id", project.id);

      if (error) throw error;
      
      setInstagramAccount((prev) => prev ? { ...prev, is_connected: false } : null);
      toast.success("Instagram desconectado");
    } catch (error) {
      console.error("Error disconnecting Instagram:", error);
      toast.error("Erro ao desconectar Instagram");
    }
  };

  if (loading || permissionsLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const activeContactCount = approvalContacts.filter(c => c.phone).length;

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      {/* Instagram Connection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Instagram className="h-5 w-5" />
            Conexão com Instagram
          </CardTitle>
          <CardDescription>
            Conecte a conta do Instagram do cliente para publicação automática
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {instagramAccount?.is_connected ? (
            <div className="flex items-center justify-between p-4 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-800">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center">
                  <Instagram className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="font-medium">@{instagramAccount.instagram_username}</p>
                  <p className="text-sm text-green-600 dark:text-green-400 flex items-center gap-1">
                    <Check className="h-3 w-3" /> Conectado
                  </p>
                </div>
              </div>
              <Button variant="outline" onClick={handleDisconnectInstagram}>
                Desconectar
              </Button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4 p-6 border-2 border-dashed rounded-lg">
              <div className="h-16 w-16 rounded-full bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center">
                <Instagram className="h-8 w-8 text-white" />
              </div>
              <div className="text-center">
                <p className="font-medium">Nenhuma conta conectada</p>
                <p className="text-sm text-muted-foreground">
                  Conecte o Instagram do cliente para publicar automaticamente
                </p>
              </div>
              <Button onClick={handleConnectInstagram} disabled={connectingInstagram} className="gap-2">
                {connectingInstagram ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ExternalLink className="h-4 w-4" />
                )}
                Conectar Instagram
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* WhatsApp Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Notificações WhatsApp
          </CardTitle>
          <CardDescription>
            Configure o envio automático de links de aprovação
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* WhatsApp Instance */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              Instância WhatsApp
              {!isMaster && (
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <Lock className="h-3 w-3" />
                  Somente Master
                </span>
              )}
            </Label>
            <Select 
              value={selectedInstance} 
              onValueChange={setSelectedInstance}
              disabled={!isMaster}
            >
              <SelectTrigger className={!isMaster ? "bg-muted cursor-not-allowed" : ""}>
                <SelectValue placeholder="Selecione uma instância" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhuma</SelectItem>
                {instances.map((instance) => (
                  <SelectItem key={instance.id} value={instance.id}>
                    {instance.name} {instance.phone_number ? `(${instance.phone_number})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Approval Contacts */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Contatos para Aprovação
              </Label>
              <Button variant="outline" size="sm" onClick={handleAddContact} className="gap-1">
                <Plus className="h-3 w-3" />
                Adicionar
              </Button>
            </div>
            
            {approvalContacts.length === 0 ? (
              <div className="text-center py-4 text-sm text-muted-foreground border-2 border-dashed rounded-lg">
                Nenhum contato cadastrado. Adicione telefones para receber links de aprovação.
              </div>
            ) : (
              <div className="space-y-3">
                {approvalContacts.map((contact, index) => (
                  <div key={contact.id} className="flex items-start gap-2 p-3 border rounded-lg bg-muted/30">
                    <div className="flex-1 grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Nome</Label>
                        <Input
                          placeholder="Nome do contato"
                          value={contact.name}
                          onChange={(e) => handleContactChange(index, "name", e.target.value)}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Telefone</Label>
                        <PhoneInput
                          value={contact.phone}
                          onChange={(value) => handleContactChange(index, "phone", value)}
                          placeholder="(00) 00000-0000"
                        />
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive mt-5"
                      onClick={() => handleRemoveContact(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Required Approvals */}
          <div className="space-y-2">
            <Label>Aprovações Necessárias</Label>
            <Select 
              value={requiredApprovals.toString()} 
              onValueChange={(v) => setRequiredApprovals(parseInt(v))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 aprovação</SelectItem>
                <SelectItem value="2" disabled={activeContactCount < 2}>
                  2 aprovações {activeContactCount < 2 && "(adicione mais contatos)"}
                </SelectItem>
                <SelectItem value="3" disabled={activeContactCount < 3}>
                  3 aprovações {activeContactCount < 3 && "(adicione mais contatos)"}
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Quantas pessoas precisam aprovar antes de publicar
            </p>
          </div>

          <Button onClick={handleSaveSettings} disabled={saving} className="w-full gap-2">
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Salvar Configurações
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};
