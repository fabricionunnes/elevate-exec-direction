import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { 
  Presentation, 
  ChevronDown, 
  ChevronUp, 
  Play, 
  CheckCircle2,
  History,
  Sparkles,
  RefreshCw,
  Pencil
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

import { useMeetingPresentation } from "./useMeetingPresentation";
import { useDragScroll } from "@/hooks/useDragScroll";
import { PresentationBriefingForm } from "./PresentationBriefingForm";
import { PresentationSlidePreview } from "./PresentationSlidePreview";
import { PresentationViewer } from "./PresentationViewer";
import { PresentationPDFExport } from "./PresentationPDFExport";
import { SlideEditor } from "./SlideEditor";
import type { PresentationSlide, SlideContent } from "./types";

interface MeetingPresentationSectionProps {
  meetingId: string;
  projectId: string;
  isStaff: boolean;
  isClientView?: boolean;
}

export function MeetingPresentationSection({
  meetingId,
  projectId,
  isStaff,
  isClientView = false,
}: MeetingPresentationSectionProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showViewer, setShowViewer] = useState(false);
  const [selectedSlide, setSelectedSlide] = useState(0);
  const [editingSlide, setEditingSlide] = useState<PresentationSlide | null>(null);
  const [savingSlide, setSavingSlide] = useState(false);
  const thumbnailsDrag = useDragScroll();

  const {
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
    refresh,
  } = useMeetingPresentation(meetingId, projectId);

  // Client view: only show approved presentations
  if (isClientView && (!currentVersion || currentVersion.status !== 'approved')) {
    return null;
  }

  const hasPresentation = !!presentation && slides.length > 0;
  const canEdit = isStaff && !isClientView;
  const canApprove = canEdit && currentVersion?.status === 'draft';
  const isApproved = currentVersion?.status === 'approved';

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "";
    try {
      return format(new Date(dateStr), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
    } catch {
      return dateStr;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Presentation className="h-5 w-5" />
            <Skeleton className="h-6 w-48" />
          </div>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader className="pb-3">
          <CollapsibleTrigger asChild>
            <div className="flex items-center justify-between cursor-pointer hover:bg-muted/50 -mx-6 -my-4 px-6 py-4 rounded-t-lg transition-colors">
              <div className="flex items-center gap-3">
                <Presentation className="h-5 w-5 text-primary" />
                <CardTitle className="text-base">Apresentação da Reunião</CardTitle>
                {hasPresentation && (
                  <Badge variant={isApproved ? "default" : "secondary"} className="text-xs">
                    {isApproved ? (
                      <>
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Aprovada
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-3 w-3 mr-1" />
                        Rascunho
                      </>
                    )}
                  </Badge>
                )}
              </div>
              {isOpen ? (
                <ChevronUp className="h-5 w-5 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
          </CollapsibleTrigger>
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="space-y-4">
            {/* Briefing form - only for staff */}
            {canEdit && (
              <div className="bg-muted/30 rounded-lg p-4">
                <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                  <Sparkles className="h-4 w-4" />
                  Briefing da Apresentação
                </h4>
                <PresentationBriefingForm
                  presentation={presentation}
                  onGenerate={generatePresentation}
                  onSave={saveBriefing}
                  generating={generating}
                  saving={saving}
                  meetingTitle={meetingTitle}
                />
              </div>
            )}

            {/* Version selector */}
            {versions.length > 1 && canEdit && (
              <div className="flex items-center gap-3">
                <History className="h-4 w-4 text-muted-foreground" />
                <Select
                  value={currentVersion?.id}
                  onValueChange={selectVersion}
                >
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Selecionar versão" />
                  </SelectTrigger>
                  <SelectContent>
                    {versions.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        Versão {v.version_number}
                        {v.status === 'approved' && ' ✓'}
                        {v.status === 'draft' && ' (rascunho)'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {currentVersion && (
                  <span className="text-xs text-muted-foreground">
                    Gerada em {formatDate(currentVersion.created_at)}
                  </span>
                )}
              </div>
            )}

            {/* Slides preview */}
            {hasPresentation && (
              <>
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium">
                    Slides ({slides.length})
                  </h4>
                  <div className="flex items-center gap-2">
                    {canEdit && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={refresh}
                      >
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                    )}
                    <PresentationPDFExport
                      slides={slides}
                      companyName={companyName}
                      title={presentation?.subject || "Apresentação"}
                      meetingDate={meetingDate}
                    />
                    <Button onClick={() => setShowViewer(true)}>
                      <Play className="h-4 w-4 mr-2" />
                      Apresentar
                    </Button>
                  </div>
                </div>

                <div className="relative">
                  <div
                    ref={thumbnailsDrag.ref}
                    {...thumbnailsDrag.bind}
                    className={
                      "overflow-x-auto pb-3 " +
                      "scrollbar-thin scrollbar-thumb-muted-foreground/30 scrollbar-track-muted/20 " +
                      "select-none touch-pan-x " +
                      (thumbnailsDrag.isDragging ? "cursor-grabbing" : "cursor-grab")
                    }
                    style={{ scrollbarWidth: "thin" }}
                  >
                    <div className="flex gap-3 min-w-max">
                      {slides.map((slide, index) => (
                        <div key={slide.id} className="w-40 flex-shrink-0">
                          <PresentationSlidePreview
                            slide={slide}
                            companyName={companyName}
                            isActive={selectedSlide === index}
                            onClick={() => setSelectedSlide(index)}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  {/* Navigation indicator */}
                  {slides.length > 5 && (
                    <div className="flex items-center justify-center gap-2 mt-1 text-xs text-muted-foreground">
                      <span>← Arraste para ver mais slides →</span>
                    </div>
                  )}
                </div>

                {/* Selected slide large preview with edit button */}
                {slides[selectedSlide] && (
                  <div className="border rounded-lg relative">
                    <div className="aspect-video max-w-2xl mx-auto">
                      <PresentationSlidePreview
                        slide={slides[selectedSlide]}
                        companyName={companyName}
                        size="large"
                      />
                    </div>
                    {/* Edit button - always visible with high contrast */}
                    {canEdit && (
                      <div className="absolute bottom-4 right-4 z-50">
                        <Button
                          size="sm"
                          className="bg-white hover:bg-gray-100 text-gray-900 shadow-xl border border-gray-200 font-medium"
                          onClick={() => setEditingSlide(slides[selectedSlide])}
                        >
                          <Pencil className="h-4 w-4 mr-2" />
                          Editar Slide
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                {/* Actions */}
                {canApprove && (
                  <div className="flex justify-end gap-2 pt-2 border-t">
                    <Button
                      variant="default"
                      onClick={approveVersion}
                    >
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Aprovar Esta Versão
                    </Button>
                  </div>
                )}
              </>
            )}

            {/* Empty state */}
            {!hasPresentation && !canEdit && (
              <div className="text-center py-8 text-muted-foreground">
                <Presentation className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>Nenhuma apresentação gerada ainda.</p>
              </div>
            )}

            {/* Presentation viewer modal */}
            <PresentationViewer
              slides={slides}
              companyName={companyName}
              title={presentation?.subject || "Apresentação"}
              open={showViewer}
              onOpenChange={setShowViewer}
            />

            {/* Slide editor modal */}
            {editingSlide && (
              <SlideEditor
                slide={editingSlide}
                open={!!editingSlide}
                onOpenChange={(open) => !open && setEditingSlide(null)}
                onSave={async (slideId, updates) => {
                  setSavingSlide(true);
                  try {
                    await updateSlide(slideId, updates);
                    setEditingSlide(null);
                  } finally {
                    setSavingSlide(false);
                  }
                }}
                saving={savingSlide}
              />
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
