import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, Database, Target } from "lucide-react";
import { CommercialActionsCalendarTab } from "./tabs/CommercialActionsCalendarTab";
import { CommercialActionsBankTab } from "./tabs/CommercialActionsBankTab";
import { CommercialActionsCompanyTab } from "./tabs/CommercialActionsCompanyTab";

interface CommercialActionsPanelProps {
  projectId: string;
  companyId?: string | null;
  companySegment?: string | null;
  consultantStaffId?: string | null;
  staffList: { id: string; name: string; role: string }[];
}

export const CommercialActionsPanel = ({
  projectId,
  companyId,
  companySegment,
  consultantStaffId,
  staffList,
}: CommercialActionsPanelProps) => {
  const [activeTab, setActiveTab] = useState("calendar");

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="calendar" className="gap-2">
            <Calendar className="h-4 w-4" />
            Calendário
          </TabsTrigger>
          <TabsTrigger value="bank" className="gap-2">
            <Database className="h-4 w-4" />
            Banco de Ações
          </TabsTrigger>
          <TabsTrigger value="company" className="gap-2">
            <Target className="h-4 w-4" />
            Ações da Empresa
          </TabsTrigger>
        </TabsList>

        <TabsContent value="calendar">
          <CommercialActionsCalendarTab
            projectId={projectId}
            companySegment={companySegment}
            consultantStaffId={consultantStaffId}
            staffList={staffList}
          />
        </TabsContent>

        <TabsContent value="bank">
          <CommercialActionsBankTab />
        </TabsContent>

        <TabsContent value="company">
          <CommercialActionsCompanyTab
            projectId={projectId}
            staffList={staffList}
            consultantStaffId={consultantStaffId}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};
