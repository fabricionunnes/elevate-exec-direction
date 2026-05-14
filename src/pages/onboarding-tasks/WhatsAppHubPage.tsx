import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { NexusHeader } from "@/components/onboarding-tasks/NexusHeader";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Wifi, WifiOff, Settings2, MessageSquare, Users } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useStaffPermissions } from "@/hooks/useStaffPermissions";
import { WhatsAppHubConversationList } from "@/components/whatsapp-hub/WhatsAppHubConversationList";
import { WhatsAppHubChat } from "@/components/whatsapp-hub/WhatsAppHubChat";
import { WhatsAppHubContactPanel } from "@/components/whatsapp-hub/WhatsAppHubContactPanel";
import { WhatsAppHubConnectDialog } from "@/components/whatsapp-hub/WhatsAppHubConnectDialog";
import { WhatsAppBulkSendDialog } from "@/components/whatsapp-hub/WhatsAppBulkSendDialog";

export interface StaffInstance {
  id: string;
  instance_name: string;
  display_name: string | null;
  phone_number: string | null;
  status: string | null;
  qr_code: string | null;
  can_view?: boolean;
  can_send?: boolean;
}

export interface HubConversation {
  id: string;
  instance_id: string | null;
  official_instance_id?: string | null;
  lead_id?: string | null;
  contact_name: string | null;
  contact_phone: string;
  contact_photo_url: string | null;
  project_id: string | null;
  last_message: string | null;
  last_message_at: string | null;
  unread_count: number;
  status: string;
  created_at: string;
  project?: { id: string; product_name: string } | null;
  staff?: { id: string; name: string } | null;
  instance?: { id: string; instance_name: string; display_name: string | null; status?: string | null } | null;
}

export interface HubMessage {
  id: string;
  conversation_id: string;
  content: string | null;
  media_url: string | null;
  media_type: string | null;
  direction: string;
  status: string;
  created_at: string;
  remote_id?: string | null;
  sent_by?: string | null;
}

