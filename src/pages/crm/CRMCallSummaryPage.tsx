import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCRMContext } from "./CRMLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Loader2, Phone, FileText, ChevronLeft, ChevronRight, Calendar, Users, BarChart3, BookOpen, RefreshCcw, Search } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { LeadSummaryTab } from "@/components/crm/lead-detail/lead-summary/LeadSummaryTab";

interface TranscriptionRow {
  id: string;
  title: string;
  transcription_text: string | null;
  ai_analysis: string | null;
  summary: string | null;
  source: string;
  source_meeting_url: string | null;
  duration_seconds: number | null;
  created_at: string;
  recorded_at: string | null;
  created_by: string | null;
  speakers: { name?: string; id?: string }[];
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
  const [copied, setCopied] = useState(false);
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
          source_meeting_url, duration_seconds, created_at, recorded_at,
          created_by, speakers,
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
        speakers: Array.isArray(r.speakers) ? r.speakers : [],
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

      {/* Detail Dialog — same format as TranscriptionsList inside the Lead */}
      <Dialog open={!!selectedTranscription} onOpenChange={() => setSelectedTranscription(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {selectedTranscription?.title}
            </DialogTitle>
            <DialogDescription className="flex items-center gap-3 flex-wrap">
              {selectedTranscription?.recorded_at && (
                <span>
                  {format(new Date(selectedTranscription.recorded_at), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
                </span>
              )}
              {!selectedTranscription?.recorded_at && selectedTranscription?.created_at && (
                <span>
                  {format(new Date(selectedTranscription.created_at), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
                </span>
              )}
              {selectedTranscription?.duration_seconds && (
                <span>• Duração: {formatDuration(selectedTranscription.duration_seconds)}</span>
              )}
              {selectedTranscription?.staff_name && (
                <span>• Closer: {selectedTranscription.staff_name}</span>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Lead link */}
            {selectedTranscription?.lead && (
              <div className="flex items-center gap-2">
                <Link
                  to={`/crm/leads/${selectedTranscription.lead.id}`}
                  onClick={() => setSelectedTranscription(null)}
                >
                  <Badge variant="outline" className="cursor-pointer hover:bg-muted">
                    {selectedTranscription.lead.name}
                    {selectedTranscription.lead.company && ` • ${selectedTranscription.lead.company}`}
                  </Badge>
                </Link>
                {selectedTranscription.source_meeting_url && (
                  <a
                    href={selectedTranscription.source_meeting_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    <ExternalLink className="h-3 w-3" />
                    Ver reunião
                  </a>
                )}
              </div>
            )}

            {/* Summary */}
            {selectedTranscription?.summary && (
              <div>
                <h4 className="font-medium mb-1">Resumo</h4>
                <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-md">
                  {selectedTranscription.summary}
                </p>
              </div>
            )}

            {/* Speakers */}
            {selectedTranscription?.speakers && selectedTranscription.speakers.length > 0 && (
              <div>
                <h4 className="font-medium mb-1">Participantes</h4>
                <div className="flex flex-wrap gap-1">
                  {selectedTranscription.speakers.map((speaker, idx) => (
                    <Badge key={idx} variant="secondary">
                      {speaker.name || `Participante ${idx + 1}`}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Transcription text */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <h4 className="font-medium">Transcrição</h4>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={async () => {
                    if (selectedTranscription?.transcription_text) {
                      await navigator.clipboard.writeText(selectedTranscription.transcription_text);
                      setCopied(true);
                      toast.success("Transcrição copiada!");
                      setTimeout(() => setCopied(false), 2000);
                    }
                  }}
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <ScrollArea className="h-[300px] border rounded-md p-4">
                <div className="text-sm whitespace-pre-wrap font-mono">
                  {selectedTranscription?.transcription_text || "Transcrição não disponível"}
                </div>
              </ScrollArea>
            </div>

            {/* AI Analysis */}
            {selectedTranscription?.ai_analysis && (
              <div>
                <h4 className="font-medium mb-1 flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4 text-primary" />
                  Análise IA / Briefing
                </h4>
                <div className="prose prose-sm dark:prose-invert max-w-none bg-primary/5 border-primary/20 border p-4 rounded-md [&>h2]:mt-5 [&>h2]:mb-2 [&>ul]:mb-3 [&>p]:mb-2.5 [&>blockquote]:mb-3 [&>ul>li]:mb-1">
                  <ReactMarkdown>{selectedTranscription.ai_analysis}</ReactMarkdown>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CRMCallSummaryPage;
