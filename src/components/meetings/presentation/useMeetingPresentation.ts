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

interface CompanyContext {
  company_name: string;
  company_segment?: string;
  company_description?: string;
  main_challenges?: string;
  short_term_goals?: string;
  // Note: Internal metrics (contract_value, health_score, nps_score) are excluded
  // to avoid exposing confidential data in client-facing presentations
}

interface MeetingHistory {
  date: string;
  title: string;
  notes?: string;
  subject?: string;
}

interface TaskContext {
  title: string;
  description?: string;
  status: string;
  phase?: string;
}

interface BriefingContext {
  date: string;
  content: string;
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
  const [meetingTitle, setMeetingTitle] = useState<string>("");
  
  // Rich context for AI
  const [companyContext, setCompanyContext] = useState<CompanyContext | null>(null);
  const [meetingHistory, setMeetingHistory] = useState<MeetingHistory[]>([]);
  const [projectTasks, setProjectTasks] = useState<TaskContext[]>([]);
  const [previousBriefings, setPreviousBriefings] = useState<BriefingContext[]>([]);

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

  // Fetch rich company context
  useEffect(() => {
    const fetchRichContext = async () => {
      try {
        // Get project data
        const { data: project } = await supabase
          .from("onboarding_projects")
          .select("product_name, onboarding_company_id")
          .eq("id", projectId)
          .maybeSingle();

        let name = project?.product_name || "";
        let companyData: CompanyContext | null = null;

        if (project?.onboarding_company_id) {
          // Get company data - excluding internal metrics (contract_value, NPS, health_score)
          const { data: company } = await supabase
            .from("onboarding_companies")
            .select("name, segment, company_description, main_challenges, goals_short_term")
            .eq("id", project.onboarding_company_id)
            .maybeSingle();
          
          if (company) {
            name = company.name || name;
            
            // Only include non-confidential company context
            companyData = {
              company_name: name,
              company_segment: company.segment || undefined,
              company_description: company.company_description || undefined,
              main_challenges: company.main_challenges || undefined,
              short_term_goals: company.goals_short_term || undefined,
              // Internal metrics intentionally excluded from presentations
            };
          }
        }

        setCompanyName(name);
        setCompanyContext(companyData);

        // Get meeting date and title
        const { data: meeting } = await supabase
          .from("onboarding_meeting_notes")
          .select("meeting_date, meeting_title")
          .eq("id", meetingId)
          .maybeSingle();

        if (meeting?.meeting_date) setMeetingDate(meeting.meeting_date);
        if (meeting?.meeting_title) setMeetingTitle(meeting.meeting_title);

        // Get meeting history (last 5 finalized meetings)
        const { data: meetings } = await supabase
          .from("onboarding_meeting_notes")
          .select("meeting_date, meeting_title, notes, subject")
          .eq("project_id", projectId)
          .eq("is_finalized", true)
          .neq("id", meetingId)
          .order("meeting_date", { ascending: false })
          .limit(5);

        if (meetings?.length) {
          setMeetingHistory(meetings.map(m => ({
            date: m.meeting_date || "",
            title: m.meeting_title || "Reunião",
            notes: m.notes || undefined,
            subject: m.subject || undefined,
          })));
        }

        // Get previous briefings
        const { data: briefings } = await supabase
          .from("onboarding_meeting_briefings")
          .select("created_at, briefing_content")
          .eq("project_id", projectId)
          .order("created_at", { ascending: false })
          .limit(3);

        if (briefings?.length) {
          setPreviousBriefings(briefings.map(b => ({
            date: new Date(b.created_at).toLocaleDateString('pt-BR'),
            content: typeof b.briefing_content === 'string' 
              ? b.briefing_content 
              : JSON.stringify(b.briefing_content),
          })));
        }

        // Get project tasks with phases - using any to bypass type issues
        const { data: tasksData } = await (supabase as any)
          .from("onboarding_project_tasks")
          .select("title, description, status, phase_id")
          .eq("project_id", projectId)
          .order("due_date", { ascending: true })
          .limit(20);

        if (tasksData?.length) {
          type TaskRow = { title: string; description: string | null; status: string; phase_id: string | null };
          const typedTasks = tasksData as TaskRow[];
          
          // Fetch phase names separately
          const phaseIds = [...new Set(typedTasks.map(t => t.phase_id).filter(Boolean))] as string[];
          let phaseMap: Record<string, string> = {};
          
          if (phaseIds.length > 0) {
            const { data: phases } = await (supabase as any)
              .from("onboarding_phase_templates")
              .select("id, name")
              .in("id", phaseIds);
            
            if (phases) {
              type PhaseRow = { id: string; name: string };
              const typedPhases = phases as PhaseRow[];
              phaseMap = Object.fromEntries(typedPhases.map(p => [p.id, p.name]));
            }
          }

          setProjectTasks(typedTasks.map(t => ({
            title: t.title,
            description: t.description || undefined,
            status: t.status,
            phase: t.phase_id ? phaseMap[t.phase_id] : undefined,
          })));
        }

      } catch (error) {
        console.error("Error fetching rich context:", error);
      }
    };

    fetchRichContext();
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

  // Generate presentation with AI - now with rich context
  const generatePresentation = async (briefing: PresentationBriefing) => {
    setGenerating(true);
    try {
      // Save/update briefing first
      let presentationId = presentation?.id;
      if (!presentationId) {
        presentationId = await saveBriefing(briefing);
        if (!presentationId) throw new Error("Failed to save briefing");
      }

      // Call AI with rich context
      const { data, error } = await supabase.functions.invoke("generate-meeting-presentation", {
        body: {
          briefing: {
            ...briefing,
            company_name: companyName,
            meeting_date: meetingDate || new Date().toISOString().split('T')[0],
            // Rich context
            company_context: companyContext,
            meeting_history: meetingHistory,
            previous_briefings: previousBriefings,
            project_tasks: projectTasks,
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
          meeting_date: meetingDate || new Date().toISOString().split('T')[0],
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

      // Log generation with context info
      await supabase.from("meeting_presentation_logs").insert({
        presentation_id: presentationId,
        version_id: newVersion.id,
        action: 'generated',
        details: { 
          slides_count: data.slides.length,
          context_used: {
            meetings_count: meetingHistory.length,
            tasks_count: projectTasks.length,
            briefings_count: previousBriefings.length,
          }
        },
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

  // Update a single slide
  const updateSlide = async (
    slideId: string, 
    updates: { title?: string; subtitle?: string; content: SlideContent }
  ) => {
    try {
      const { error } = await supabase
        .from("meeting_presentation_slides")
        .update({
          title: updates.title,
          subtitle: updates.subtitle,
          content: JSON.parse(JSON.stringify(updates.content)),
        })
        .eq("id", slideId);

      if (error) throw error;

      // Update local state
      setSlides(prev => prev.map(s => 
        s.id === slideId 
          ? { ...s, ...updates }
          : s
      ));

      toast.success("Slide atualizado!");
    } catch (error) {
      console.error("Error updating slide:", error);
      toast.error("Erro ao atualizar slide");
      throw error;
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
    meetingTitle,
    saveBriefing,
    generatePresentation,
    approveVersion,
    selectVersion,
    updateSlide,
    refresh: fetchPresentation,
  };
}