const WhatsAppHubPage = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { currentStaff, isMaster } = useStaffPermissions();
  const [selectedConversation, setSelectedConversation] = useState<HubConversation | null>(null);
  const [showContactPanel, setShowContactPanel] = useState(true);
  const [showConnectDialog, setShowConnectDialog] = useState(false);
  const [showBulkSend, setShowBulkSend] = useState(false);
  const [instances, setInstances] = useState<StaffInstance[]>([]);
  const [loadingInstances, setLoadingInstances] = useState(true);
  const [mobileView, setMobileView] = useState<"list" | "chat" | "contact">("list");

  useEffect(() => {
    if (currentStaff) {
      fetchInstances();
    }
  }, [currentStaff, isMaster]);

  const fetchInstances = async () => {
    if (!currentStaff) return;
    setLoadingInstances(true);

    try {
      // Resolve tenant_id do staff atual para isolar instâncias por tenant white-label
      const { data: staffRow } = await supabase
        .from("onboarding_staff")
        .select("tenant_id")
        .eq("id", currentStaff.id)
        .maybeSingle();
      const tenantId = staffRow?.tenant_id ?? null;

      if (isMaster) {
        let query = supabase
          .from("whatsapp_instances")
          .select("id, instance_name, display_name, phone_number, status, qr_code, tenant_id")
          .order("display_name");

        // Master de tenant white-label vê apenas as próprias instâncias.
        // Master da plataforma (tenant_id null) vê apenas instâncias globais (tenant_id null).
        if (tenantId) {
          query = query.eq("tenant_id", tenantId);
        } else {
          query = query.is("tenant_id", null);
        }

        const { data } = await query;

        setInstances(
          (data || []).map((item) => ({
            ...item,
            can_view: true,
            can_send: true,
          }))
        );
      } else {
        const { data } = await supabase
          .from("whatsapp_instance_access")
          .select(`
            can_view,
            can_send,
            instance:whatsapp_instances(id, instance_name, display_name, phone_number, status, qr_code)
          `)
          .eq("staff_id", currentStaff.id)
          .eq("can_view", true);

        const mapped = (data || [])
          .filter((item: any) => item.instance)
          .map((item: any) => ({
            ...item.instance,
            can_view: item.can_view,
            can_send: item.can_send,
          }));

        setInstances(mapped);
      }
    } finally {
      setLoadingInstances(false);
    }
  };

  const handleSelectConversation = (conv: HubConversation) => {
    setSelectedConversation(conv);
    setShowContactPanel(true);
    if (isMobile) setMobileView("chat");
  };

  const handleBack = () => {
    if (mobileView === "contact") {
      setMobileView("chat");
    } else if (mobileView === "chat") {
      setMobileView("list");
      setSelectedConversation(null);
    }
  };

  const handleShowContact = () => {
    setShowContactPanel(true);
    if (isMobile) setMobileView("contact");
  };

  const connectedInstances = instances.filter((instance) => instance.status === "connected");
  const hasConnectedInstance = connectedInstances.length > 0;

  if (isMobile) {
    return (
      <div className="h-[100dvh] flex flex-col bg-background">
        <div className="flex items-center gap-2 p-3 border-b bg-background shrink-0">
          {mobileView !== "list" && (
            <Button variant="ghost" size="icon" onClick={handleBack}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
          )}
          {mobileView === "list" && (
            <Button variant="ghost" size="icon" onClick={() => navigate("/onboarding-tasks")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
          )}
          <div className="flex-1 min-w-0">
            {mobileView === "list" && (
              <div className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-primary" />
                <h1 className="text-lg font-bold truncate">WhatsApp</h1>
              </div>
            )}
            {mobileView === "chat" && selectedConversation && (
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm font-bold">
                  {(selectedConversation.contact_name || selectedConversation.contact_phone)[0]?.toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">{selectedConversation.contact_name || selectedConversation.contact_phone}</p>
                  <p className="text-xs text-muted-foreground truncate">{selectedConversation.contact_phone}</p>
                </div>
              </div>
            )}
            {mobileView === "contact" && <p className="text-sm font-semibold">Dados do Contato</p>}
          </div>
          <div className="flex items-center gap-1">
            {mobileView === "list" && (
              <Button variant="ghost" size="icon" onClick={() => setShowBulkSend(true)}>
                <Users className="h-4 w-4" />
              </Button>
            )}
            {loadingInstances ? null : hasConnectedInstance ? (
              <Wifi className="h-4 w-4 text-primary" />
            ) : (
              <WifiOff className="h-4 w-4 text-muted-foreground" />
            )}
            <Button variant="ghost" size="icon" onClick={() => setShowConnectDialog(true)}>
              <Settings2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-hidden">
          {mobileView === "list" && (
            <WhatsAppHubConversationList
              staffId={currentStaff?.id || ""}
              isMaster={isMaster}
              staffRole={currentStaff?.role}
              onSelect={handleSelectConversation}
              selectedId={selectedConversation?.id}
            />
          )}
          {mobileView === "chat" && selectedConversation && (
            <WhatsAppHubChat
              conversation={selectedConversation}
              staffId={currentStaff?.id || ""}
              onShowContact={handleShowContact}
            />
          )}
          {mobileView === "contact" && selectedConversation && (
            <WhatsAppHubContactPanel
              conversation={selectedConversation}
              onConversationUpdate={(conv) => setSelectedConversation(conv)}
            />
          )}
        </div>

        <WhatsAppHubConnectDialog
          open={showConnectDialog}
          onOpenChange={setShowConnectDialog}
          staffId={currentStaff?.id || ""}
          instances={instances}
          onInstanceUpdate={fetchInstances}
        />
        <WhatsAppBulkSendDialog
          open={showBulkSend}
          onOpenChange={setShowBulkSend}
          staffId={currentStaff?.id || ""}
        />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      <div className="flex items-center gap-3 p-4 border-b shrink-0 min-w-0">
        <Button variant="ghost" size="icon" onClick={() => navigate("/onboarding-tasks")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <NexusHeader showTitle={false} />
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-bold">WhatsApp Hub</h1>
        </div>
        <div className="ml-auto flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={() => setShowBulkSend(true)}>
            <Users className="h-4 w-4 mr-1" />
            Envio em Massa
          </Button>
          <div className="flex items-center gap-1.5 text-sm">
            {loadingInstances ? null : hasConnectedInstance ? (
              <>
                <Wifi className="h-4 w-4 text-primary" />
                <span className="text-primary font-medium">{connectedInstances.length} conectada(s)</span>
              </>
            ) : (
              <>
                <WifiOff className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground font-medium">Nenhuma conectada</span>
              </>
            )}
          </div>
          <Button variant="outline" size="sm" onClick={() => setShowConnectDialog(true)}>
            <Settings2 className="h-4 w-4 mr-1" />
            Dispositivos
          </Button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="w-80 xl:w-96 border-r flex flex-col shrink-0">
          <WhatsAppHubConversationList
            staffId={currentStaff?.id || ""}
            isMaster={isMaster}
            staffRole={currentStaff?.role}
            onSelect={handleSelectConversation}
            selectedId={selectedConversation?.id}
          />
        </div>

        <div className="flex-1 flex flex-col min-w-0">
          {selectedConversation ? (
            <WhatsAppHubChat
              conversation={selectedConversation}
              staffId={currentStaff?.id || ""}
              onShowContact={handleShowContact}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <MessageSquare className="h-16 w-16 mx-auto mb-4 opacity-20" />
                <p className="text-lg font-medium">Selecione uma conversa</p>
                <p className="text-sm">Escolha uma conversa da STEVO à esquerda</p>
              </div>
            </div>
          )}
        </div>

        {showContactPanel && selectedConversation && (
          <div className="w-80 border-l flex flex-col shrink-0">
            <div className="flex items-center justify-between p-3 border-b">
              <h3 className="text-sm font-semibold">Dados do Contato</h3>
              <Button variant="ghost" size="sm" onClick={() => setShowContactPanel(false)}>✕</Button>
            </div>
            <WhatsAppHubContactPanel
              conversation={selectedConversation}
              onConversationUpdate={(conv) => setSelectedConversation(conv)}
            />
          </div>
        )}
      </div>

      <WhatsAppHubConnectDialog
        open={showConnectDialog}
        onOpenChange={setShowConnectDialog}
        staffId={currentStaff?.id || ""}
        instances={instances}
        onInstanceUpdate={fetchInstances}
      />
      <WhatsAppBulkSendDialog
        open={showBulkSend}
        onOpenChange={setShowBulkSend}
        staffId={currentStaff?.id || ""}
      />
    </div>
  );
};

export default WhatsAppHubPage;
