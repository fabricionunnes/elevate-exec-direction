import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, FileText, Check, Copy, Download, Target, ListChecks, Plus, Trash2, ChevronUp, ChevronDown, GripVertical, X, Pencil } from "lucide-react";
import { jsPDF } from "jspdf";
import logoUnv from "@/assets/logo-unv.png";

interface CronogramaAction {
  title: string;
  subactions: string[];
}

interface CompanyData {
  id: string;
  name: string;
  segment: string | null;
  website: string | null;
  instagram: string | null;
  company_description: string | null;
  main_challenges: string | null;
  goals_short_term: string | null;
  goals_long_term: string | null;
  target_audience: string | null;
  competitors: string | null;
  sales_team_size: string | null;
  conversion_rate: string | null;
  average_ticket: string | null;
  acquisition_channels: string | null;
  has_structured_process: string | null;
  crm_usage: string | null;
  has_sales_goals: string | null;
  swot_strengths: string | null;
  swot_weaknesses: string | null;
  swot_opportunities: string | null;
  swot_threats: string | null;
  commercial_structure: string | null;
  growth_target: string | null;
  tools_used: string | null;
  objectives_with_unv: string | null;
  key_results: string | null;
  growth_expectation_3m: string | null;
  growth_expectation_6m: string | null;
  growth_expectation_12m: string | null;
}

interface GenerateStrategicPlanningDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyData: CompanyData;
  projectId?: string;
  onTaskCreated?: () => void;
}

