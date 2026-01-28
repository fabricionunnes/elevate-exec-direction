import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { 
  CultureFormLink, 
  CultureFormResponse, 
  CultureManualVersion, 
  CultureManualSection,
  CultureAuditLog 
} from "./types";
import { MANUAL_SECTIONS } from "./types";

export function useCultureFormLink(projectId: string) {
  return useQuery({
    queryKey: ["culture-form-link", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("culture_form_links")
        .select("*")
        .eq("project_id", projectId)
        .maybeSingle();
      
      if (error) throw error;
      return data as CultureFormLink | null;
    },
  });
}

export function useCreateFormLink(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      // Get current staff id
      const { data: staffData } = await supabase
        .from("onboarding_staff")
        .select("id")
        .eq("user_id", (await supabase.auth.getUser()).data.user?.id)
        .single();

      const { data, error } = await supabase
        .from("culture_form_links")
        .insert({
          project_id: projectId,
          created_by: staffData?.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["culture-form-link", projectId] });
      toast.success("Link do formulário criado com sucesso!");
    },
    onError: (error: Error) => {
      toast.error("Erro ao criar link: " + error.message);
    },
  });
}

export function useCultureFormResponses(projectId: string) {
  return useQuery({
    queryKey: ["culture-form-responses", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("culture_form_responses")
        .select("*")
        .eq("project_id", projectId)
        .order("submitted_at", { ascending: false });
      
      if (error) throw error;
      return data as CultureFormResponse[];
    },
  });
}

export function useCultureManualVersions(projectId: string) {
  return useQuery({
    queryKey: ["culture-manual-versions", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("culture_manual_versions")
        .select("*")
        .eq("project_id", projectId)
        .order("version_number", { ascending: false });
      
      if (error) throw error;
      return data as CultureManualVersion[];
    },
  });
}

export function useActiveManualVersion(projectId: string) {
  return useQuery({
    queryKey: ["culture-manual-active-version", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("culture_manual_versions")
        .select("*")
        .eq("project_id", projectId)
        .eq("is_active", true)
        .maybeSingle();
      
      if (error) throw error;
      return data as CultureManualVersion | null;
    },
  });
}

export function usePublishedManualVersion(projectId: string) {
  return useQuery({
    queryKey: ["culture-manual-published-version", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("culture_manual_versions")
        .select("*")
        .eq("project_id", projectId)
        .eq("is_published", true)
        .order("published_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (error) throw error;
      return data as CultureManualVersion | null;
    },
  });
}

export function useManualSections(versionId: string | undefined) {
  return useQuery({
    queryKey: ["culture-manual-sections", versionId],
    queryFn: async () => {
      if (!versionId) return [];
      
      const { data, error } = await supabase
        .from("culture_manual_sections")
        .select("*")
        .eq("version_id", versionId)
        .order("sort_order", { ascending: true });
      
      if (error) throw error;
      return data as CultureManualSection[];
    },
    enabled: !!versionId,
  });
}

export function useCreateManualVersion(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { 
      versionName?: string; 
      generatedByAi?: boolean;
      companyLogoUrl?: string;
    }) => {
      const { data: staffData } = await supabase
        .from("onboarding_staff")
        .select("id")
        .eq("user_id", (await supabase.auth.getUser()).data.user?.id)
        .single();

      const { data: version, error: versionError } = await supabase
        .from("culture_manual_versions")
        .insert({
          project_id: projectId,
          version_name: params.versionName,
          generated_by_ai: params.generatedByAi || false,
          company_logo_url: params.companyLogoUrl,
          is_active: true,
          created_by: staffData?.id,
        })
        .select()
        .single();

      if (versionError) throw versionError;

      // Create all sections for this version
      const sections = MANUAL_SECTIONS.map((section) => ({
        version_id: version.id,
        section_key: section.key,
        section_title: section.title,
        sort_order: section.order,
        section_content: "",
      }));

      const { error: sectionsError } = await supabase
        .from("culture_manual_sections")
        .insert(sections);

      if (sectionsError) throw sectionsError;

      return version;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["culture-manual-versions", projectId] });
      queryClient.invalidateQueries({ queryKey: ["culture-manual-active-version", projectId] });
      toast.success("Nova versão do manual criada!");
    },
    onError: (error: Error) => {
      toast.error("Erro ao criar versão: " + error.message);
    },
  });
}

export function useUpdateSection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { 
      sectionId: string; 
      content: string;
      versionId: string;
    }) => {
      const { data: staffData } = await supabase
        .from("onboarding_staff")
        .select("id")
        .eq("user_id", (await supabase.auth.getUser()).data.user?.id)
        .single();

      const { error } = await supabase
        .from("culture_manual_sections")
        .update({
          section_content: params.content,
          last_edited_at: new Date().toISOString(),
          last_edited_by: staffData?.id,
        })
        .eq("id", params.sectionId);

      if (error) throw error;
      return params.versionId;
    },
    onSuccess: (versionId) => {
      queryClient.invalidateQueries({ queryKey: ["culture-manual-sections", versionId] });
      toast.success("Seção atualizada!");
    },
    onError: (error: Error) => {
      toast.error("Erro ao atualizar seção: " + error.message);
    },
  });
}

export function usePublishVersion(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (versionId: string) => {
      const { data: staffData } = await supabase
        .from("onboarding_staff")
        .select("id")
        .eq("user_id", (await supabase.auth.getUser()).data.user?.id)
        .single();

      // First unpublish all other versions
      await supabase
        .from("culture_manual_versions")
        .update({ is_published: false })
        .eq("project_id", projectId);

      // Then publish this version
      const { error } = await supabase
        .from("culture_manual_versions")
        .update({
          is_published: true,
          published_at: new Date().toISOString(),
          published_by: staffData?.id,
        })
        .eq("id", versionId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["culture-manual-versions", projectId] });
      queryClient.invalidateQueries({ queryKey: ["culture-manual-published-version", projectId] });
      toast.success("Manual publicado com sucesso! Agora os colaboradores podem acessar.");
    },
    onError: (error: Error) => {
      toast.error("Erro ao publicar: " + error.message);
    },
  });
}

export function useSetActiveVersion(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (versionId: string) => {
      const { error } = await supabase
        .from("culture_manual_versions")
        .update({ is_active: true })
        .eq("id", versionId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["culture-manual-versions", projectId] });
      queryClient.invalidateQueries({ queryKey: ["culture-manual-active-version", projectId] });
      toast.success("Versão ativa alterada!");
    },
    onError: (error: Error) => {
      toast.error("Erro ao alterar versão ativa: " + error.message);
    },
  });
}

export function useCultureAuditLog(projectId: string) {
  return useQuery({
    queryKey: ["culture-audit-log", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("culture_manual_audit_log")
        .select("*")
        .eq("project_id", projectId)
        .order("performed_at", { ascending: false })
        .limit(50);
      
      if (error) throw error;
      return data as CultureAuditLog[];
    },
  });
}
