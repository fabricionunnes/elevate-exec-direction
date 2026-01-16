import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { 
  Search, 
  Plus, 
  UserPlus,
  Tag,
  X,
  Star,
  Calendar,
  FileText,
  RefreshCw,
  Filter,
  Sparkles
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

interface TalentCandidate {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  linkedin_url: string | null;
  talent_pool_notes: string | null;
  talent_pool_added_at: string | null;
  expected_salary_range: string | null;
  ai_summary: string | null;
  ai_match_score: number | null;
  created_at: string;
  job_opening?: {
    title: string;
  } | null;
  candidate_disc_results?: Array<{
    dominant_profile: string | null;
    status: string;
  }>;
}

interface TalentTag {
  id: string;
  name: string;
  color: string;
  category: string;
}

interface CandidateTag {
  id: string;
  tag_id: string;
  tag: TalentTag;
}

interface JobOpening {
  id: string;
  title: string;
  status: string;
}

interface TalentPoolTabProps {
  projectId: string;
  canEdit: boolean;
  onUpdate?: () => void;
}

export function TalentPoolTab({ projectId, canEdit, onUpdate }: TalentPoolTabProps) {
  const [candidates, setCandidates] = useState<TalentCandidate[]>([]);
  const [tags, setTags] = useState<TalentTag[]>([]);
  const [candidateTags, setCandidateTags] = useState<Record<string, CandidateTag[]>>({});
  const [jobs, setJobs] = useState<JobOpening[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterTag, setFilterTag] = useState<string>("all");
  const [filterDisc, setFilterDisc] = useState<string>("all");
  
  // Dialogs
  const [showTagDialog, setShowTagDialog] = useState(false);
  const [showAddTagDialog, setShowAddTagDialog] = useState(false);
  const [showReactivateDialog, setShowReactivateDialog] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState<TalentCandidate | null>(null);
  const [selectedJob, setSelectedJob] = useState<string>("");
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState("#6366f1");
  const [newTagCategory, setNewTagCategory] = useState("skill");

  useEffect(() => {
    fetchData();
  }, [projectId]);

  const fetchData = async () => {
    setLoading(true);

    // Fetch candidates in talent pool
    const { data: candidatesData } = await supabase
      .from("candidates")
      .select(`
        id, full_name, email, phone, linkedin_url,
        talent_pool_notes, talent_pool_added_at, expected_salary_range,
        ai_summary, ai_match_score, created_at,
        job_opening:job_openings(title),
        candidate_disc_results(dominant_profile, status)
      `)
      .eq("project_id", projectId)
      .eq("current_stage", "talent_pool")
      .order("talent_pool_added_at", { ascending: false, nullsFirst: false });

    setCandidates(candidatesData || []);

    // Fetch tags
    const { data: tagsData } = await supabase
      .from("talent_pool_tags")
      .select("*")
      .eq("project_id", projectId)
      .order("name");

    setTags(tagsData || []);

    // Fetch candidate tags
    if (candidatesData && candidatesData.length > 0) {
      const candidateIds = candidatesData.map(c => c.id);
      const { data: candTagsData } = await supabase
        .from("candidate_tags")
        .select("id, candidate_id, tag_id, tag:talent_pool_tags(*)")
        .in("candidate_id", candidateIds);

      const tagsByCandidate: Record<string, CandidateTag[]> = {};
      (candTagsData || []).forEach(ct => {
        if (!tagsByCandidate[ct.candidate_id]) {
          tagsByCandidate[ct.candidate_id] = [];
        }
        tagsByCandidate[ct.candidate_id].push(ct as any);
      });
      setCandidateTags(tagsByCandidate);
    }

    // Fetch open jobs for reactivation
    const { data: jobsData } = await supabase
      .from("job_openings")
      .select("id, title, status")
      .eq("project_id", projectId)
      .eq("status", "open");

    setJobs(jobsData || []);

    setLoading(false);
  };

  const filteredCandidates = candidates.filter(c => {
    const matchesSearch = 
      c.full_name.toLowerCase().includes(search.toLowerCase()) ||
      c.email.toLowerCase().includes(search.toLowerCase());
    
    const matchesTag = filterTag === "all" || 
      (candidateTags[c.id]?.some(ct => ct.tag_id === filterTag));
    
    const matchesDisc = filterDisc === "all" ||
      (c.candidate_disc_results?.some(d => 
        d.status === 'completed' && d.dominant_profile === filterDisc
      ));

    return matchesSearch && matchesTag && matchesDisc;
  });

  const getInitials = (name: string) =>
    name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();

  const getDISCProfile = (candidate: TalentCandidate) => {
    const completed = candidate.candidate_disc_results?.find(d => d.status === 'completed');
    return completed?.dominant_profile || null;
  };

  const getDISCColor = (profile: string | null) => {
    switch (profile) {
      case 'D': return 'bg-red-500';
      case 'I': return 'bg-yellow-500';
      case 'S': return 'bg-green-500';
      case 'C': return 'bg-blue-500';
      default: return 'bg-gray-400';
    }
  };

  const handleCreateTag = async () => {
    if (!newTagName.trim()) return;

    const { error } = await supabase
      .from("talent_pool_tags")
      .insert({
        project_id: projectId,
        name: newTagName.trim(),
        color: newTagColor,
        category: newTagCategory
      });

    if (error) {
      toast.error("Erro ao criar tag");
    } else {
      toast.success("Tag criada!");
      setNewTagName("");
      setShowAddTagDialog(false);
      fetchData();
    }
  };

  const handleAddTagToCandidate = async (candidateId: string, tagId: string) => {
    const { error } = await supabase
      .from("candidate_tags")
      .insert({
        candidate_id: candidateId,
        tag_id: tagId
      });

    if (error) {
      if (error.code === '23505') {
        toast.error("Tag já adicionada");
      } else {
        toast.error("Erro ao adicionar tag");
      }
    } else {
      toast.success("Tag adicionada!");
      fetchData();
    }
  };

  const handleRemoveTagFromCandidate = async (candidateTagId: string) => {
    const { error } = await supabase
      .from("candidate_tags")
      .delete()
      .eq("id", candidateTagId);

    if (error) {
      toast.error("Erro ao remover tag");
    } else {
      toast.success("Tag removida!");
      fetchData();
    }
  };

  const handleReactivateCandidate = async () => {
    if (!selectedCandidate || !selectedJob) return;

    const { error } = await supabase
      .from("candidates")
      .update({
        current_stage: "screening",
        job_opening_id: selectedJob,
        status: "active"
      })
      .eq("id", selectedCandidate.id);

    if (error) {
      toast.error("Erro ao reativar candidato");
    } else {
      toast.success("Candidato reativado para nova vaga!");
      setShowReactivateDialog(false);
      setSelectedCandidate(null);
      setSelectedJob("");
      fetchData();
      onUpdate?.();
    }
  };

  const TAG_COLORS = [
    "#6366f1", "#8b5cf6", "#ec4899", "#f43f5e", 
    "#f97316", "#eab308", "#22c55e", "#14b8a6"
  ];

  return (
    <div className="space-y-4">
      {/* Header Actions */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div className="flex flex-col sm:flex-row gap-2 flex-1">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar no banco de talentos..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <Select value={filterTag} onValueChange={setFilterTag}>
            <SelectTrigger className="w-40">
              <Tag className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Tag" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas Tags</SelectItem>
              {tags.map(tag => (
                <SelectItem key={tag.id} value={tag.id}>
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-2 h-2 rounded-full" 
                      style={{ backgroundColor: tag.color }}
                    />
                    {tag.name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterDisc} onValueChange={setFilterDisc}>
            <SelectTrigger className="w-40">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="DISC" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos DISC</SelectItem>
              <SelectItem value="D">Dominância (D)</SelectItem>
              <SelectItem value="I">Influência (I)</SelectItem>
              <SelectItem value="S">Estabilidade (S)</SelectItem>
              <SelectItem value="C">Conformidade (C)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {canEdit && (
          <Button onClick={() => setShowAddTagDialog(true)} variant="outline">
            <Plus className="h-4 w-4 mr-2" />
            Nova Tag
          </Button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{candidates.length}</p>
            <p className="text-sm text-muted-foreground">Total no Banco</p>
          </CardContent>
        </Card>
        <Card className="bg-green-500/10 border-green-500/20">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">
              {candidates.filter(c => getDISCProfile(c)).length}
            </p>
            <p className="text-sm text-muted-foreground">Com DISC</p>
          </CardContent>
        </Card>
        <Card className="bg-purple-500/10 border-purple-500/20">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{tags.length}</p>
            <p className="text-sm text-muted-foreground">Tags Criadas</p>
          </CardContent>
        </Card>
        <Card className="bg-blue-500/10 border-blue-500/20">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">
              {candidates.filter(c => c.ai_summary).length}
            </p>
            <p className="text-sm text-muted-foreground">Com Resumo IA</p>
          </CardContent>
        </Card>
      </div>

      {/* Candidates List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-4">
                <div className="h-24 bg-muted rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredCandidates.length === 0 ? (
        <Card className="p-12 text-center">
          <Star className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">Banco de Talentos Vazio</h3>
          <p className="text-muted-foreground">
            Candidatos movidos para "Banco de Talentos" aparecerão aqui
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredCandidates.map(candidate => {
            const discProfile = getDISCProfile(candidate);
            const candTags = candidateTags[candidate.id] || [];

            return (
              <Card key={candidate.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <Avatar className="h-12 w-12">
                      <AvatarFallback className="bg-primary/10 text-primary">
                        {getInitials(candidate.full_name)}
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium">{candidate.full_name}</h4>
                        {discProfile && (
                          <Badge className={`${getDISCColor(discProfile)} text-white`}>
                            {discProfile}
                          </Badge>
                        )}
                        {candidate.ai_match_score && (
                          <Badge variant="outline" className="gap-1">
                            <Sparkles className="h-3 w-3" />
                            {candidate.ai_match_score}%
                          </Badge>
                        )}
                      </div>

                      <p className="text-sm text-muted-foreground">{candidate.email}</p>

                      {candidate.job_opening && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Última vaga: {candidate.job_opening.title}
                        </p>
                      )}

                      {/* Tags */}
                      <div className="flex flex-wrap gap-1 mt-2">
                        {candTags.map(ct => (
                          <Badge 
                            key={ct.id} 
                            variant="secondary"
                            className="gap-1 cursor-pointer hover:opacity-80"
                            style={{ 
                              backgroundColor: `${ct.tag.color}20`,
                              borderColor: ct.tag.color,
                              color: ct.tag.color
                            }}
                          >
                            {ct.tag.name}
                            {canEdit && (
                              <X 
                                className="h-3 w-3 cursor-pointer"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRemoveTagFromCandidate(ct.id);
                                }}
                              />
                            )}
                          </Badge>
                        ))}
                        {canEdit && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-xs"
                            onClick={() => {
                              setSelectedCandidate(candidate);
                              setShowTagDialog(true);
                            }}
                          >
                            <Plus className="h-3 w-3 mr-1" />
                            Tag
                          </Button>
                        )}
                      </div>

                      {/* AI Summary */}
                      {candidate.ai_summary && (
                        <div className="mt-2 p-2 bg-muted/50 rounded text-sm">
                          <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                            <Sparkles className="h-3 w-3" />
                            Resumo IA
                          </div>
                          {candidate.ai_summary}
                        </div>
                      )}

                      {/* Notes */}
                      {candidate.talent_pool_notes && (
                        <div className="mt-2 p-2 bg-yellow-50 dark:bg-yellow-950/20 rounded text-sm">
                          <FileText className="h-3 w-3 inline mr-1 text-yellow-600" />
                          {candidate.talent_pool_notes}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col items-end gap-2">
                      {candidate.talent_pool_added_at && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(candidate.talent_pool_added_at), "dd/MM/yyyy", { locale: ptBR })}
                        </span>
                      )}

                      {candidate.expected_salary_range && (
                        <Badge variant="outline">{candidate.expected_salary_range}</Badge>
                      )}

                      {canEdit && jobs.length > 0 && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1"
                          onClick={() => {
                            setSelectedCandidate(candidate);
                            setShowReactivateDialog(true);
                          }}
                        >
                          <RefreshCw className="h-3 w-3" />
                          Reativar
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add Tag to Candidate Dialog */}
      <Dialog open={showTagDialog} onOpenChange={setShowTagDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Tag</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Selecione uma tag para {selectedCandidate?.full_name}
            </p>
            <div className="flex flex-wrap gap-2">
              {tags.map(tag => {
                const alreadyHas = candidateTags[selectedCandidate?.id || '']?.some(
                  ct => ct.tag_id === tag.id
                );
                return (
                  <Badge
                    key={tag.id}
                    variant={alreadyHas ? "default" : "outline"}
                    className={`cursor-pointer ${alreadyHas ? 'opacity-50' : 'hover:opacity-80'}`}
                    style={{ 
                      backgroundColor: alreadyHas ? tag.color : `${tag.color}20`,
                      borderColor: tag.color,
                      color: alreadyHas ? 'white' : tag.color
                    }}
                    onClick={() => {
                      if (!alreadyHas && selectedCandidate) {
                        handleAddTagToCandidate(selectedCandidate.id, tag.id);
                      }
                    }}
                  >
                    {tag.name}
                  </Badge>
                );
              })}
            </div>
            {tags.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhuma tag criada ainda. Crie uma primeiro.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTagDialog(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Tag Dialog */}
      <Dialog open={showAddTagDialog} onOpenChange={setShowAddTagDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Criar Nova Tag</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Nome da Tag</label>
              <Input
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                placeholder="Ex: React, Liderança, Vendas..."
              />
            </div>
            <div>
              <label className="text-sm font-medium">Categoria</label>
              <Select value={newTagCategory} onValueChange={setNewTagCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="skill">Habilidade</SelectItem>
                  <SelectItem value="disc">DISC</SelectItem>
                  <SelectItem value="custom">Personalizada</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Cor</label>
              <div className="flex gap-2 mt-2">
                {TAG_COLORS.map(color => (
                  <button
                    key={color}
                    className={`w-8 h-8 rounded-full border-2 transition-transform ${
                      newTagColor === color ? 'border-foreground scale-110' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: color }}
                    onClick={() => setNewTagColor(color)}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddTagDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreateTag}>Criar Tag</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reactivate Candidate Dialog */}
      <Dialog open={showReactivateDialog} onOpenChange={setShowReactivateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reativar Candidato</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Selecione a vaga para reativar {selectedCandidate?.full_name}
            </p>
            <Select value={selectedJob} onValueChange={setSelectedJob}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma vaga" />
              </SelectTrigger>
              <SelectContent>
                {jobs.map(job => (
                  <SelectItem key={job.id} value={job.id}>
                    {job.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReactivateDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleReactivateCandidate} disabled={!selectedJob}>
              <UserPlus className="h-4 w-4 mr-2" />
              Reativar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