// Helper to normalize text for matching (remove markdown, extra chars)
const normalizeText = (text: string): string => {
  return text
    .replace(/\*\*/g, "") // Remove markdown bold
    .replace(/\*/g, "")   // Remove markdown italic
    .replace(/#+\s*/g, "") // Remove markdown headers
    .replace(/[_~`]/g, "") // Remove other markdown
    .trim()
    .toUpperCase();
};

// Parse the content into structured sections
const parseContent = (content: string) => {
  const sections = {
    resumo: "",
    swot: {
      forcas: [] as string[],
      fraquezas: [] as string[],
      oportunidades: [] as string[],
      ameacas: [] as string[],
    },
    cronograma: [] as { title: string; subactions: string[] }[],
  };

  // Split by blocks
  const lines = content.split("\n");
  let currentSection = "";
  let currentSwotQuadrant = "";
  let currentAction: { title: string; subactions: string[] } | null = null;

  for (const line of lines) {
    const trimmedLine = line.trim();
    const normalizedLine = normalizeText(trimmedLine);
    
    // Detect main blocks - more flexible matching
    if (normalizedLine.includes("BLOCO 1") || 
        normalizedLine.includes("RESUMO COMPLETO") ||
        normalizedLine.includes("RESUMO DA EMPRESA") ||
        normalizedLine === "RESUMO") {
      currentSection = "resumo";
      currentSwotQuadrant = "";
      continue;
    }
    if (normalizedLine.includes("BLOCO 2") || 
        normalizedLine.includes("ANÁLISE SWOT") ||
        normalizedLine.includes("ANALISE SWOT") ||
        normalizedLine === "SWOT") {
      currentSection = "swot";
      currentSwotQuadrant = "";
      continue;
    }
    if (normalizedLine.includes("BLOCO 3") || 
        normalizedLine.includes("CRONOGRAMA") ||
        normalizedLine.includes("PLANO DE AÇÃO") ||
        normalizedLine.includes("PLANO DE ACAO") ||
        normalizedLine.includes("ACOES ESTRATEGICAS") ||
        normalizedLine.includes("AÇÕES ESTRATÉGICAS")) {
      currentSection = "cronograma";
      currentSwotQuadrant = "";
      // Save any pending action before switching
      if (currentAction) {
        sections.cronograma.push(currentAction);
        currentAction = null;
      }
      continue;
    }

    // Handle SWOT quadrants - more flexible matching
    if (currentSection === "swot" || normalizedLine.match(/^(FORÇAS|FRAQUEZAS|OPORTUNIDADES|AMEAÇAS)/)) {
      // Switch to SWOT section if we detect a quadrant header
      if (normalizedLine.match(/^(FORÇAS|FRAQUEZAS|OPORTUNIDADES|AMEAÇAS)/)) {
        currentSection = "swot";
      }
      
      if (normalizedLine.startsWith("FORÇA") || normalizedLine === "FORÇAS" || normalizedLine.includes("FORÇAS:")) {
        currentSwotQuadrant = "forcas";
        continue;
      }
      if (normalizedLine.startsWith("FRAQUEZA") || normalizedLine === "FRAQUEZAS" || normalizedLine.includes("FRAQUEZAS:")) {
        currentSwotQuadrant = "fraquezas";
        continue;
      }
      if (normalizedLine.startsWith("OPORTUNIDADE") || normalizedLine === "OPORTUNIDADES" || normalizedLine.includes("OPORTUNIDADES:")) {
        currentSwotQuadrant = "oportunidades";
        continue;
      }
      if (normalizedLine.startsWith("AMEAÇA") || normalizedLine === "AMEAÇAS" || normalizedLine.includes("AMEAÇAS:")) {
        currentSwotQuadrant = "ameacas";
        continue;
      }

      // Add items to current quadrant - handle various numbering formats
      if (currentSwotQuadrant) {
        const itemMatch = trimmedLine.match(/^(\d+)[.)]\s*(.+)/) || 
                          trimmedLine.match(/^[-•]\s*(.+)/);
        if (itemMatch) {
          const item = (itemMatch[2] || itemMatch[1]).replace(/\*\*/g, "").trim();
          if (item && currentSwotQuadrant in sections.swot) {
            (sections.swot as any)[currentSwotQuadrant].push(item);
          }
        }
      }
    }

    // Handle resumo
    if (currentSection === "resumo" && !currentSwotQuadrant) {
      // Stop resumo when we hit SWOT indicators
      if (normalizedLine.match(/^(FORÇAS|FRAQUEZAS|OPORTUNIDADES|AMEAÇAS)/)) {
        currentSection = "swot";
        if (normalizedLine.startsWith("FORÇA")) currentSwotQuadrant = "forcas";
        else if (normalizedLine.startsWith("FRAQUEZA")) currentSwotQuadrant = "fraquezas";
        else if (normalizedLine.startsWith("OPORTUNIDADE")) currentSwotQuadrant = "oportunidades";
        else if (normalizedLine.startsWith("AMEAÇA")) currentSwotQuadrant = "ameacas";
        continue;
      }
      if (trimmedLine) {
        // Clean markdown from resumo content
        const cleanLine = trimmedLine.replace(/\*\*/g, "");
        sections.resumo += cleanLine + "\n";
      }
    }

    // Handle cronograma - detect numbered actions even without explicit section header
    // NOTE: AI often wraps numbering in markdown (e.g. "**1.** ..."), so we match on a cleaned line.
    const cleanedLineForMatch = trimmedLine
      .replace(/^\s*(?:\*\*|__)+/g, "")
      .replace(/^\s*[-•]+\s*/g, "")
      .replace(/^\s*[>#]+\s*/g, "")
      .trim();

    if (
      currentSection === "cronograma" ||
      (currentSection !== "swot" && normalizeText(cleanedLineForMatch).match(/^(MES|MÊS|SEMANA|AÇÃO|ACAO)\s*\d+/i))
    ) {
      // Switch to cronograma if we detect action patterns
      if (normalizeText(cleanedLineForMatch).match(/^(MES|MÊS|SEMANA|AÇÃO|ACAO)\s*\d+/i)) {
        currentSection = "cronograma";
        currentSwotQuadrant = "";
      }

      // Check if it's a main action (numbered) - handle various formats
      // Match: "1. Title", "1) Title", "1 - Title", "Mês 1: Title", "Ação 1 - Title", etc.
      const mainActionMatch =
        cleanedLineForMatch.match(/^(\d+)\s*[.)]\s*(.+)/) ||
        cleanedLineForMatch.match(/^(\d+)\s*[-–—:]\s*(.+)/) ||
        cleanedLineForMatch.match(/^(MES|MÊS|SEMANA|AÇÃO|ACAO)\s*(\d+)\s*[:\-–—\s]+(.+)/i);

      if (mainActionMatch) {
        // Save previous action
        if (currentAction) {
          sections.cronograma.push(currentAction);
        }

        // Extract title - handle different match groups
        let title = "";
        if (mainActionMatch[3]) {
          // Pattern: "Mês 1: Title"
          title = String(mainActionMatch[3]).replace(/\*\*/g, "").trim();
        } else if (mainActionMatch[2]) {
          // Pattern: "1. Title" or "1 - Title"
          title = String(mainActionMatch[2]).replace(/\*\*/g, "").trim();
        }

        currentAction = { title, subactions: [] };
      } else if (currentAction && trimmedLine && !normalizedLine.match(/^BLOCO/)) {
        // It's a subaction - clean up the formatting
        const subaction = trimmedLine
          .replace(/^\s*(?:\*\*|__)+/g, "")
          .replace(/^[-•]\s*/, "")
          .replace(/^[a-z]\)\s*/i, "")
          .replace(/^\s*[–—-]\s*/, "")
          .replace(/\*\*/g, "")
          .trim();

        // Don't add if it looks like a new main action
        if (
          subaction &&
          !subaction.match(/^\d+\s*[.)]/) &&
          !subaction.match(/^\d+\s*[-–—:]/) &&
          !subaction.match(/^(MES|MÊS|SEMANA|AÇÃO|ACAO)\s*\d+/i)
        ) {
          currentAction.subactions.push(subaction);
        }
      }
    }
  }

  // Push last action
  if (currentAction) {
    sections.cronograma.push(currentAction);
  }

  return sections;
};

export const GenerateStrategicPlanningDialog = ({
  open,
  onOpenChange,
  companyData,
  projectId,
  onTaskCreated,
}: GenerateStrategicPlanningDialogProps) => {
  const [generating, setGenerating] = useState(false);
  const [content, setContent] = useState("");
  const [isComplete, setIsComplete] = useState(false);
  const [creatingTask, setCreatingTask] = useState(false);
  const [taskCreated, setTaskCreated] = useState(false);
  const [editableCronograma, setEditableCronograma] = useState<CronogramaAction[]>([]);
  const [editingActionIndex, setEditingActionIndex] = useState<number | null>(null);
  const [editingSubactionIndex, setEditingSubactionIndex] = useState<{ actionIdx: number; subIdx: number } | null>(null);
  const [newSubactionText, setNewSubactionText] = useState("");
  const [addingSubactionToAction, setAddingSubactionToAction] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setContent("");
      setIsComplete(false);
      setTaskCreated(false);
      setEditableCronograma([]);
      setEditingActionIndex(null);
      setEditingSubactionIndex(null);
    }
  }, [open]);

  // When content is complete, initialize editable cronograma
  useEffect(() => {
    if (isComplete && content) {
      const parsed = parseContent(content);
      setEditableCronograma(parsed.cronograma);
    }
  }, [isComplete, content]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [content]);

  const handleGenerate = async () => {
    setGenerating(true);
    setContent("");
    setIsComplete(false);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-strategic-planning`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            briefingData: companyData,
            companyName: companyData.name,
          }),
        }
      );

      if (!response.ok) {
        if (response.status === 429) {
          throw new Error("Limite de requisições excedido. Tente novamente em alguns minutos.");
        }
        if (response.status === 402) {
          throw new Error("Créditos insuficientes. Por favor, adicione créditos à sua conta.");
        }
        throw new Error("Erro ao gerar planejamento estratégico");
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No reader available");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);

          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") {
            setIsComplete(true);
            break;
          }

          try {
            const parsed = JSON.parse(jsonStr);
            const deltaContent = parsed.choices?.[0]?.delta?.content;
            if (deltaContent) {
              setContent((prev) => prev + deltaContent);
            }
          } catch {
            buffer = line + "\n" + buffer;
            break;
          }
        }
      }

      setIsComplete(true);
    } catch (error: any) {
      console.error("Error generating strategic planning:", error);
      toast.error(error.message || "Erro ao gerar planejamento estratégico");
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    toast.success("Planejamento copiado para a área de transferência");
  };

  // Cronograma editing functions
  const moveAction = (index: number, direction: "up" | "down") => {
    const newCronograma = [...editableCronograma];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newCronograma.length) return;
    [newCronograma[index], newCronograma[targetIndex]] = [newCronograma[targetIndex], newCronograma[index]];
    setEditableCronograma(newCronograma);
  };

  const deleteAction = (index: number) => {
    setEditableCronograma(editableCronograma.filter((_, i) => i !== index));
  };

  const updateActionTitle = (index: number, newTitle: string) => {
    const newCronograma = [...editableCronograma];
    newCronograma[index].title = newTitle;
    setEditableCronograma(newCronograma);
  };

  const addNewAction = () => {
    setEditableCronograma([...editableCronograma, { title: "Nova ação", subactions: [] }]);
    setEditingActionIndex(editableCronograma.length);
  };

  const deleteSubaction = (actionIdx: number, subIdx: number) => {
    const newCronograma = [...editableCronograma];
    newCronograma[actionIdx].subactions = newCronograma[actionIdx].subactions.filter((_, i) => i !== subIdx);
    setEditableCronograma(newCronograma);
  };

  const updateSubaction = (actionIdx: number, subIdx: number, newText: string) => {
    const newCronograma = [...editableCronograma];
    newCronograma[actionIdx].subactions[subIdx] = newText;
    setEditableCronograma(newCronograma);
  };

  const addSubaction = (actionIdx: number) => {
    if (!newSubactionText.trim()) return;
    const newCronograma = [...editableCronograma];
    newCronograma[actionIdx].subactions.push(newSubactionText.trim());
    setEditableCronograma(newCronograma);
    setNewSubactionText("");
    setAddingSubactionToAction(null);
  };

  const handleDownload = async () => {
    if (!parsedContent) {
      toast.error("Aguarde a geração do planejamento");
      return;
    }

    try {
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 20;
      const contentWidth = pageWidth - margin * 2;
      let y = margin;

      // Colors
      const primaryColor: [number, number, number] = [10, 34, 64]; // #0A2240
      const redColor: [number, number, number] = [196, 30, 58]; // #C41E3A
      const greenColor: [number, number, number] = [34, 139, 34];
      const orangeColor: [number, number, number] = [255, 140, 0];
      const blueColor: [number, number, number] = [30, 90, 180];

      // Helper function to check page break
      const checkPageBreak = (neededHeight: number) => {
        if (y + neededHeight > pageHeight - margin) {
          pdf.addPage();
          y = margin;
          return true;
        }
        return false;
      };

      // Helper function to wrap text
      const wrapText = (text: string, maxWidth: number, fontSize: number): string[] => {
        pdf.setFontSize(fontSize);
        return pdf.splitTextToSize(text, maxWidth);
      };

      // Load and add logo with high quality
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = logoUnv;
      await new Promise((resolve) => {
        img.onload = resolve;
        img.onerror = resolve;
      });

      if (img.complete && img.naturalWidth > 0) {
        // Use canvas to render at higher resolution for better quality
        const scale = 3; // Render at 3x resolution for crisp output
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth * scale;
        canvas.height = img.naturalHeight * scale;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = "high";
          ctx.scale(scale, scale);
          ctx.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight);
        }
        
        const logoWidth = 60; // Slightly larger logo
        const logoHeight = (img.naturalHeight / img.naturalWidth) * logoWidth;
        const logoDataUrl = canvas.toDataURL("image/png", 1.0);
        pdf.addImage(logoDataUrl, "PNG", (pageWidth - logoWidth) / 2, y, logoWidth, logoHeight, undefined, "FAST");
        y += logoHeight + 10;
      }

      // Title
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(20);
      pdf.setTextColor(...primaryColor);
      const title = "PLANEJAMENTO ESTRATÉGICO";
      pdf.text(title, pageWidth / 2, y, { align: "center" });
      y += 8;

      // Company name
      pdf.setFontSize(14);
      pdf.setTextColor(...redColor);
      pdf.text(companyData.name.toUpperCase(), pageWidth / 2, y, { align: "center" });
      y += 6;

      // Date
      pdf.setFontSize(10);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(100, 100, 100);
      const date = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
      pdf.text(date, pageWidth / 2, y, { align: "center" });
      y += 15;

      // Divider line
      pdf.setDrawColor(...primaryColor);
      pdf.setLineWidth(0.5);
      pdf.line(margin, y, pageWidth - margin, y);
      y += 12;

      // BLOCO 1 - RESUMO
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(14);
      pdf.setTextColor(...primaryColor);
      pdf.text("RESUMO DA EMPRESA", margin, y);
      y += 8;

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(10);
      pdf.setTextColor(40, 40, 40);

      const resumoLines = parsedContent.resumo.trim().split("\n");
      for (const line of resumoLines) {
        if (line.trim()) {
          const wrapped = wrapText(line, contentWidth, 10);
          for (const wl of wrapped) {
            checkPageBreak(6);
            // Bold the label part if it contains ":"
            if (line.includes(":")) {
              const colonIndex = wl.indexOf(":");
              if (colonIndex > 0 && colonIndex < 30) {
                pdf.setFont("helvetica", "bold");
                pdf.text(wl.substring(0, colonIndex + 1), margin, y);
                const labelWidth = pdf.getTextWidth(wl.substring(0, colonIndex + 1));
                pdf.setFont("helvetica", "normal");
                pdf.text(wl.substring(colonIndex + 1), margin + labelWidth, y);
              } else {
                pdf.text(wl, margin, y);
              }
            } else {
              pdf.text(wl, margin, y);
            }
            y += 5;
          }
        }
      }
      y += 8;

      // BLOCO 2 - SWOT
      checkPageBreak(30);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(14);
      pdf.setTextColor(...primaryColor);
      pdf.text("ANÁLISE SWOT", margin, y);
      y += 10;

      const swotBoxWidth = (contentWidth - 5) / 2;
      const swotStartY = y;
      let maxSwotY = y;

      // Helper to draw SWOT quadrant
      const drawSwotQuadrant = (
        title: string,
        items: string[],
        x: number,
        startY: number,
        color: [number, number, number]
      ): number => {
        let localY = startY;
        
        // Title
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(11);
        pdf.setTextColor(...color);
        pdf.text(title, x, localY);
        localY += 6;

        // Items
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(9);
        pdf.setTextColor(40, 40, 40);

        for (let i = 0; i < items.length; i++) {
          const itemText = `${i + 1}. ${items[i]}`;
          const wrapped = wrapText(itemText, swotBoxWidth - 5, 9);
          for (const line of wrapped) {
            checkPageBreak(5);
            pdf.text(line, x, localY);
            localY += 4.5;
          }
        }
        return localY;
      };

      // Draw quadrants
      const forcasEndY = drawSwotQuadrant("FORÇAS", parsedContent.swot.forcas, margin, swotStartY, greenColor);
      const fraquezasEndY = drawSwotQuadrant("FRAQUEZAS", parsedContent.swot.fraquezas, margin + swotBoxWidth + 5, swotStartY, redColor);
      maxSwotY = Math.max(forcasEndY, fraquezasEndY) + 8;

      checkPageBreak(30);
      y = maxSwotY;
      const oportunidadesEndY = drawSwotQuadrant("OPORTUNIDADES", parsedContent.swot.oportunidades, margin, y, blueColor);
      const ameacasEndY = drawSwotQuadrant("AMEAÇAS", parsedContent.swot.ameacas, margin + swotBoxWidth + 5, y, orangeColor);
      y = Math.max(oportunidadesEndY, ameacasEndY) + 12;

      // BLOCO 3 - CRONOGRAMA
      checkPageBreak(20);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(14);
      pdf.setTextColor(...primaryColor);
      pdf.text("CRONOGRAMA DE AÇÕES", margin, y);
      y += 10;

      for (let i = 0; i < editableCronograma.length; i++) {
        const action = editableCronograma[i];
        checkPageBreak(15);

        // Action number and title
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(11);
        pdf.setTextColor(...primaryColor);
        const actionTitle = `${i + 1}. ${action.title}`;
        const titleWrapped = wrapText(actionTitle, contentWidth, 11);
        for (const line of titleWrapped) {
          pdf.text(line, margin, y);
          y += 5;
        }
        y += 2;

        // Subactions
        if (action.subactions.length > 0) {
          pdf.setFont("helvetica", "normal");
          pdf.setFontSize(9);
          pdf.setTextColor(60, 60, 60);
          
          for (const sub of action.subactions) {
            checkPageBreak(6);
            const subText = `   • ${sub}`;
            const subWrapped = wrapText(subText, contentWidth - 10, 9);
            for (const line of subWrapped) {
              pdf.text(line, margin + 3, y);
              y += 4.5;
            }
          }
        }
        y += 5;
      }

      // Footer on last page
      y = pageHeight - 15;
      pdf.setFont("helvetica", "italic");
      pdf.setFontSize(8);
      pdf.setTextColor(120, 120, 120);
      pdf.text("Universidade Nacional de Vendas • universidadevendas.com.br", pageWidth / 2, y, { align: "center" });

      // Save PDF
      pdf.save(`planejamento-estrategico-${companyData.name.replace(/\s+/g, "-").toLowerCase()}.pdf`);
      toast.success("PDF gerado com sucesso!");
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast.error("Erro ao gerar PDF");
    }
  };

  const handleCreateTask = async () => {
    if (!projectId) {
      toast.error("Projeto não encontrado");
      return;
    }

    setCreatingTask(true);
    try {
      const { data: project, error: projectError } = await supabase
        .from("onboarding_projects")
        .select("product_id")
        .eq("id", projectId)
        .single();

      if (projectError) throw projectError;

      let productId = project.product_id;

      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (productId && !uuidRegex.test(productId)) {
        const { data: service, error: serviceError } = await supabase
          .from("onboarding_services")
          .select("id")
          .ilike("name", productId)
          .maybeSingle();

        if (serviceError) {
          console.error("Error fetching service by name:", serviceError);
        } else if (service) {
          productId = service.id;
        }
      }

      if (!productId) {
        toast.error("Produto não encontrado para o projeto");
        return;
      }

      let phaseId: string | null = null;

      const { data: existingPhases, error: phasesError } = await supabase
        .from("onboarding_service_phases")
        .select("id, name")
        .eq("service_id", productId)
        .ilike("name", "%planejamento%")
        .limit(1);

      if (phasesError) throw phasesError;

      if (existingPhases && existingPhases.length > 0) {
        phaseId = existingPhases[0].id;
      } else {
        const { data: maxOrderData } = await supabase
          .from("onboarding_service_phases")
          .select("sort_order")
          .eq("service_id", productId)
          .order("sort_order", { ascending: false })
          .limit(1);

        const nextOrder = (maxOrderData?.[0]?.sort_order || 0) + 1;

        const { data: newPhase, error: createPhaseError } = await supabase
          .from("onboarding_service_phases")
          .insert({
            service_id: productId,
            name: "Planejamento Estratégico",
            description: "Fase de planejamento estratégico comercial",
            sort_order: nextOrder,
          })
          .select()
          .single();

        if (createPhaseError) throw createPhaseError;
        phaseId = newPhase.id;
      }

      // Build updated content with edited cronograma
      const cronogramaText = editableCronograma.map((action, i) => {
        let text = `${i + 1}. ${action.title}`;
        if (action.subactions.length > 0) {
          text += "\n" + action.subactions.map(sub => `   • ${sub}`).join("\n");
        }
        return text;
      }).join("\n\n");

      const parsedForTask = parseContent(content);
      const fullContent = `RESUMO DA EMPRESA\n\n${parsedForTask.resumo.trim()}\n\nANÁLISE SWOT\n\nFORÇAS:\n${parsedForTask.swot.forcas.map((f, i) => `${i + 1}. ${f}`).join("\n")}\n\nFRAQUEZAS:\n${parsedForTask.swot.fraquezas.map((f, i) => `${i + 1}. ${f}`).join("\n")}\n\nOPORTUNIDADES:\n${parsedForTask.swot.oportunidades.map((f, i) => `${i + 1}. ${f}`).join("\n")}\n\nAMEAÇAS:\n${parsedForTask.swot.ameacas.map((f, i) => `${i + 1}. ${f}`).join("\n")}\n\nCRONOGRAMA DE AÇÕES\n\n${cronogramaText}`;

      const { error: taskError } = await supabase.from("onboarding_tasks").insert({
        project_id: projectId,
        phase_id: phaseId,
        title: "Planejamento Estratégico",
        description: fullContent,
        status: "pending",
        priority: "high",
      });

      if (taskError) throw taskError;

      setTaskCreated(true);
      toast.success("Tarefa 'Planejamento Estratégico' criada com sucesso!");
      onTaskCreated?.();
    } catch (error: any) {
      console.error("Error creating task:", error);
      toast.error("Erro ao criar tarefa");
    } finally {
      setCreatingTask(false);
    }
  };

  const parsedContent = isComplete ? parseContent(content) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 py-4 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Planejamento Estratégico - {companyData.name}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto" ref={scrollRef}>
          {!content && !generating ? (
            <div className="flex flex-col items-center justify-center py-16 gap-4 px-6">
              <FileText className="h-16 w-16 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground text-center max-w-md">
                Clique no botão abaixo para gerar o planejamento estratégico com base nos dados do briefing da empresa.
              </p>
              <Button onClick={handleGenerate} size="lg" className="mt-4">
                <FileText className="h-4 w-4 mr-2" />
                Gerar Planejamento Estratégico
              </Button>
            </div>
          ) : isComplete && parsedContent ? (
            <div className="p-6 space-y-6">
              {/* Resumo Section */}
              <div className="rounded-lg border bg-card">
                <div className="flex items-center gap-2 px-4 py-3 border-b bg-muted/50">
                  <FileText className="h-4 w-4 text-primary" />
                  <h3 className="font-semibold">Resumo da Empresa</h3>
                </div>
                <div className="p-4">
                  <pre className="whitespace-pre-wrap text-sm font-sans leading-relaxed">
                    {parsedContent.resumo.trim()}
                  </pre>
                </div>
              </div>

              {/* SWOT Section */}
              <div className="rounded-lg border bg-card">
                <div className="flex items-center gap-2 px-4 py-3 border-b bg-muted/50">
                  <Target className="h-4 w-4 text-primary" />
                  <h3 className="font-semibold">Análise SWOT</h3>
                </div>
                <div className="p-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Forças */}
                    <div className="rounded-lg border-2 border-green-500/30 bg-green-500/5 p-4">
                      <h4 className="font-semibold text-green-700 dark:text-green-400 mb-3 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-green-500" />
                        Forças
                      </h4>
                      <ol className="space-y-2 text-sm">
                        {parsedContent.swot.forcas.map((item, i) => (
                          <li key={i} className="flex gap-2">
                            <span className="text-green-600 font-medium shrink-0">{i + 1}.</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ol>
                    </div>

                    {/* Fraquezas */}
                    <div className="rounded-lg border-2 border-red-500/30 bg-red-500/5 p-4">
                      <h4 className="font-semibold text-red-700 dark:text-red-400 mb-3 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-red-500" />
                        Fraquezas
                      </h4>
                      <ol className="space-y-2 text-sm">
                        {parsedContent.swot.fraquezas.map((item, i) => (
                          <li key={i} className="flex gap-2">
                            <span className="text-red-600 font-medium shrink-0">{i + 1}.</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ol>
                    </div>

                    {/* Oportunidades */}
                    <div className="rounded-lg border-2 border-blue-500/30 bg-blue-500/5 p-4">
                      <h4 className="font-semibold text-blue-700 dark:text-blue-400 mb-3 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-blue-500" />
                        Oportunidades
                      </h4>
                      <ol className="space-y-2 text-sm">
                        {parsedContent.swot.oportunidades.map((item, i) => (
                          <li key={i} className="flex gap-2">
                            <span className="text-blue-600 font-medium shrink-0">{i + 1}.</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ol>
                    </div>

                    {/* Ameaças */}
                    <div className="rounded-lg border-2 border-orange-500/30 bg-orange-500/5 p-4">
                      <h4 className="font-semibold text-orange-700 dark:text-orange-400 mb-3 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-orange-500" />
                        Ameaças
                      </h4>
                      <ol className="space-y-2 text-sm">
                        {parsedContent.swot.ameacas.map((item, i) => (
                          <li key={i} className="flex gap-2">
                            <span className="text-orange-600 font-medium shrink-0">{i + 1}.</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  </div>
                </div>
              </div>

              {/* Cronograma Section - Editable */}
              <div className="rounded-lg border bg-card">
                <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/50">
                  <div className="flex items-center gap-2">
                    <ListChecks className="h-4 w-4 text-primary" />
                    <h3 className="font-semibold">Cronograma de Ações</h3>
                  </div>
                  <Button size="sm" variant="outline" onClick={addNewAction}>
                    <Plus className="h-4 w-4 mr-1" />
                    Nova Ação
                  </Button>
                </div>
                <div className="p-4">
                  <div className="space-y-3">
                    {editableCronograma.map((action, i) => (
                      <div key={i} className="rounded-lg border bg-muted/30 p-4 group">
                        <div className="flex items-start gap-2">
                          {/* Reorder buttons */}
                          <div className="flex flex-col gap-0.5 shrink-0">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => moveAction(i, "up")}
                              disabled={i === 0}
                            >
                              <ChevronUp className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => moveAction(i, "down")}
                              disabled={i === editableCronograma.length - 1}
                            >
                              <ChevronDown className="h-3 w-3" />
                            </Button>
                          </div>

                          {/* Action number */}
                          <span className="shrink-0 w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold mt-1">
                            {i + 1}
                          </span>

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            {/* Title */}
                            {editingActionIndex === i ? (
                              <div className="flex items-center gap-2">
                                <Input
                                  value={action.title}
                                  onChange={(e) => updateActionTitle(i, e.target.value)}
                                  className="flex-1 h-8 text-sm font-semibold"
                                  autoFocus
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") setEditingActionIndex(null);
                                    if (e.key === "Escape") setEditingActionIndex(null);
                                  }}
                                  onBlur={() => setEditingActionIndex(null)}
                                />
                              </div>
                            ) : (
                              <div
                                className="font-semibold text-sm cursor-pointer hover:text-primary flex items-center gap-2 group/title"
                                onClick={() => setEditingActionIndex(i)}
                              >
                                {action.title}
                                <Pencil className="h-3 w-3 opacity-0 group-hover/title:opacity-50" />
                              </div>
                            )}

                            {/* Subactions */}
                            <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                              {action.subactions.map((sub, j) => (
                                <li key={j} className="flex items-start gap-2 group/sub">
                                  <span className="shrink-0 mt-1.5 w-1.5 h-1.5 rounded-full bg-muted-foreground/50" />
                                  {editingSubactionIndex?.actionIdx === i && editingSubactionIndex?.subIdx === j ? (
                                    <Input
                                      value={sub}
                                      onChange={(e) => updateSubaction(i, j, e.target.value)}
                                      className="flex-1 h-7 text-sm"
                                      autoFocus
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter") setEditingSubactionIndex(null);
                                        if (e.key === "Escape") setEditingSubactionIndex(null);
                                      }}
                                      onBlur={() => setEditingSubactionIndex(null)}
                                    />
                                  ) : (
                                    <>
                                      <span
                                        className="flex-1 cursor-pointer hover:text-foreground"
                                        onClick={() => setEditingSubactionIndex({ actionIdx: i, subIdx: j })}
                                      >
                                        {sub}
                                      </span>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-5 w-5 opacity-0 group-hover/sub:opacity-100 shrink-0 text-destructive hover:text-destructive"
                                        onClick={() => deleteSubaction(i, j)}
                                      >
                                        <X className="h-3 w-3" />
                                      </Button>
                                    </>
                                  )}
                                </li>
                              ))}

                              {/* Add subaction */}
                              {addingSubactionToAction === i ? (
                                <li className="flex items-center gap-2 mt-2">
                                  <Input
                                    placeholder="Nova subação..."
                                    value={newSubactionText}
                                    onChange={(e) => setNewSubactionText(e.target.value)}
                                    className="flex-1 h-7 text-sm"
                                    autoFocus
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") addSubaction(i);
                                      if (e.key === "Escape") {
                                        setAddingSubactionToAction(null);
                                        setNewSubactionText("");
                                      }
                                    }}
                                  />
                                  <Button size="sm" variant="ghost" className="h-7" onClick={() => addSubaction(i)}>
                                    <Check className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7"
                                    onClick={() => {
                                      setAddingSubactionToAction(null);
                                      setNewSubactionText("");
                                    }}
                                  >
                                    <X className="h-3 w-3" />
                                  </Button>
                                </li>
                              ) : (
                                <li>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 text-xs text-muted-foreground hover:text-foreground mt-1"
                                    onClick={() => setAddingSubactionToAction(i)}
                                  >
                                    <Plus className="h-3 w-3 mr-1" />
                                    Adicionar subação
                                  </Button>
                                </li>
                              )}
                            </ul>
                          </div>

                          {/* Delete action button */}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive shrink-0"
                            onClick={() => deleteAction(i)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}

                    {editableCronograma.length === 0 && (
                      <div className="text-center py-8 text-muted-foreground">
                        <p>Nenhuma ação no cronograma.</p>
                        <Button variant="outline" className="mt-2" onClick={addNewAction}>
                          <Plus className="h-4 w-4 mr-2" />
                          Adicionar primeira ação
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-6">
              <div className="rounded-lg border bg-muted/30 p-4">
                <pre className="whitespace-pre-wrap text-sm font-sans leading-relaxed">
                  {content || "Gerando..."}
                </pre>
                {generating && (
                  <div className="flex items-center gap-2 mt-4 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Gerando planejamento...</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {(isComplete || generating) && (
          <div className="shrink-0 flex flex-wrap gap-2 p-4 border-t bg-muted/30">
            <Button variant="outline" size="sm" onClick={handleCopy} disabled={!isComplete}>
              <Copy className="h-4 w-4 mr-2" />
              Copiar
            </Button>
            <Button variant="outline" size="sm" onClick={handleDownload} disabled={!isComplete}>
              <Download className="h-4 w-4 mr-2" />
              Baixar
            </Button>
            {projectId && !taskCreated && (
              <Button size="sm" onClick={handleCreateTask} disabled={creatingTask || !isComplete}>
                {creatingTask ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Criando...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Criar Tarefa na Jornada
                  </>
                )}
              </Button>
            )}
            {taskCreated && (
              <span className="flex items-center gap-2 text-sm text-green-600">
                <Check className="h-4 w-4" />
                Tarefa criada!
              </span>
            )}
            <Button variant="ghost" size="sm" onClick={handleGenerate} disabled={generating}>
              Gerar Novamente
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
