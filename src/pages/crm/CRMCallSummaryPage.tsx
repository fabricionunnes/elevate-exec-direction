import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCRMContext } from "./CRMLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Phone, FileText, ChevronLeft, ChevronRight, Calendar, Users, BarChart3, BookOpen, RefreshCcw, Search, ExternalLink, Eye, Clock, User, Copy, Check, Sparkles, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import { Link, useNavigate } from "react-router-dom";

interface TranscriptionRow {
  id: string;
  title: string;
  transcription_text: string | null;
  ai_analysis: string | null;
  summary: string | null;
  source: string;
  duration_seconds: number | null;
  created_at: string;
  recorded_at: string | null;
  created_by: string | null;
  lead?: { id: string; name: string; company: string | null } | null;
  staff_name?: string;
}

interface CloserOption {
  user_id: string;
  name: string;
}

const PAGE_SIZE = 10;

const CRMCallSummaryPage = () => {
  const { staffRole, isAdmin } = useCRMContext();
  const navigate = useNavigate();
  const [transcriptions, setTranscriptions] = useState<TranscriptionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);
  const [selectedTranscription, setSelectedTranscription] = useState<TranscriptionRow | null>(null);
  const [activeTab, setActiveTab] = useState("all");
  const [closers, setClosers] = useState<CloserOption[]>([]);
  const [selectedCloser, setSelectedCloser] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const [searchTerm, setSearchTerm] = useState("");

  // Access control
  const hasAccess = staffRole === "master" || staffRole === "admin" || staffRole === "head_comercial";

  // Fetch closers
  useEffect(() => {
    const fetchClosers = async () => {
      const { data } = await supabase
        .from("onboarding_staff")
        .select("user_id, name")
        .in("role", ["closer", "sdr", "head_comercial"])
        .eq("is_active", true)
        .not("user_id", "is", null)
        .order("name");
      setClosers((data || []).filter(d => d.user_id) as CloserOption[]);
    };
    if (hasAccess) fetchClosers();
  }, [hasAccess]);

  const fetchData = useCallback(async () => {
    if (!hasAccess) return;
    setLoading(true);

    try {
      // Build count query
      let countQuery = supabase
        .from("crm_transcriptions")
        .select("id", { count: "exact", head: true });

      let dataQuery = supabase
        .from("crm_transcriptions")
        .select(`
          id, title, transcription_text, ai_analysis, summary, source,
          duration_seconds, created_at, recorded_at, created_by,
          lead:crm_leads(id, name, company)
        `)
        .order("created_at", { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      // Filters
      if (selectedCloser !== "all") {
        countQuery = countQuery.eq("created_by", selectedCloser);
        dataQuery = dataQuery.eq("created_by", selectedCloser);
      }

      if (dateFrom) {
        const fromStr = format(dateFrom, "yyyy-MM-dd");
        countQuery = countQuery.gte("created_at", fromStr);
        dataQuery = dataQuery.gte("created_at", fromStr);
      }

      if (dateTo) {
        const toStr = format(dateTo, "yyyy-MM-dd") + "T23:59:59";
        countQuery = countQuery.lte("created_at", toStr);
        dataQuery = dataQuery.lte("created_at", toStr);
      }

      if (searchTerm.trim()) {
        const term = `%${searchTerm.trim()}%`;
        countQuery = countQuery.ilike("title", term);
        dataQuery = dataQuery.ilike("title", term);
      }

      // Filter by tab (source-based categorization)
      if (activeTab === "guide") {
        countQuery = countQuery.eq("source", "guide");
        dataQuery = dataQuery.eq("source", "guide");
      } else if (activeTab === "followup") {
        countQuery = countQuery.eq("source", "follow_up");
        dataQuery = dataQuery.eq("source", "follow_up");
      } else if (activeTab === "analysis") {
        countQuery = countQuery.not("ai_analysis", "is", null);
        dataQuery = dataQuery.not("ai_analysis", "is", null);
      }

      const [countResult, dataResult] = await Promise.all([countQuery, dataQuery]);
      setTotalCount(countResult.count || 0);

      // Fetch staff names for created_by
      const rows = dataResult.data || [];
      const userIds = [...new Set(rows.map(r => r.created_by).filter(Boolean))] as string[];

      let staffMap: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: staffData } = await supabase
          .from("onboarding_staff")
          .select("user_id, name")
          .in("user_id", userIds);
        staffMap = Object.fromEntries((staffData || []).map(s => [s.user_id, s.name]));
      }

      setTranscriptions(rows.map(r => ({
        ...r,
        staff_name: r.created_by ? staffMap[r.created_by] || "Desconhecido" : "Sem autor",
      })) as TranscriptionRow[]);
    } catch (err) {
      console.error("Error fetching call summary:", err);
    } finally {
      setLoading(false);
    }
  }, [hasAccess, page, activeTab, selectedCloser, dateFrom, dateTo, searchTerm]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Reset page on filter change
  useEffect(() => {
    setPage(0);
  }, [activeTab, selectedCloser, dateFrom, dateTo, searchTerm]);

  if (!hasAccess) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        Você não tem permissão para acessar esta página.
      </div>
    );
  }

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return "-";
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}min ${s}s`;
  };

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Phone className="h-5 w-5 text-primary" />
            Resumo de Calls
          </h1>
          <p className="text-sm text-muted-foreground">Visão consolidada de todas as ligações e transcrições</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData} className="gap-1.5">
          <RefreshCcw className="h-3.5 w-3.5" />
          Atualizar
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4 pb-3">
          <div className="flex flex-wrap items-end gap-3">
            {/* Closer filter */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <Users className="h-3 w-3" /> Closer
              </label>
              <Select value={selectedCloser} onValueChange={setSelectedCloser}>
                <SelectTrigger className="w-[180px] h-9 text-sm">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {closers.map(c => (
                    <SelectItem key={c.user_id} value={c.user_id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date from */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3 w-3" /> Data início
              </label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className={cn("w-[140px] justify-start text-left font-normal h-9", !dateFrom && "text-muted-foreground")}>
                    {dateFrom ? format(dateFrom, "dd/MM/yyyy") : "Selecionar"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent mode="single" selected={dateFrom} onSelect={setDateFrom} className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>

            {/* Date to */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3 w-3" /> Data fim
              </label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className={cn("w-[140px] justify-start text-left font-normal h-9", !dateTo && "text-muted-foreground")}>
                    {dateTo ? format(dateTo, "dd/MM/yyyy") : "Selecionar"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent mode="single" selected={dateTo} onSelect={setDateTo} className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>

            {/* Search */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <Search className="h-3 w-3" /> Buscar
              </label>
              <Input
                placeholder="Título..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-[180px] h-9 text-sm"
              />
            </div>

            {/* Clear filters */}
            {(selectedCloser !== "all" || dateFrom || dateTo || searchTerm) && (
              <Button
                variant="ghost"
                size="sm"
                className="h-9 text-xs"
                onClick={() => {
                  setSelectedCloser("all");
                  setDateFrom(undefined);
                  setDateTo(undefined);
                  setSearchTerm("");
                }}
              >
                Limpar filtros
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Stats summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-2xl font-bold text-primary">{totalCount}</p>
            <p className="text-xs text-muted-foreground">Total de calls</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-2xl font-bold text-primary">
              {transcriptions.filter(t => t.ai_analysis).length}
            </p>
            <p className="text-xs text-muted-foreground">Com análise IA</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-2xl font-bold text-primary">
              {transcriptions.filter(t => t.duration_seconds && t.duration_seconds > 0).length}
            </p>
            <p className="text-xs text-muted-foreground">Com duração</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-2xl font-bold text-primary">
              {closers.length}
            </p>
            <p className="text-xs text-muted-foreground">Closers ativos</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="h-auto flex-wrap gap-1">
          <TabsTrigger value="all" className="gap-1.5 text-xs">
            <BarChart3 className="h-3.5 w-3.5" />
            Visão Geral
          </TabsTrigger>
          <TabsTrigger value="guide" className="gap-1.5 text-xs">
            <BookOpen className="h-3.5 w-3.5" />
            Guia
          </TabsTrigger>
          <TabsTrigger value="followup" className="gap-1.5 text-xs">
            <RefreshCcw className="h-3.5 w-3.5" />
            Follow Up
          </TabsTrigger>
          <TabsTrigger value="analysis" className="gap-1.5 text-xs">
            <FileText className="h-3.5 w-3.5" />
            Análise das Calls
          </TabsTrigger>
        </TabsList>

        {/* All tabs share the same content but with different data */}
        {["all", "guide", "followup", "analysis"].map(tab => (
          <TabsContent key={tab} value={tab} className="space-y-3 mt-3">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : transcriptions.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  Nenhuma call encontrada com os filtros selecionados.
                </CardContent>
              </Card>
            ) : (
              <>
                {transcriptions.map((t) => (
                  <Card
                    key={t.id}
                    className="hover:border-primary/30 transition-colors cursor-pointer"
                    onClick={() => setSelectedTranscription(t)}
                  >
                    <CardContent className="pt-4 pb-3 space-y-2">
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold text-sm truncate">{t.title}</h3>
                            <Badge variant="secondary" className="text-[10px]">{t.source}</Badge>
                            {t.ai_analysis && (
                              <Badge variant="outline" className="text-[10px] text-primary border-primary/30">IA</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Users className="h-3 w-3" />
                              {t.staff_name}
                            </span>
                            <span>{format(new Date(t.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
                            {t.duration_seconds && (
                              <span>{formatDuration(t.duration_seconds)}</span>
                            )}
                            {t.lead && (
                              <span className="text-primary font-medium">{t.lead.name}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Preview text */}
                      {t.summary ? (
                        <p className="text-xs text-muted-foreground line-clamp-2">{t.summary}</p>
                      ) : t.transcription_text ? (
                        <p className="text-xs text-muted-foreground line-clamp-2">{t.transcription_text.slice(0, 200)}...</p>
                      ) : null}
                    </CardContent>
                  </Card>
                ))}

                {/* Pagination */}
                <div className="flex items-center justify-between pt-2">
                  <p className="text-xs text-muted-foreground">
                    Mostrando {page * PAGE_SIZE + 1}-{Math.min((page + 1) * PAGE_SIZE, totalCount)} de {totalCount}
                  </p>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      disabled={page === 0}
                      onClick={() => setPage(p => p - 1)}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-xs px-2">
                      {page + 1} / {totalPages || 1}
                    </span>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      disabled={page >= totalPages - 1}
                      onClick={() => setPage(p => p + 1)}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </>
            )}
          </TabsContent>
        ))}
      </Tabs>

      {/* Detail Dialog */}
      <Dialog open={!!selectedTranscription} onOpenChange={(open) => !open && setSelectedTranscription(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] p-0 gap-0">
          {selectedTranscription && (
            <>
              <DialogHeader className="p-5 pb-3 border-b">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <DialogTitle className="text-base font-semibold truncate">
                      {selectedTranscription.title}
                    </DialogTitle>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {selectedTranscription.staff_name}
                      </span>
                      <span>{format(new Date(selectedTranscription.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
                      {selectedTranscription.duration_seconds && (
                        <span>{formatDuration(selectedTranscription.duration_seconds)}</span>
                      )}
                      <Badge variant="secondary" className="text-[10px]">{selectedTranscription.source}</Badge>
                      {selectedTranscription.ai_analysis && (
                        <Badge variant="outline" className="text-[10px] text-primary border-primary/30">IA</Badge>
                      )}
                    </div>
                    {selectedTranscription.lead && (
                      <Button
                        variant="link"
                        size="sm"
                        className="h-auto p-0 mt-1 text-xs text-primary gap-1"
                        onClick={() => {
                          setSelectedTranscription(null);
                          navigate(`/crm/leads/${selectedTranscription.lead!.id}`);
                        }}
                      >
                        <ExternalLink className="h-3 w-3" />
                        Ver lead: {selectedTranscription.lead.name}
                        {selectedTranscription.lead.company && ` (${selectedTranscription.lead.company})`}
                      </Button>
                    )}
                  </div>
                </div>
              </DialogHeader>

              <ScrollArea className="max-h-[calc(85vh-120px)]">
                <div className="p-5">
                  <Tabs defaultValue="overview" className="space-y-3">
                    <TabsList className="h-auto flex-wrap gap-1">
                      <TabsTrigger value="overview" className="gap-1.5 text-xs">
                        <BarChart3 className="h-3.5 w-3.5" />
                        Visão Geral
                      </TabsTrigger>
                      <TabsTrigger value="guide" className="gap-1.5 text-xs">
                        <BookOpen className="h-3.5 w-3.5" />
                        Guia
                      </TabsTrigger>
                      <TabsTrigger value="followup" className="gap-1.5 text-xs">
                        <RefreshCcw className="h-3.5 w-3.5" />
                        Follow Up
                      </TabsTrigger>
                      <TabsTrigger value="analysis" className="gap-1.5 text-xs">
                        <FileText className="h-3.5 w-3.5" />
                        Análise
                      </TabsTrigger>
                    </TabsList>

                    {/* Visão Geral */}
                    <TabsContent value="overview" className="space-y-4 mt-2">
                      <div className="grid grid-cols-3 gap-3">
                        <Card>
                          <CardContent className="pt-3 pb-2 text-center">
                            <p className="text-lg font-bold text-primary">{selectedTranscription.source}</p>
                            <p className="text-[10px] text-muted-foreground">Origem</p>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardContent className="pt-3 pb-2 text-center">
                            <p className="text-lg font-bold text-primary">{formatDuration(selectedTranscription.duration_seconds)}</p>
                            <p className="text-[10px] text-muted-foreground">Duração</p>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardContent className="pt-3 pb-2 text-center">
                            <p className="text-lg font-bold text-primary">{selectedTranscription.ai_analysis ? "Sim" : "Não"}</p>
                            <p className="text-[10px] text-muted-foreground">Análise IA</p>
                          </CardContent>
                        </Card>
                      </div>
                      {selectedTranscription.summary && (
                        <div>
                          <h4 className="text-xs font-semibold mb-1.5 text-muted-foreground uppercase">Resumo</h4>
                          <p className="text-sm">{selectedTranscription.summary}</p>
                        </div>
                      )}
                      {selectedTranscription.transcription_text && (
                        <div>
                          <h4 className="text-xs font-semibold mb-1.5 text-muted-foreground uppercase">Transcrição Completa</h4>
                          <div className="bg-muted/30 rounded-lg p-4 border text-sm whitespace-pre-wrap max-h-[300px] overflow-y-auto">
                            {selectedTranscription.transcription_text}
                          </div>
                        </div>
                      )}
                    </TabsContent>

                    {/* Guia */}
                    <TabsContent value="guide" className="space-y-3 mt-2">
                      {selectedTranscription.ai_analysis ? (
                        <div>
                          <h4 className="text-xs font-semibold mb-2 text-muted-foreground uppercase">Guia da Call</h4>
                          <div className="prose prose-sm dark:prose-invert max-w-none bg-muted/30 rounded-lg p-4 border [&>h2]:mt-5 [&>h2]:mb-2 [&>ul]:mb-3 [&>p]:mb-2.5 [&>blockquote]:mb-3 [&>ul>li]:mb-1">
                            <ReactMarkdown>{selectedTranscription.ai_analysis}</ReactMarkdown>
                          </div>
                        </div>
                      ) : (
                        <Card>
                          <CardContent className="py-8 text-center text-muted-foreground text-sm">
                            Nenhum guia disponível para esta call.
                          </CardContent>
                        </Card>
                      )}
                    </TabsContent>

                    {/* Follow Up */}
                    <TabsContent value="followup" className="space-y-3 mt-2">
                      {selectedTranscription.ai_analysis ? (
                        <div>
                          <h4 className="text-xs font-semibold mb-2 text-muted-foreground uppercase">Pontos de Follow Up</h4>
                          <div className="prose prose-sm dark:prose-invert max-w-none bg-muted/30 rounded-lg p-4 border [&>h2]:mt-5 [&>h2]:mb-2 [&>ul]:mb-3 [&>p]:mb-2.5 [&>blockquote]:mb-3 [&>ul>li]:mb-1">
                            <ReactMarkdown>{selectedTranscription.ai_analysis}</ReactMarkdown>
                          </div>
                        </div>
                      ) : selectedTranscription.transcription_text ? (
                        <div>
                          <h4 className="text-xs font-semibold mb-2 text-muted-foreground uppercase">Conteúdo da Call</h4>
                          <div className="bg-muted/30 rounded-lg p-4 border text-sm whitespace-pre-wrap">
                            {selectedTranscription.transcription_text}
                          </div>
                        </div>
                      ) : (
                        <Card>
                          <CardContent className="py-8 text-center text-muted-foreground text-sm">
                            Nenhum follow up disponível.
                          </CardContent>
                        </Card>
                      )}
                    </TabsContent>

                    {/* Análise */}
                    <TabsContent value="analysis" className="space-y-3 mt-2">
                      {selectedTranscription.ai_analysis ? (
                        <div>
                          <h4 className="text-xs font-semibold mb-2 text-muted-foreground uppercase">Análise Completa da Call</h4>
                          <div className="prose prose-sm dark:prose-invert max-w-none bg-muted/30 rounded-lg p-4 border [&>h2]:mt-5 [&>h2]:mb-2 [&>ul]:mb-3 [&>p]:mb-2.5 [&>blockquote]:mb-3 [&>ul>li]:mb-1">
                            <ReactMarkdown>{selectedTranscription.ai_analysis}</ReactMarkdown>
                          </div>
                        </div>
                      ) : (
                        <Card>
                          <CardContent className="py-8 text-center text-muted-foreground text-sm">
                            Nenhuma análise IA disponível para esta call.
                          </CardContent>
                        </Card>
                      )}
                    </TabsContent>
                  </Tabs>
                </div>
              </ScrollArea>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CRMCallSummaryPage;
