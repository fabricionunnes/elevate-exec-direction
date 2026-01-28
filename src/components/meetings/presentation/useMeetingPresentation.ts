import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { 
  MeetingPresentation, 
  PresentationVersion, 
  PresentationSlide,
  PresentationBriefing,
  SlideContent
} from "./types";

interface GeneratedSlide {
  slide_number: number;
  slide_type: string;
  title: string;
  subtitle?: string;
  content: SlideContent;
  is_interactive: boolean;
  interactive_type?: string;
}

export function useMeetingPresentation(meetingId: string, projectId: string) {
  const [presentation, setPresentation] = useState<MeetingPresentation | null>(null);
  const [versions, setVersions] = useState<PresentationVersion[]>([]);
  const [currentVersion, setCurrentVersion] = useState<PresentationVersion | null>(null);
  const [slides, setSlides] = useState<PresentationSlide[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [staffId, setStaffId] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState<string>("");
  const [meetingDate, setMeetingDate] = useState<string>("");

  // Fetch current staff
  useEffect(() => {
    const fetchStaff = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      const { data } = await supabase
        .from("onboarding_staff")
        .select("id")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .maybeSingle();
      
      if (data) setStaffId(data.id);
    };
    fetchStaff();
  }, []);

  // Fetch company name and meeting date
  useEffect(() => {
    const fetchContext = async () => {
      // Get project company
      const { data: project } = await supabase
        .from("onboarding_projects")
        .select("onboarding_company_id, product_name")
        .eq("id", projectId)
        .maybeSingle();

      if (project?.onboarding_company_id) {
        const { data: company } = await supabase
          .from("onboarding_companies")
          .select("name")
          .eq("id", project.onboarding_company_id)
          .maybeSingle();
        
        setCompanyName(company?.name || project.product_name || "");
      } else if (project?.product_name) {
        setCompanyName(project.product_name);
      }

      // Get meeting date
      const { data: meeting } = await supabase
        .from("onboarding_meeting_notes")
        .select("meeting_date")
        .eq("id", meetingId)
        .maybeSingle();

      if (meeting?.meeting_date) {
        setMeetingDate(meeting.meeting_date);
      }
    };
    fetchContext();
  }, [projectId, meetingId]);

  // Fetch presentation data
  const fetchPresentation = useCallback(async () => {
    setLoading(true);
    try {
      // Get presentation
      const { data: presentationData } = await supabase
        .from("meeting_presentations")
        .select("*")
        .eq("meeting_id", meetingId)
        .maybeSingle();

      if (presentationData) {
        setPresentation(presentationData as MeetingPresentation);

        // Get versions
        const { data: versionsData } = await supabase
          .from("meeting_presentation_versions")
          .select("*")
          .eq("presentation_id", presentationData.id)
          .order("version_number", { ascending: false });

        const typedVersions = (versionsData || []) as PresentationVersion[];
        setVersions(typedVersions);

        // Set current version (latest or approved)
        const approved = typedVersions.find(v => v.status === 'approved');
        const latest = typedVersions[0];
        const selected = approved || latest;
        setCurrentVersion(selected || null);

        // Get slides for current version
        if (selected) {
          const { data: slidesData } = await supabase
            .from("meeting_presentation_slides")
            .select("*")
            .eq("version_id", selected.id)
            .order("slide_number", { ascending: true });

          setSlides((slidesData || []) as PresentationSlide[]);
        }
      } else {
        setPresentation(null);
        setVersions([]);
        setCurrentVersion(null);
        setSlides([]);
      }
    } catch (error) {
      console.error("Error fetching presentation:", error);
    } finally {
      setLoading(false);
    }
  }, [meetingId]);

  useEffect(() => {
    fetchPresentation();
  }, [fetchPresentation]);

  // Select a specific version
  const selectVersion = async (versionId: string) => {
    const version = versions.find(v => v.id === versionId);
    if (!version) return;

    setCurrentVersion(version);

    const { data: slidesData } = await supabase
      .from("meeting_presentation_slides")
      .select("*")
      .eq("version_id", versionId)
      .order("slide_number", { ascending: true });

    setSlides((slidesData || []) as PresentationSlide[]);
  };

  // Create or update presentation briefing
  const saveBriefing = async (briefing: PresentationBriefing): Promise<string | null> => {
    setSaving(true);
    try {
      if (presentation) {
        // Update existing
        const { error } = await supabase
          .from("meeting_presentations")
          .update({
            ...briefing,
            updated_at: new Date().toISOString(),
          })
          .eq("id", presentation.id);

        if (error) throw error;
        await fetchPresentation();
        return presentation.id;
      } else {
        // Create new
        const { data, error } = await supabase
          .from("meeting_presentations")
          .insert({
            meeting_id: meetingId,
            project_id: projectId,
            ...briefing,
            created_by: staffId,
          })
          .select()
          .single();

        if (error) throw error;
        await fetchPresentation();
        return data.id;
      }
    } catch (error) {
      console.error("Error saving briefing:", error);
      toast.error("Erro ao salvar briefing");
      return null;
    } finally {
      setSaving(false);
    }
  };

  // Generate presentation with AI
  const generatePresentation = async (briefing: PresentationBriefing) => {
    setGenerating(true);
    try {
      // Save/update briefing first
      let presentationId = presentation?.id;
      if (!presentationId) {
        presentationId = await saveBriefing(briefing);
        if (!presentationId) throw new Error("Failed to save briefing");
      }

      // Call AI to generate
      const { data, error } = await supabase.functions.invoke("generate-meeting-presentation", {
        body: {
          briefing: {
            ...briefing,
            company_name: companyName,
            meeting_date: meetingDate,
          },
        },
      });

      if (error) throw error;
      if (!data?.slides?.length) throw new Error("No slides generated");

      // Get next version number
      const { data: maxVersion } = await supabase
        .from("meeting_presentation_versions")
        .select("version_number")
        .eq("presentation_id", presentationId)
        .order("version_number", { ascending: false })
        .limit(1)
        .maybeSingle();

      const nextVersionNumber = (maxVersion?.version_number || 0) + 1;

      // Create new version
      const { data: newVersion, error: versionError } = await supabase
        .from("meeting_presentation_versions")
        .insert({
          presentation_id: presentationId,
          version_number: nextVersionNumber,
          status: 'draft',
          title: briefing.subject,
          company_name: companyName,
          meeting_date: meetingDate,
          generated_by: staffId,
        })
        .select()
        .single();

      if (versionError) throw versionError;

      // Insert slides
      const slidesToInsert = data.slides.map((slide: GeneratedSlide, index: number) => ({
        version_id: newVersion.id,
        slide_number: slide.slide_number || index + 1,
        slide_type: slide.slide_type,
        title: slide.title,
        subtitle: slide.subtitle,
        content: slide.content,
        is_interactive: slide.is_interactive || false,
        interactive_type: slide.interactive_type,
        sort_order: index,
      }));

      const { error: slidesError } = await supabase
        .from("meeting_presentation_slides")
        .insert(slidesToInsert);

      if (slidesError) throw slidesError;

      // Log generation
      await supabase.from("meeting_presentation_logs").insert({
        presentation_id: presentationId,
        version_id: newVersion.id,
        action: 'generated',
        details: { slides_count: data.slides.length },
        performed_by: staffId,
      });

      toast.success(`Apresentação gerada com ${data.slides.length} slides!`);
      await fetchPresentation();
    } catch (error: unknown) {
      console.error("Error generating presentation:", error);
      const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
      toast.error(`Erro ao gerar apresentação: ${errorMessage}`);
    } finally {
      setGenerating(false);
    }
  };

  // Approve current version
  const approveVersion = async () => {
    if (!currentVersion || !staffId) return;

    try {
      // Set all other versions to archived
      await supabase
        .from("meeting_presentation_versions")
        .update({ status: 'archived' })
        .eq("presentation_id", presentation?.id)
        .neq("id", currentVersion.id);

      // Approve current
      const { error } = await supabase
        .from("meeting_presentation_versions")
        .update({
          status: 'approved',
          approved_by: staffId,
          approved_at: new Date().toISOString(),
        })
        .eq("id", currentVersion.id);

      if (error) throw error;

      // Log
      await supabase.from("meeting_presentation_logs").insert({
        presentation_id: presentation?.id,
        version_id: currentVersion.id,
        action: 'approved',
        performed_by: staffId,
      });

      toast.success("Versão aprovada!");
      await fetchPresentation();
    } catch (error) {
      console.error("Error approving version:", error);
      toast.error("Erro ao aprovar versão");
    }
  };

  return {
    presentation,
    versions,
    currentVersion,
    slides,
    loading,
    generating,
    saving,
    companyName,
    meetingDate,
    saveBriefing,
    generatePresentation,
    approveVersion,
    selectVersion,
    refresh: fetchPresentation,
  };
}
