import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Phone, Building2, Link2, Search } from "lucide-react";
import { HubKPIMiniDashboard } from "./HubKPIMiniDashboard";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import type { HubConversation } from "@/pages/onboarding-tasks/WhatsAppHubPage";

interface Props {
  conversation: HubConversation;
  onConversationUpdate: (conv: HubConversation) => void;
}

interface Company {
  id: string;
  name: string;
}

interface Project {
  id: string;
  name: string;
  company_id: string | null;
}

export const WhatsAppHubContactPanel = ({ conversation, onConversationUpdate }: Props) => {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<string>("none");
  const [selectedProject, setSelectedProject] = useState(conversation.project_id || "none");
  const [companySearch, setCompanySearch] = useState("");
  const [projectSearch, setProjectSearch] = useState("");

  // Fetch data only when conversation changes (not on project_id update)
  useEffect(() => {
    setSelectedCompany("none");
    setCompanySearch("");
    setProjectSearch("");
    fetchData();
  }, [conversation.id]);

  // Sync selected project from prop without refetching
  useEffect(() => {
    setSelectedProject(conversation.project_id || "none");
  }, [conversation.project_id]);

  // When projects load, auto-select company from current project
  useEffect(() => {
    if (projects.length > 0 && conversation.project_id) {
      const currentProject = projects.find((p) => p.id === conversation.project_id);
      if (currentProject?.company_id) {
        setSelectedCompany(currentProject.company_id);
      } else {
        setSelectedCompany("none");
      }
    } else if (projects.length > 0 && !conversation.project_id) {
      setSelectedCompany("none");
    }
  }, [conversation.id, conversation.project_id, projects]);

  const fetchData = async () => {
    const [companiesRes, projectsRes] = await Promise.all([
      supabase
        .from("onboarding_companies")
        .select("id, name")
        .order("name"),
      supabase
        .from("onboarding_projects")
        .select("id, product_name, company_id, onboarding_company_id")
        .eq("status", "active")
        .order("product_name"),
    ]);

    setCompanies((companiesRes.data || []).map((c: any) => ({ id: c.id, name: c.name })));
    setProjects((projectsRes.data || []).map((p: any) => ({ id: p.id, name: p.product_name, company_id: p.company_id || p.onboarding_company_id })));
  };

  const companiesWithProjects = useMemo(() => {
    const companyIds = new Set(projects.map((p) => p.company_id).filter(Boolean));
    return companies.filter((c) => companyIds.has(c.id));
  }, [companies, projects]);

  const filteredCompanies = useMemo(() => {
    if (!companySearch) return companiesWithProjects;
    const term = companySearch.toLowerCase();
    return companiesWithProjects.filter((c) => c.name.toLowerCase().includes(term));
  }, [companiesWithProjects, companySearch]);

  const companyProjects = useMemo(() => {
    if (selectedCompany === "none") return projects;
    return projects.filter((p) => p.company_id === selectedCompany);
  }, [projects, selectedCompany]);

  const filteredProjects = useMemo(() => {
    if (!projectSearch) return companyProjects;
    const term = projectSearch.toLowerCase();
    return companyProjects.filter((p) => p.name.toLowerCase().includes(term));
  }, [companyProjects, projectSearch]);

  const handleCompanyChange = (value: string) => {
    setSelectedCompany(value);
    setSelectedProject("none");
    setProjectSearch("");
  };

  const handleProjectChange = async (value: string) => {
    const projectId = value === "none" ? null : value;
    setSelectedProject(value);

    try {
      // Update project_id directly on the conversation
      const { error } = await supabase
        .from("crm_whatsapp_conversations")
        .update({ project_id: projectId } as any)
        .eq("id", conversation.id);

      if (error) throw error;

      const project = projects.find((item) => item.id === projectId);
      onConversationUpdate({
        ...conversation,
        project_id: projectId,
        project: project ? { id: project.id, product_name: project.name } : null,
      });

      toast.success(projectId ? "Conversa vinculada ao projeto" : "Vínculo removido");
    } catch {
      toast.error("Erro ao vincular projeto");
    }
  };

  return (
    <ScrollArea className="flex-1">
      <div className="p-4 space-y-6">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xl font-bold mx-auto mb-3">
            {(conversation.contact_name || conversation.contact_phone)[0]?.toUpperCase()}
          </div>
          <h3 className="font-semibold text-lg">{conversation.contact_name || "Sem nome"}</h3>
          <div className="flex items-center justify-center gap-1.5 text-muted-foreground mt-1">
            <Phone className="h-3.5 w-3.5" />
            <span className="text-sm">{conversation.contact_phone}</span>
          </div>
        </div>

        {/* Company selector */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Building2 className="h-4 w-4" />
            Empresa
          </div>
          <Select value={selectedCompany} onValueChange={handleCompanyChange}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Selecione uma empresa" />
            </SelectTrigger>
            <SelectContent>
              <div className="p-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Buscar empresa..."
                    value={companySearch}
                    onChange={(e) => setCompanySearch(e.target.value)}
                    className="h-8 pl-8 text-sm"
                    onKeyDown={(e) => e.stopPropagation()}
                  />
                </div>
              </div>
              <SelectItem value="none">Todas</SelectItem>
              {filteredCompanies.map((company) => (
                <SelectItem key={company.id} value={company.id}>{company.name}</SelectItem>
              ))}
              {filteredCompanies.length === 0 && companySearch && (
                <div className="px-3 py-2 text-xs text-muted-foreground">Nenhuma empresa encontrada</div>
              )}
            </SelectContent>
          </Select>
        </div>

        {/* Project selector */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Link2 className="h-4 w-4" />
            Vincular ao Projeto
          </div>
          <Select value={selectedProject} onValueChange={handleProjectChange}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Selecione um projeto" />
            </SelectTrigger>
            <SelectContent>
              <div className="p-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Buscar projeto..."
                    value={projectSearch}
                    onChange={(e) => setProjectSearch(e.target.value)}
                    className="h-8 pl-8 text-sm"
                    onKeyDown={(e) => e.stopPropagation()}
                  />
                </div>
              </div>
              <SelectItem value="none">Nenhum</SelectItem>
              {filteredProjects.map((project) => (
                <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>
              ))}
              {filteredProjects.length === 0 && projectSearch && (
                <div className="px-3 py-2 text-xs text-muted-foreground">Nenhum projeto encontrado</div>
              )}
            </SelectContent>
          </Select>

          {/* Show projects of selected company inline */}
          {selectedCompany !== "none" && companyProjects.length > 0 && (
            <div className="mt-2 rounded-lg border divide-y">
              <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground bg-muted/50">
                Projetos desta empresa ({companyProjects.length})
              </div>
              {companyProjects.map((project) => (
                <button
                  key={project.id}
                  onClick={() => handleProjectChange(project.id)}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-muted/50 transition-colors flex items-center justify-between ${
                    selectedProject === project.id ? "bg-primary/5 font-medium text-primary" : ""
                  }`}
                >
                  <span className="truncate">{project.name}</span>
                  {selectedProject === project.id && (
                    <span className="text-xs text-primary shrink-0 ml-2">✓ vinculado</span>
                  )}
                </button>
              ))}
            </div>
          )}
          {selectedCompany !== "none" && companyProjects.length === 0 && (
            <p className="text-xs text-muted-foreground mt-1">Nenhum projeto ativo nesta empresa.</p>
          )}
        </div>

        {conversation.project && (
          <div className="rounded-lg border p-3">
            <div className="flex items-center gap-2 text-sm font-medium mb-1">
              <Link2 className="h-4 w-4" />
              Projeto atual
            </div>
            <p className="text-sm text-muted-foreground">{conversation.project.product_name}</p>
          </div>
        )}

        {/* Mini Dashboard de KPIs */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Building2 className="h-4 w-4" />
            KPIs do Mês
          </div>
          <HubKPIMiniDashboard
            companyId={selectedCompany !== "none" ? selectedCompany : null}
            projectId={selectedProject !== "none" ? selectedProject : null}
          />
        </div>
      </div>
    </ScrollArea>
  );
};
