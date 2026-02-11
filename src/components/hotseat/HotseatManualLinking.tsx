import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, LinkIcon, CheckCircle2, AlertTriangle, ListTodo } from "lucide-react";
import { toast } from "sonner";

interface FailedCompany {
  company: string;
  companyData: any; // original company data with action_items, recommendations, etc.
}

interface Props {
  recordingId: string;
  failedCompanies: FailedCompany[];
  onTasksCreated: () => void;
}

interface OnboardingCompany {
  id: string;
  name: string;
  consultant_id: string | null;
  cs_id: string | null;
}

export function HotseatManualLinking({ recordingId, failedCompanies, onTasksCreated }: Props) {
  const [companies, setCompanies] = useState<OnboardingCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [linkMap, setLinkMap] = useState<Record<string, string>>({});
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    fetchCompanies();
  }, []);

  const fetchCompanies = async () => {
    const { data } = await supabase
      .from("onboarding_companies")
      .select("id, name, consultant_id, cs_id")
      .eq("status", "active")
      .order("name");
    setCompanies(data || []);
    setLoading(false);
  };

  const handleLink = (companyName: string, companyId: string) => {
    setLinkMap(prev => ({ ...prev, [companyName]: companyId }));
  };

  const linkedCount = Object.keys(linkMap).length;

  const handleGenerateForLinked = async () => {
    if (linkedCount === 0) {
      toast.error("Vincule ao menos uma empresa");
      return;
    }

    setGenerating(true);
    try {
      // Build companies array with overridden project lookup
      const companiesWithOverrides = failedCompanies
        .filter(fc => linkMap[fc.company])
        .map(fc => ({
          ...fc.companyData,
          override_company_id: linkMap[fc.company],
        }));

      const { data, error } = await supabase.functions.invoke("generate-hotseat-tasks", {
        body: { recordingId, companies: companiesWithOverrides },
      });

      if (error) throw error;

      if (data?.success) {
        const successCount = data.results?.filter((r: any) => r.tasksCreated > 0).length || 0;
        toast.success(`${data.totalTasks} tarefas criadas para ${successCount} empresa(s)!`);
        onTasksCreated();
      }
    } catch (error) {
      console.error("Error generating tasks:", error);
      toast.error("Erro ao gerar tarefas");
    } finally {
      setGenerating(false);
    }
  };

  if (loading) return null;

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-4 space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium text-amber-800">
        <AlertTriangle className="h-4 w-4" />
        Empresas não encontradas — vincule manualmente
      </div>

      <div className="space-y-2">
        {failedCompanies.map((fc, idx) => {
          const isLinked = !!linkMap[fc.company];
          return (
            <div key={idx} className="flex items-center gap-2 bg-white rounded-md border p-2">
              <Badge variant="outline" className="shrink-0 text-xs">
                {fc.company.length > 30 ? fc.company.substring(0, 28) + "…" : fc.company}
              </Badge>
              <div className="flex-1">
                <Select
                  value={linkMap[fc.company] || ""}
                  onValueChange={(val) => handleLink(fc.company, val)}
                >
                  <SelectTrigger className="h-8 text-xs bg-background">
                    <SelectValue placeholder="Selecione a empresa..." />
                  </SelectTrigger>
                  <SelectContent className="bg-background z-50">
                    {companies.map(c => (
                      <SelectItem key={c.id} value={c.id} className="text-xs">
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {isLinked && <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />}
            </div>
          );
        })}
      </div>

      <Button
        size="sm"
        onClick={handleGenerateForLinked}
        disabled={generating || linkedCount === 0}
        className="w-full gap-2"
      >
        {generating ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Gerando tarefas...
          </>
        ) : (
          <>
            <ListTodo className="h-4 w-4" />
            Gerar Tarefas ({linkedCount} vinculada{linkedCount !== 1 ? "s" : ""})
          </>
        )}
      </Button>
    </div>
  );
}
