import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowDown, DollarSign, Clock, Target, Award, CheckCircle2 } from "lucide-react";
import type { CareerTrack } from "./types";

interface Props {
  tracks: CareerTrack[];
  readOnly?: boolean;
}

export function CareerViewSection({ tracks, readOnly }: Props) {
  const formatCurrency = (val: number | null) => val != null ? `R$ ${val.toLocaleString("pt-BR")}` : "-";

  if (tracks.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          Nenhum plano de carreira publicado ainda.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-8">
      {tracks.map(track => (
        <Card key={track.id}>
          <CardHeader>
            <div className="flex items-center gap-3">
              <CardTitle className="text-xl">{track.name}</CardTitle>
              <Badge variant={track.track_type === "vertical" ? "default" : "secondary"}>
                {track.track_type === "vertical" ? "Trilha Vertical" : "Trilha Horizontal"}
              </Badge>
              {track.department && <Badge variant="outline">{track.department}</Badge>}
            </div>
            {track.description && <p className="text-muted-foreground mt-1">{track.description}</p>}
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {(track.roles || []).sort((a, b) => a.level_order - b.level_order).map((role, idx, arr) => (
                <div key={role.id}>
                  <div className="border rounded-lg p-5 bg-muted/20 hover:bg-muted/40 transition-colors">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 text-primary font-bold">
                          {idx + 1}
                        </div>
                        <div>
                          <h4 className="text-lg font-semibold">{role.name}</h4>
                          {role.description && <p className="text-sm text-muted-foreground">{role.description}</p>}
                        </div>
                      </div>
                      {role.is_entry_level && <Badge variant="outline" className="text-green-600 border-green-600">Nível Inicial</Badge>}
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-muted-foreground">Faixa Salarial</p>
                          <p className="font-medium">{formatCurrency(role.salary_min)} - {formatCurrency(role.salary_max)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-muted-foreground">Tempo Mínimo</p>
                          <p className="font-medium">{role.min_time_months ? `${role.min_time_months} meses` : "-"}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Target className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-muted-foreground">Critérios</p>
                          <p className="font-medium">{role.criteria?.length || 0}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Award className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-muted-foreground">Metas</p>
                          <p className="font-medium">{role.goals?.length || 0}</p>
                        </div>
                      </div>
                    </div>

                    {(role.criteria && role.criteria.length > 0) && (
                      <div className="mt-4 pt-3 border-t">
                        <p className="text-sm font-semibold mb-2">Critérios de Progressão</p>
                        <div className="flex flex-wrap gap-2">
                          {role.criteria.map(c => (
                            <div key={c.id} className="flex items-center gap-1 bg-background rounded-md px-3 py-1 text-xs border">
                              <CheckCircle2 className="h-3 w-3 text-primary" />
                              <span>{c.name}</span>
                              <span className="text-muted-foreground">(nota mín. {c.min_score})</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {role.benefits && (
                      <div className="mt-3 pt-3 border-t">
                        <p className="text-sm font-semibold mb-1">Benefícios</p>
                        <p className="text-sm text-muted-foreground">{role.benefits}</p>
                      </div>
                    )}
                  </div>
                  {idx < arr.length - 1 && track.track_type === "vertical" && (
                    <div className="flex justify-center py-2">
                      <ArrowDown className="h-5 w-5 text-muted-foreground" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
