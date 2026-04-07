import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Phone, Building2, Link2 } from "lucide-react";
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

interface Project {
  id: string;
  name: string;
}

export const WhatsAppHubContactPanel = ({ conversation, onConversationUpdate }: Props) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState(conversation.project_id || "none");

  useEffect(() => {
    setSelectedProject(conversation.project_id || "none");
    fetchProjects();
  }, [conversation.id, conversation.project_id]);

  const fetchProjects = async () => {
    const { data } = await supabase
      .from("onboarding_projects")
      .select("id, product_name")
      .neq("status", "closed")
      .order("product_name");

    setProjects((data || []).map((project: any) => ({ id: project.id, name: project.product_name })));
  };

  const handleProjectChange = async (value: string) => {
    if (!conversation.lead_id) {
      toast.error("Esta conversa ainda não está vinculada a um lead do CRM");
      return;
    }

    const projectId = value === "none" ? null : value;
    setSelectedProject(value);

    try {
      await supabase
        .from("onboarding_projects")
        .update({ crm_lead_id: null })
        .eq("crm_lead_id", conversation.lead_id)
        .neq("id", projectId || "00000000-0000-0000-0000-000000000000");

      if (projectId) {
        const { error } = await supabase
          .from("onboarding_projects")
          .update({ crm_lead_id: conversation.lead_id })
          .eq("id", projectId);

        if (error) throw error;
      }

      const project = projects.find((item) => item.id === projectId);
      onConversationUpdate({
        ...conversation,
        project_id: projectId,
        project: project ? { id: project.id, product_name: project.name } : null,
      });

      toast.success(projectId ? "Projeto vinculado" : "Vínculo removido");
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

        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Building2 className="h-4 w-4" />
            Vincular ao Projeto
          </div>
          <Select value={selectedProject} onValueChange={handleProjectChange}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Selecione um projeto" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Nenhum</SelectItem>
              {projects.map((project) => (
                <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {!conversation.lead_id && (
            <p className="text-xs text-muted-foreground">
              O vínculo com projeto depende desta conversa já estar associada a um lead do CRM.
            </p>
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
      </div>
    </ScrollArea>
  );
};
