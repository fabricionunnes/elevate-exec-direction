import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Loader2, LinkIcon, CheckCircle2, AlertTriangle, ListTodo, Search, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";

interface FailedCompany {
  company: string;
  companyData: any;
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

function CompanySearchSelect({
  companies,
  value,
  onSelect,
}: {
  companies: OnboardingCompany[];
  value: string;
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return companies;
    const q = search.toLowerCase();
    return companies.filter((c) => c.name.toLowerCase().includes(q));
  }, [companies, search]);

  const selectedName = companies.find((c) => c.id === value)?.name;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          className="h-8 text-xs justify-between w-full bg-background font-normal"
        >
          <span className="truncate">
            {selectedName || "Selecione a empresa..."}
          </span>
          <ChevronDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0 z-50" align="start">
        <div className="p-2 border-b">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar empresa..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 pl-7 text-xs"
              autoFocus
            />
          </div>
        </div>
        <ScrollArea className="max-h-[250px]">
          {filtered.length === 0 ? (
            <div className="p-3 text-xs text-muted-foreground text-center">
              Nenhuma empresa encontrada
            </div>
          ) : (
            filtered.map((c) => (
              <button
                key={c.id}
                onClick={() => {
                  onSelect(c.id);
                  setOpen(false);
                  setSearch("");
                }}
                className={`w-full text-left px-3 py-2 text-xs hover:bg-accent transition-colors ${
                  c.id === value ? "bg-accent font-medium" : ""
                }`}
              >
                {c.name}
              </button>
            ))
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
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
    setLinkMap((prev) => ({ ...prev, [companyName]: companyId }));
  };

  const linkedCount = Object.keys(linkMap).length;

  const handleGenerateForLinked = async () => {
    if (linkedCount === 0) {
      toast.error("Vincule ao menos uma empresa");
      return;
    }

    setGenerating(true);
    try {
      const companiesWithOverrides = failedCompanies
        .filter((fc) => linkMap[fc.company])
        .map((fc) => ({
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
                <CompanySearchSelect
                  companies={companies}
                  value={linkMap[fc.company] || ""}
                  onSelect={(id) => handleLink(fc.company, id)}
                />
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
