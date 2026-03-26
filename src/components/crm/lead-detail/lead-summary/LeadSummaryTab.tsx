import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Eye, BookOpen, Target, BarChart3 } from "lucide-react";
import { useLeadSummary, SummaryTabType } from "./useLeadSummary";
import { LeadSummaryOverview } from "./LeadSummaryOverview";
import { LeadSummaryGuide } from "./LeadSummaryGuide";
import { LeadSummaryFollowUp } from "./LeadSummaryFollowUp";
import { LeadSummaryAnalysis } from "./LeadSummaryAnalysis";

interface LeadSummaryTabProps {
  leadId: string;
  leadName: string;
}

export const LeadSummaryTab = ({ leadId, leadName }: LeadSummaryTabProps) => {
  const [subTab, setSubTab] = useState("overview");
  const summary = useLeadSummary(leadId);

  useEffect(() => {
    summary.setActiveTab(subTab as SummaryTabType);
    if (subTab === "overview") summary.fetchOverview();
    if (subTab === "guide") summary.fetchGuide();
    if (subTab === "followup") summary.fetchFollowup();
    // Analysis is triggered manually via button, not on tab load
  }, [subTab, summary.initialLoadDone]);

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
              Guia
            </TabsTrigger>
            <TabsTrigger value="followup" className="gap-1.5 text-xs">
              <Target className="h-3.5 w-3.5" />
              Follow Up
            </TabsTrigger>
            <TabsTrigger value="analysis" className="gap-1.5 text-xs">
              <BarChart3 className="h-3.5 w-3.5" />
              Análise
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

        <TabsContent value="followup" className="flex-1 mt-0 overflow-auto">
          <LeadSummaryFollowUp
            data={summary.followupData}
            loading={summary.loadingFollowup}
            onRegenerate={() => summary.fetchFollowup(true)}
          />
        </TabsContent>

        <TabsContent value="analysis" className="flex-1 mt-0 overflow-auto">
          <LeadSummaryAnalysis
            data={summary.analysisData}
            loading={summary.loadingAnalysis}
            leadId={leadId}
            onRegenerate={(transcriptionId) => summary.fetchAnalysis(true, transcriptionId)}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};
