import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, DollarSign, Clock, TrendingUp } from "lucide-react";
import type { CareerTrack, CareerRole } from "./types";

interface Props {
  tracks: CareerTrack[];
}

export function CareerSimulationSection({ tracks }: Props) {
  const [selectedTrackId, setSelectedTrackId] = useState<string>("");
  const [selectedRoleId, setSelectedRoleId] = useState<string>("");

  const allRoles = useMemo(() => tracks.flatMap(t => (t.roles || []).map(r => ({ ...r, trackName: t.name, trackType: t.track_type }))), [tracks]);
  const selectedTrack = tracks.find(t => t.id === selectedTrackId);
  const selectedRole = allRoles.find(r => r.id === selectedRoleId);

  const futureRoles = useMemo(() => {
    if (!selectedRole || !selectedTrack) return [];
    return (selectedTrack.roles || [])
      .filter(r => r.level_order > selectedRole.level_order)
      .sort((a, b) => a.level_order - b.level_order);
  }, [selectedRole, selectedTrack]);

  const totalMonths = futureRoles.reduce((acc, r) => acc + (r.min_time_months || 0), selectedRole?.min_time_months || 0);
  const salaryGrowth = futureRoles.length > 0 && selectedRole?.salary_min && futureRoles[futureRoles.length - 1]?.salary_max
    ? ((futureRoles[futureRoles.length - 1].salary_max! - selectedRole.salary_min) / selectedRole.salary_min * 100).toFixed(0)
    : null;

  const formatCurrency = (val: number | null) => val != null ? `R$ ${val.toLocaleString("pt-BR")}` : "-";

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Simulação de Evolução de Carreira</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Selecione a Trilha</label>
              <Select value={selectedTrackId} onValueChange={v => { setSelectedTrackId(v); setSelectedRoleId(""); }}>
                <SelectTrigger><SelectValue placeholder="Escolha uma trilha..." /></SelectTrigger>
                <SelectContent>
                  {tracks.map(t => <SelectItem key={t.id} value={t.id}>{t.name} ({t.track_type === "vertical" ? "Vertical" : "Horizontal"})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Cargo Inicial</label>
              <Select value={selectedRoleId} onValueChange={setSelectedRoleId} disabled={!selectedTrackId}>
                <SelectTrigger><SelectValue placeholder="Escolha um cargo..." /></SelectTrigger>
                <SelectContent>
                  {(selectedTrack?.roles || []).sort((a, b) => a.level_order - b.level_order).map(r => (
                    <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {selectedRole && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-6 flex items-center gap-3">
                <Clock className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{totalMonths > 0 ? `${totalMonths} meses` : "-"}</p>
                  <p className="text-sm text-muted-foreground">Tempo total estimado</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 flex items-center gap-3">
                <TrendingUp className="h-5 w-5 text-green-500" />
                <div>
                  <p className="text-2xl font-bold">{futureRoles.length + 1}</p>
                  <p className="text-sm text-muted-foreground">Níveis na trilha</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 flex items-center gap-3">
                <DollarSign className="h-5 w-5 text-yellow-500" />
                <div>
                  <p className="text-2xl font-bold">{salaryGrowth ? `+${salaryGrowth}%` : "-"}</p>
                  <p className="text-sm text-muted-foreground">Crescimento salarial</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Career Path Visualization */}
          <Card>
            <CardHeader><CardTitle className="text-lg">Mapa de Evolução</CardTitle></CardHeader>
            <CardContent>
              <div className="flex flex-wrap items-center gap-3">
                <div className="bg-primary/10 border-2 border-primary rounded-lg p-4 min-w-[180px]">
                  <p className="font-bold text-primary">{selectedRole.name}</p>
                  <p className="text-xs text-muted-foreground mt-1">{formatCurrency(selectedRole.salary_min)} - {formatCurrency(selectedRole.salary_max)}</p>
                  <Badge className="mt-2" variant="default">Atual</Badge>
                </div>
                {futureRoles.map((role, idx) => (
                  <div key={role.id} className="flex items-center gap-3">
                    <ArrowRight className="h-5 w-5 text-muted-foreground" />
                    <div className="bg-muted/50 border rounded-lg p-4 min-w-[180px]">
                      <p className="font-medium">{role.name}</p>
                      <p className="text-xs text-muted-foreground mt-1">{formatCurrency(role.salary_min)} - {formatCurrency(role.salary_max)}</p>
                      {role.min_time_months && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                          <Clock className="h-3 w-3" />{role.min_time_months} meses mín.
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {!selectedRole && tracks.length > 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Selecione uma trilha e um cargo inicial para simular a evolução de carreira.
          </CardContent>
        </Card>
      )}

      {tracks.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Nenhuma trilha disponível. Crie trilhas no editor primeiro.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
