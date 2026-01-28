import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  BookOpen, 
  Link, 
  ClipboardList, 
  Edit3, 
  Eye, 
  Download, 
  History 
} from "lucide-react";
import { CultureOverviewSection } from "../culture-manual/CultureOverviewSection";
import { CultureFormLinkSection } from "../culture-manual/CultureFormLinkSection";
import { CultureResponsesSection } from "../culture-manual/CultureResponsesSection";
import { CultureEditorSection } from "../culture-manual/CultureEditorSection";
import { CulturePreviewSection } from "../culture-manual/CulturePreviewSection";
import { CulturePDFSection } from "../culture-manual/CulturePDFSection";
import { CultureVersionsSection } from "../culture-manual/CultureVersionsSection";

interface CultureManualTabProps {
  projectId: string;
  canEdit: boolean;
  isStaff: boolean;
}

export function CultureManualTab({ projectId, canEdit, isStaff }: CultureManualTabProps) {
  const [activeTab, setActiveTab] = useState("overview");

  // If not staff (client/employee), show only the read-only view
  if (!isStaff) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <BookOpen className="h-6 w-6 text-primary" />
          <h2 className="text-2xl font-bold">Manual de Cultura</h2>
        </div>
        <CulturePreviewSection projectId={projectId} readOnly />
        <CulturePDFSection projectId={projectId} readOnly />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <BookOpen className="h-6 w-6 text-primary" />
        <h2 className="text-2xl font-bold">Manual de Cultura</h2>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex flex-wrap h-auto gap-1 bg-muted/50 p-1">
          <TabsTrigger value="overview" className="gap-2">
            <BookOpen className="h-4 w-4" />
            <span className="hidden sm:inline">Visão Geral</span>
          </TabsTrigger>
          <TabsTrigger value="form-link" className="gap-2">
            <Link className="h-4 w-4" />
            <span className="hidden sm:inline">Link do Formulário</span>
          </TabsTrigger>
          <TabsTrigger value="responses" className="gap-2">
            <ClipboardList className="h-4 w-4" />
            <span className="hidden sm:inline">Respostas</span>
          </TabsTrigger>
          <TabsTrigger value="editor" className="gap-2">
            <Edit3 className="h-4 w-4" />
            <span className="hidden sm:inline">Editor</span>
          </TabsTrigger>
          <TabsTrigger value="preview" className="gap-2">
            <Eye className="h-4 w-4" />
            <span className="hidden sm:inline">Pré-visualização</span>
          </TabsTrigger>
          <TabsTrigger value="download" className="gap-2">
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Download PDF</span>
          </TabsTrigger>
          <TabsTrigger value="versions" className="gap-2">
            <History className="h-4 w-4" />
            <span className="hidden sm:inline">Versões</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          <CultureOverviewSection projectId={projectId} />
        </TabsContent>

        <TabsContent value="form-link" className="mt-6">
          <CultureFormLinkSection projectId={projectId} canEdit={canEdit} />
        </TabsContent>

        <TabsContent value="responses" className="mt-6">
          <CultureResponsesSection projectId={projectId} />
        </TabsContent>

        <TabsContent value="editor" className="mt-6">
          <CultureEditorSection projectId={projectId} canEdit={canEdit} />
        </TabsContent>

        <TabsContent value="preview" className="mt-6">
          <CulturePreviewSection projectId={projectId} />
        </TabsContent>

        <TabsContent value="download" className="mt-6">
          <CulturePDFSection projectId={projectId} />
        </TabsContent>

        <TabsContent value="versions" className="mt-6">
          <CultureVersionsSection projectId={projectId} canEdit={canEdit} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
