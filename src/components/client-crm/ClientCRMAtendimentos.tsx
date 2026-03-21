import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MessageCircle, Instagram } from "lucide-react";
import { ClientCRMWhatsApp } from "./ClientCRMWhatsApp";
import { ClientCRMInstagramConnect } from "./ClientCRMInstagramConnect";
import { ClientCRMInbox } from "./ClientCRMInbox";

interface Props {
  projectId: string;
}

export const ClientCRMAtendimentos = ({ projectId }: Props) => {
  const [activeTab, setActiveTab] = useState("inbox");

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="h-auto flex-wrap gap-1">
          <TabsTrigger value="inbox" className="gap-1.5">
            <MessageCircle className="h-3.5 w-3.5" />
            Conversas
          </TabsTrigger>
          <TabsTrigger value="whatsapp" className="gap-1.5">
            <MessageCircle className="h-3.5 w-3.5" />
            WhatsApp
          </TabsTrigger>
          <TabsTrigger value="instagram" className="gap-1.5">
            <Instagram className="h-3.5 w-3.5" />
            Instagram
          </TabsTrigger>
        </TabsList>

        <TabsContent value="inbox">
          <ClientCRMInbox projectId={projectId} />
        </TabsContent>

        <TabsContent value="whatsapp">
          <ClientCRMWhatsApp projectId={projectId} />
        </TabsContent>

        <TabsContent value="instagram">
          <ClientCRMInstagramConnect projectId={projectId} />
        </TabsContent>
      </Tabs>
    </div>
  );
};
