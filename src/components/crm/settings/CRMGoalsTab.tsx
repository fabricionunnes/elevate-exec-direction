import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Target, TrendingUp } from "lucide-react";
import { CRMGoalTypesManager } from "./CRMGoalTypesManager";
import { CRMGoalValuesManager } from "./CRMGoalValuesManager";

export const CRMGoalsTab = () => {
  return (
    <div className="space-y-6">
      <Tabs defaultValue="values" className="w-full">
        <TabsList>
          <TabsTrigger value="values" className="gap-2">
            <TrendingUp className="h-4 w-4" />
            Definir Metas
          </TabsTrigger>
          <TabsTrigger value="types" className="gap-2">
            <Target className="h-4 w-4" />
            Tipos de Meta
          </TabsTrigger>
        </TabsList>

        <TabsContent value="values" className="mt-6">
          <CRMGoalValuesManager />
        </TabsContent>

        <TabsContent value="types" className="mt-6">
          <CRMGoalTypesManager />
        </TabsContent>
      </Tabs>
    </div>
  );
};
