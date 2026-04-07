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
import { WhatsAppNotificationBadge } from "@/components/whatsapp-hub/WhatsAppNotificationBadge";
import { toast } from "sonner";

export interface StaffInstance {
  id: string;
  staff_id: string;
  instance_name: string;
  display_name: string | null;
  phone_number: string | null;
  status: string;
  qr_code: string | null;
}

export interface HubConversation {
  id: string;
  staff_id: string;
  instance_id: string | null;
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
  tags?: { id: string; tag: { id: string; name: string; color: string } }[];
}

export interface HubMessage {
  id: string;
  conversation_id: string;
  staff_id: string;
  content: string | null;
  media_url: string | null;
  media_type: string | null;
  direction: string;
  status: string;
  created_at: string;
}

const WhatsAppHubPage = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { currentStaff, isMaster } = useStaffPermissions();
  const [selectedConversation, setSelectedConversation] = useState<HubConversation | null>(null);
  const [showContactPanel, setShowContactPanel] = useState(false);
  const [showConnectDialog, setShowConnectDialog] = useState(false);
  const [showBulkSend, setShowBulkSend] = useState(false);
  const [instance, setInstance] = useState<StaffInstance | null>(null);
  const [loadingInstance, setLoadingInstance] = useState(true);
  const [mobileView, setMobileView] = useState<"list" | "chat" | "contact">("list");

  useEffect(() => {
    if (currentStaff) {
      fetchInstance();
    }
  }, [currentStaff]);

  const fetchInstance = async () => {
    if (!currentStaff) return;
    setLoadingInstance(true);
    const { data } = await supabase
      .from("staff_whatsapp_instances")
      .select("*")
      .eq("staff_id", currentStaff.id)
      .maybeSingle();
    setInstance(data);
    setLoadingInstance(false);
  };

  const handleSelectConversation = (conv: HubConversation) => {
    setSelectedConversation(conv);
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

  const isConnected = instance?.status === "connected";

  // Mobile layout
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
                <MessageSquare className="h-5 w-5 text-green-500" />
                <h1 className="text-lg font-bold truncate">WhatsApp</h1>
              </div>
            )}
            {mobileView === "chat" && selectedConversation && (
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center text-green-600 text-sm font-bold">
                  {(selectedConversation.contact_name || selectedConversation.contact_phone)[0]?.toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">{selectedConversation.contact_name || selectedConversation.contact_phone}</p>
                  <p className="text-xs text-muted-foreground truncate">{selectedConversation.contact_phone}</p>
                </div>
              </div>
            )}
            {mobileView === "contact" && (
              <p className="text-sm font-semibold">Dados do Contato</p>
            )}
          </div>
          <div className="flex items-center gap-1">
            {mobileView === "list" && (
              <Button variant="ghost" size="icon" onClick={() => setShowBulkSend(true)}>
                <Users className="h-4 w-4" />
              </Button>
            )}
            {isConnected ? (
              <Wifi className="h-4 w-4 text-green-500" />
            ) : (
              <WifiOff className="h-4 w-4 text-red-500" />
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
              onSelect={handleSelectConversation}
              selectedId={selectedConversation?.id}
            />
          )}
          {mobileView === "chat" && selectedConversation && (
            <WhatsAppHubChat
              conversation={selectedConversation}
              staffId={currentStaff?.id || ""}
              instance={instance}
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
          instance={instance}
          onInstanceUpdate={fetchInstance}
        />
        <WhatsAppBulkSendDialog
          open={showBulkSend}
          onOpenChange={setShowBulkSend}
          staffId={currentStaff?.id || ""}
          instance={instance}
        />
      </div>
    );
  }

  // Desktop layout
  return (
    <div className="h-screen flex flex-col bg-background">
      <div className="flex items-center gap-3 p-4 border-b shrink-0">
        <Button variant="ghost" size="icon" onClick={() => navigate("/onboarding-tasks")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <NexusHeader showTitle={false} />
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-green-500" />
          <h1 className="text-xl font-bold">WhatsApp Hub</h1>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowBulkSend(true)}>
            <Users className="h-4 w-4 mr-1" />
            Envio em Massa
          </Button>
          <div className="flex items-center gap-1.5 text-sm">
            {isConnected ? (
              <>
                <Wifi className="h-4 w-4 text-green-500" />
                <span className="text-green-600 font-medium">Conectado</span>
              </>
            ) : (
              <>
                <WifiOff className="h-4 w-4 text-red-500" />
                <span className="text-red-500 font-medium">Desconectado</span>
              </>
            )}
          </div>
          <Button variant="outline" size="sm" onClick={() => setShowConnectDialog(true)}>
            <Settings2 className="h-4 w-4 mr-1" />
            Configurar
          </Button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="w-80 xl:w-96 border-r flex flex-col shrink-0">
          <WhatsAppHubConversationList
            staffId={currentStaff?.id || ""}
            isMaster={isMaster}
            onSelect={handleSelectConversation}
            selectedId={selectedConversation?.id}
          />
        </div>

        <div className="flex-1 flex flex-col min-w-0">
          {selectedConversation ? (
            <WhatsAppHubChat
              conversation={selectedConversation}
              staffId={currentStaff?.id || ""}
              instance={instance}
              onShowContact={handleShowContact}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <MessageSquare className="h-16 w-16 mx-auto mb-4 opacity-20" />
                <p className="text-lg font-medium">Selecione uma conversa</p>
                <p className="text-sm">Escolha uma conversa na lista à esquerda</p>
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
        instance={instance}
        onInstanceUpdate={fetchInstance}
      />
      <WhatsAppBulkSendDialog
        open={showBulkSend}
        onOpenChange={setShowBulkSend}
        staffId={currentStaff?.id || ""}
        instance={instance}
      />
    </div>
  );
};

export default WhatsAppHubPage;
