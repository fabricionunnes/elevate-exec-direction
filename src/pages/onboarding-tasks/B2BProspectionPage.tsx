import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Download, Save, FileSpreadsheet, FileText, File } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SearchFilters } from "@/components/b2b-prospection/SearchFilters";
import { LeadsTable } from "@/components/b2b-prospection/LeadsTable";
import { MetricCards } from "@/components/b2b-prospection/MetricCards";
import { SearchHistory } from "@/components/b2b-prospection/SearchHistory";
import { SavedLists } from "@/components/b2b-prospection/SavedLists";
import { SaveListDialog } from "@/components/b2b-prospection/SaveListDialog";
import { LeadNoteDialog } from "@/components/b2b-prospection/LeadNoteDialog";
import { useLeadSearch } from "@/hooks/useLeadSearch";
import { useSavedLists } from "@/hooks/useSavedLists";
import { useExportLeads } from "@/hooks/useExportLeads";
import { B2B_LEAD_STATUSES } from "@/types/b2bProspection";
import type { B2BLead, B2BLeadStatus } from "@/types/b2bProspection";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const B2BProspectionPage = () => {
  const navigate = useNavigate();
  const { results, loading, search, clearResults } = useLeadSearch();
  const { lists, loading: listsLoading, createList, deleteList, getListLeads } = useSavedLists();
  const { exportCSV, exportXLSX, exportPDF } = useExportLeads();

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [noteDialogLead, setNoteDialogLead] = useState<B2BLead | null>(null);
  const [activeTab, setActiveTab] = useState("search");
  const [viewingListId, setViewingListId] = useState<string | null>(null);
  const [listLeads, setListLeads] = useState<B2BLead[]>([]);
  const [existingPhones, setExistingPhones] = useState<Set<string>>(new Set());

  // Metrics
  const [totalProspected, setTotalProspected] = useState(0);
  const [searchesToday, setSearchesToday] = useState(0);

  useEffect(() => {
    fetchMetrics();
    fetchExistingPhones();
  }, []);

  const fetchMetrics = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { count: totalLeads } = await supabase
      .from("b2b_leads")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id);
    setTotalProspected(totalLeads || 0);

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const { count: todaySearches } = await supabase
      .from("b2b_search_logs")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("created_at", todayStart.toISOString());
    setSearchesToday(todaySearches || 0);
  };

  const fetchExistingPhones = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("b2b_leads")
      .select("phone")
      .eq("user_id", user.id)
      .not("phone", "is", null);

    const phones = new Set((data || []).map((d: any) => d.phone).filter(Boolean));
    setExistingPhones(phones);
  };

  const handleViewList = async (listId: string) => {
    const leads = await getListLeads(listId);
    setListLeads(leads);
    setViewingListId(listId);
    setActiveTab("search");
  };

  const selectedLeads = useMemo(() => {
    const source = viewingListId ? listLeads : results;
    if (selectedIds.size === 0) return source;
    return source.filter((l) => selectedIds.has(l.place_id));
  }, [results, listLeads, selectedIds, viewingListId]);

  const displayLeads = viewingListId ? listLeads : results;

  const getExportFilename = () => {
    const date = new Date().toISOString().split("T")[0];
    return `leads_b2b_${date}`;
  };

  const handleExport = (format: "csv" | "xlsx" | "pdf") => {
    const leadsToExport = selectedIds.size > 0 ? selectedLeads : displayLeads;
    const filename = getExportFilename();
    if (format === "csv") exportCSV(leadsToExport, filename);
    else if (format === "xlsx") exportXLSX(leadsToExport, filename);
    else exportPDF(leadsToExport, filename);
  };

  // Status filter counts
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    B2B_LEAD_STATUSES.forEach((s) => { counts[s.value] = 0; });
    displayLeads.forEach((l) => {
      const status = l.status || "new";
      counts[status] = (counts[status] || 0) + 1;
    });
    return counts;
  }, [displayLeads]);

  const handleRepeatSearch = (params: { niches: string[]; state?: string; city?: string }) => {
    setViewingListId(null);
    setActiveTab("search");
    search({ ...params, limit: 20 });
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Prospecção B2B</h1>
              <p className="text-sm text-muted-foreground">Encontre empresas reais para prospectar</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {displayLeads.length > 0 && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowSaveDialog(true)}
                >
                  <Save className="h-4 w-4 mr-2" />
                  Salvar Lista
                  {selectedIds.size > 0 && (
                    <Badge variant="secondary" className="ml-2">{selectedIds.size}</Badge>
                  )}
                </Button>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Download className="h-4 w-4 mr-2" />
                      Exportar
                      {selectedIds.size > 0 && (
                        <Badge variant="secondary" className="ml-2">{selectedIds.size}</Badge>
                      )}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onClick={() => handleExport("csv")}>
                      <File className="h-4 w-4 mr-2" />
                      CSV
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleExport("xlsx")}>
                      <FileSpreadsheet className="h-4 w-4 mr-2" />
                      Excel (.xlsx)
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleExport("pdf")}>
                      <FileText className="h-4 w-4 mr-2" />
                      PDF
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            )}
          </div>
        </div>

        {/* Metrics */}
        <MetricCards
          totalProspected={totalProspected}
          exportedThisMonth={0}
          savedLists={lists.length}
          searchesToday={searchesToday}
        />

        {/* Status counters */}
        {displayLeads.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {B2B_LEAD_STATUSES.map((s) => (
              <Badge key={s.value} className={`${s.color} text-xs`}>
                {s.label}: {statusCounts[s.value] || 0}
              </Badge>
            ))}
          </div>
        )}

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="search">Buscar</TabsTrigger>
            <TabsTrigger value="lists">
              Listas Salvas
              {lists.length > 0 && (
                <Badge variant="secondary" className="ml-1.5 text-[10px]">{lists.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="history">Histórico</TabsTrigger>
          </TabsList>

          <TabsContent value="search" className="space-y-4">
            {viewingListId ? (
              <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
                <span className="text-sm text-muted-foreground">Visualizando lista salva</span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setViewingListId(null);
                    setListLeads([]);
                  }}
                >
                  Voltar à busca
                </Button>
              </div>
            ) : (
              <SearchFilters onSearch={(params) => { search(params); fetchMetrics(); }} loading={loading} />
            )}

            <LeadsTable
              leads={displayLeads}
              loading={loading}
              selectedIds={selectedIds}
              onSelectionChange={setSelectedIds}
              onAddNote={(lead) => setNoteDialogLead(lead)}
              existingPhones={existingPhones}
            />
          </TabsContent>

          <TabsContent value="lists">
            <SavedLists
              lists={lists}
              loading={listsLoading}
              onViewList={handleViewList}
              onDeleteList={deleteList}
            />
          </TabsContent>

          <TabsContent value="history">
            <SearchHistory onRepeatSearch={handleRepeatSearch} />
          </TabsContent>
        </Tabs>
      </div>

      {/* Dialogs */}
      <SaveListDialog
        open={showSaveDialog}
        onOpenChange={setShowSaveDialog}
        leads={selectedIds.size > 0 ? selectedLeads : displayLeads}
        onSave={async (name, leads, desc) => {
          await createList(name, leads, desc);
          fetchExistingPhones();
          fetchMetrics();
        }}
      />

      <LeadNoteDialog
        open={!!noteDialogLead}
        onOpenChange={(open) => !open && setNoteDialogLead(null)}
        lead={noteDialogLead}
      />
    </div>
  );
};

export default B2BProspectionPage;
