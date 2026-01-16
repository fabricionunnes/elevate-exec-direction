import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Search, Send, Copy, ExternalLink, User } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { getPublicBaseUrl } from "@/lib/publicDomain";

interface DISCWithCandidate {
  id: string;
  candidate_id: string;
  access_token: string;
  status: string;
  dominant_profile: string | null;
  d_score: number | null;
  i_score: number | null;
  s_score: number | null;
  c_score: number | null;
  interpretation: string | null;
  completed_at: string | null;
  sent_at: string | null;
  created_at: string;
  candidate: {
    id: string;
    full_name: string;
    email: string;
  };
}

interface DISCEvaluationsTabProps {
  projectId: string;
  canEdit: boolean;
}

export function DISCEvaluationsTab({ projectId, canEdit }: DISCEvaluationsTabProps) {
  const [discResults, setDiscResults] = useState<DISCWithCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetchDiscResults();
  }, [projectId]);

  const fetchDiscResults = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("candidate_disc_results")
      .select(`
        *,
        candidate:candidates!inner(id, full_name, email, project_id)
      `)
      .eq("candidate.project_id", projectId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching DISC results:", error);
    } else {
      setDiscResults(data || []);
    }
    setLoading(false);
  };

  const copyLink = (token: string) => {
    const url = `${getPublicBaseUrl()}/?public=hr-disc&token=${encodeURIComponent(token)}`;
    navigator.clipboard.writeText(url);
    toast.success("Link copiado!");
  };

  const filteredResults = discResults.filter((d) =>
    d.candidate.full_name.toLowerCase().includes(search.toLowerCase()) ||
    d.candidate.email.toLowerCase().includes(search.toLowerCase())
  );

  const getInitials = (name: string) =>
    name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();

  const getProfileColor = (profile: string | null) => {
    switch (profile) {
      case 'D': return 'bg-red-500';
      case 'I': return 'bg-yellow-500';
      case 'S': return 'bg-green-500';
      case 'C': return 'bg-blue-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por candidato..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Results */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-4">
                <div className="h-16 bg-muted rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredResults.length === 0 ? (
        <Card className="p-12 text-center">
          <User className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">Nenhuma avaliação DISC</h3>
          <p className="text-muted-foreground">
            Envie testes DISC para candidatos na aba Pipeline
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredResults.map((disc) => (
            <Card key={disc.id}>
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <Avatar className="h-12 w-12">
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {getInitials(disc.candidate.full_name)}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium">{disc.candidate.full_name}</h4>
                    <p className="text-sm text-muted-foreground">{disc.candidate.email}</p>
                  </div>

                  {disc.status === 'completed' ? (
                    <div className="flex items-center gap-4">
                      {/* DISC Scores */}
                      <div className="flex items-center gap-2">
                        <div className="flex gap-1">
                          <div className="text-center">
                            <div className="text-sm font-bold text-red-500">{disc.d_score}%</div>
                            <div className="text-xs text-muted-foreground">D</div>
                          </div>
                          <div className="text-center">
                            <div className="text-sm font-bold text-yellow-500">{disc.i_score}%</div>
                            <div className="text-xs text-muted-foreground">I</div>
                          </div>
                          <div className="text-center">
                            <div className="text-sm font-bold text-green-500">{disc.s_score}%</div>
                            <div className="text-xs text-muted-foreground">S</div>
                          </div>
                          <div className="text-center">
                            <div className="text-sm font-bold text-blue-500">{disc.c_score}%</div>
                            <div className="text-xs text-muted-foreground">C</div>
                          </div>
                        </div>
                      </div>

                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${getProfileColor(disc.dominant_profile)}`}>
                        {disc.dominant_profile}
                      </div>

                      <Badge>Concluído</Badge>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">Pendente</Badge>
                      {canEdit && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => copyLink(disc.access_token)}
                          >
                            <Copy className="h-4 w-4 mr-2" />
                            Copiar Link
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() =>
                              window.open(
                                `${getPublicBaseUrl()}/?public=hr-disc&token=${encodeURIComponent(
                                  disc.access_token
                                )}`,
                                "_blank"
                              )
                            }
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  )}
                </div>

                {disc.status === 'completed' && disc.interpretation && (
                  <div className="mt-4 p-3 bg-muted/50 rounded-lg">
                    <p className="text-sm text-muted-foreground">{disc.interpretation}</p>
                  </div>
                )}

                <div className="mt-3 text-xs text-muted-foreground">
                  {disc.sent_at && (
                    <span>
                      Enviado em {format(new Date(disc.sent_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </span>
                  )}
                  {disc.completed_at && (
                    <span className="ml-4">
                      Concluído em {format(new Date(disc.completed_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
