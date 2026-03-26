import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Eye, BookOpen } from "lucide-react";
import { useLeadSummary } from "./useLeadSummary";
import { LeadSummaryOverview } from "./LeadSummaryOverview";
import { LeadSummaryGuide } from "./LeadSummaryGuide";

interface LeadSummaryTabProps {
  leadId: string;
  leadName: string;
}

export const LeadSummaryTab = ({ leadId, leadName }: LeadSummaryTabProps) => {
  const [subTab, setSubTab] = useState("overview");
  const summary = useLeadSummary(leadId);

  useEffect(() => {
    summary.setActiveTab(subTab as "overview" | "guide");
    if (subTab === "overview") summary.fetchOverview();
    if (subTab === "guide") summary.fetchGuide();
  }, [subTab]);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <Tabs value={subTab} onValueChange={setSubTab} className="flex-1 flex flex-col min-h-0">
        <div className="px-4 sm:px-6 pt-3">
          <TabsList className="h-9 bg-muted/50">
            <TabsTrigger value="overview" className="gap-1.5 text-xs">
              <Eye className="h-3.5 w-3.5" />
              Visão Geral
            </TabsTrigger>
            <TabsTrigger value="guide" className="gap-1.5 text-xs">
              <BookOpen className="h-3.5 w-3.5" />
              Guia de Atendimento
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="overview" className="flex-1 mt-0 overflow-auto">
          <LeadSummaryOverview
            data={summary.overviewData}
            loading={summary.loadingOverview}
            onRegenerate={() => summary.fetchOverview(true)}
          />
        </TabsContent>

        <TabsContent value="guide" className="flex-1 mt-0 overflow-auto">
          <LeadSummaryGuide
            data={summary.guideData}
            loading={summary.loadingGuide}
            onRegenerate={() => summary.fetchGuide(true)}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};
