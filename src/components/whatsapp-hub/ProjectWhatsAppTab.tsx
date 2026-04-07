import { useState } from "react";
import { useStaffPermissions } from "@/hooks/useStaffPermissions";
import { WhatsAppHubConversationList } from "./WhatsAppHubConversationList";
import { WhatsAppHubChat } from "./WhatsAppHubChat";
import { WhatsAppHubContactPanel } from "./WhatsAppHubContactPanel";
import { Button } from "@/components/ui/button";
import { ArrowLeft, MessageSquare } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import type { HubConversation } from "@/pages/onboarding-tasks/WhatsAppHubPage";

interface Props {
  projectId: string;
}

export const ProjectWhatsAppTab = ({ projectId }: Props) => {
  const isMobile = useIsMobile();
  const { currentStaff, isMaster } = useStaffPermissions();
  const [selectedConversation, setSelectedConversation] = useState<HubConversation | null>(null);
  const [showContactPanel, setShowContactPanel] = useState(false);
  const [mobileView, setMobileView] = useState<"list" | "chat" | "contact">("list");

  const handleSelectConversation = (conv: HubConversation) => {
    setSelectedConversation(conv);
    if (isMobile) setMobileView("chat");
  };

  if (isMobile) {
    return (
      <div className="flex flex-col" style={{ height: "calc(100dvh - 200px)" }}>
        {mobileView !== "list" && (
          <div className="p-2 border-b">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (mobileView === "contact") setMobileView("chat");
                else {
                  setMobileView("list");
                  setSelectedConversation(null);
                }
              }}
            >
              <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
            </Button>
          </div>
        )}
        <div className="flex-1 overflow-hidden">
          {mobileView === "list" && (
            <WhatsAppHubConversationList
              staffId={currentStaff?.id || ""}
              isMaster={isMaster}
              onSelect={handleSelectConversation}
              selectedId={selectedConversation?.id}
              filterProjectId={projectId}
            />
          )}
          {mobileView === "chat" && selectedConversation && (
            <WhatsAppHubChat
              conversation={selectedConversation}
              staffId={currentStaff?.id || ""}
              onShowContact={() => setMobileView("contact")}
            />
          )}
          {mobileView === "contact" && selectedConversation && (
            <WhatsAppHubContactPanel
              conversation={selectedConversation}
              onConversationUpdate={(conv) => setSelectedConversation(conv)}
            />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex border rounded-lg overflow-hidden" style={{ height: "calc(100vh - 280px)", minHeight: 500 }}>
      <div className="w-80 border-r flex flex-col shrink-0">
        <WhatsAppHubConversationList
          staffId={currentStaff?.id || ""}
          isMaster={isMaster}
          onSelect={handleSelectConversation}
          selectedId={selectedConversation?.id}
          filterProjectId={projectId}
        />
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        {selectedConversation ? (
          <WhatsAppHubChat
            conversation={selectedConversation}
            staffId={currentStaff?.id || ""}
            onShowContact={() => setShowContactPanel(true)}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-20" />
              <p className="text-sm font-medium">Selecione uma conversa</p>
              <p className="text-xs">Conversas vinculadas a este projeto</p>
            </div>
          </div>
        )}
      </div>

      {showContactPanel && selectedConversation && (
        <div className="w-72 border-l flex flex-col shrink-0">
          <div className="flex items-center justify-between p-3 border-b">
            <h3 className="text-sm font-semibold">Contato</h3>
            <Button variant="ghost" size="sm" onClick={() => setShowContactPanel(false)}>✕</Button>
          </div>
          <WhatsAppHubContactPanel
            conversation={selectedConversation}
            onConversationUpdate={(conv) => setSelectedConversation(conv)}
          />
        </div>
      )}
    </div>
  );
};
