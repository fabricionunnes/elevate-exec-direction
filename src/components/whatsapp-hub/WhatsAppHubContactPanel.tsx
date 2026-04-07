import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Phone, Building2, Link2, Tag, X } from "lucide-react";
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

interface TagItem {
  id: string;
  name: string;
  color: string;
}

export const WhatsAppHubContactPanel = ({ conversation, onConversationUpdate }: Props) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [tags, setTags] = useState<TagItem[]>([]);
  const [convTags, setConvTags] = useState<string[]>([]);
  const [selectedProject, setSelectedProject] = useState(conversation.project_id || "none");

  useEffect(() => {
    fetchProjects();
    fetchTags();
    fetchConvTags();
  }, [conversation.id]);

  const fetchProjects = async () => {
    const { data } = await supabase
      .from("onboarding_projects")
      .select("id, name")
      .neq("status", "closed")
      .order("name");
    setProjects(data || []);
  };

  const fetchTags = async () => {
    const { data } = await supabase.from("staff_whatsapp_tags").select("*");
    setTags(data || []);
  };

  const fetchConvTags = async () => {
    const { data } = await supabase
      .from("staff_whatsapp_conversation_tags")
      .select("tag_id")
      .eq("conversation_id", conversation.id);
    setConvTags((data || []).map((t) => t.tag_id));
  };

  const handleProjectChange = async (value: string) => {
    const projectId = value === "none" ? null : value;
    setSelectedProject(value);
    
    const { error } = await supabase
      .from("staff_whatsapp_conversations")
      .update({ project_id: projectId })
      .eq("id", conversation.id);

    if (error) {
      toast.error("Erro ao vincular projeto");
    } else {
      toast.success(projectId ? "Projeto vinculado" : "Vínculo removido");
      const proj = projects.find((p) => p.id === projectId);
      onConversationUpdate({
        ...conversation,
        project_id: projectId,
        project: proj ? { id: proj.id, name: proj.name } : null,
      });
    }
  };

  const toggleTag = async (tagId: string) => {
    const hasTag = convTags.includes(tagId);

    if (hasTag) {
      await supabase
        .from("staff_whatsapp_conversation_tags")
        .delete()
        .eq("conversation_id", conversation.id)
        .eq("tag_id", tagId);
      setConvTags((prev) => prev.filter((t) => t !== tagId));
    } else {
      await supabase
        .from("staff_whatsapp_conversation_tags")
        .insert({ conversation_id: conversation.id, tag_id: tagId });
      setConvTags((prev) => [...prev, tagId]);
    }
  };

  return (
    <ScrollArea className="flex-1">
      <div className="p-4 space-y-6">
        {/* Contact Info */}
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center text-green-600 text-xl font-bold mx-auto mb-3">
            {(conversation.contact_name || conversation.contact_phone)[0]?.toUpperCase()}
          </div>
          <h3 className="font-semibold text-lg">
            {conversation.contact_name || "Sem nome"}
          </h3>
          <div className="flex items-center justify-center gap-1.5 text-muted-foreground mt-1">
            <Phone className="h-3.5 w-3.5" />
            <span className="text-sm">{conversation.contact_phone}</span>
          </div>
        </div>

        {/* Project Link */}
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
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Tags */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Tag className="h-4 w-4" />
            Tags
          </div>
          <div className="flex flex-wrap gap-1.5">
            {tags.map((tag) => {
              const active = convTags.includes(tag.id);
              return (
                <button
                  key={tag.id}
                  onClick={() => toggleTag(tag.id)}
                  className="transition-all"
                >
                  <Badge
                    variant={active ? "default" : "outline"}
                    className="cursor-pointer text-xs"
                    style={active ? { backgroundColor: tag.color, borderColor: tag.color } : { borderColor: tag.color, color: tag.color }}
                  >
                    {tag.name}
                    {active && <X className="h-3 w-3 ml-1" />}
                  </Badge>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </ScrollArea>
  );
};
