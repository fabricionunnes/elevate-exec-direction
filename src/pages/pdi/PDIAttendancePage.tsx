import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { CalendarCheck, Search, Save, Users, Star } from "lucide-react";
import { format } from "date-fns";

interface Track { id: string; name: string; scope: string; cohort_id: string | null; }
interface Participant { id: string; full_name: string; company: string | null; cohort_id: string; }
interface Cohort { id: string; name: string; }
interface AttendanceRecord { participant_id: string; is_present: boolean; }

export default function PDIAttendancePage() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [selectedTrack, setSelectedTrack] = useState("");
  const [selectedCohort, setSelectedCohort] = useState("");
  const [sessionDate, setSessionDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [search, setSearch] = useState("");
  const [attendance, setAttendance] = useState<Map<string, boolean>>(new Map());
  const [existingRecords, setExistingRecords] = useState<Map<string, boolean>>(new Map());
  const [pointsPerPresence, setPointsPerPresence] = useState(10);

  // Stats
  const [totalSessions, setTotalSessions] = useState(0);
  const [avgAttendance, setAvgAttendance] = useState(0);

  const fetchBase = useCallback(async () => {
    const [tracksRes, cohortsRes, partsRes] = await Promise.all([
      supabase.from("pdi_tracks").select("id, name, scope, cohort_id").eq("is_active", true).order("name"),
      supabase.from("pdi_cohorts").select("id, name").order("name"),
      supabase.from("pdi_participants").select("id, full_name, company, cohort_id").eq("status", "active").order("full_name"),
    ]);
    setTracks((tracksRes.data as any[]) || []);
    setCohorts((cohortsRes.data as any[]) || []);
    setParticipants((partsRes.data as any[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchBase(); }, [fetchBase]);

  // Fetch existing attendance when track + date change
  useEffect(() => {
    if (!selectedTrack || !sessionDate) return;
    const fetchAttendance = async () => {
      const { data } = await supabase
        .from("pdi_attendance")
        .select("participant_id, is_present")
        .eq("track_id", selectedTrack)
        .eq("session_date", sessionDate);

      const map = new Map<string, boolean>();
      ((data as any[]) || []).forEach((r: AttendanceRecord) => map.set(r.participant_id, r.is_present));
      setExistingRecords(new Map(map));
      setAttendance(new Map(map));
    };
    fetchAttendance();
  }, [selectedTrack, sessionDate]);

  // Fetch stats
  useEffect(() => {
    if (!selectedTrack) return;
    const fetchStats = async () => {
      const { data } = await supabase
        .from("pdi_attendance")
        .select("session_date, is_present")
        .eq("track_id", selectedTrack);
      const records = (data as any[]) || [];
      const dates = new Set(records.map((r) => r.session_date));
      setTotalSessions(dates.size);
      const present = records.filter((r) => r.is_present).length;
      setAvgAttendance(records.length > 0 ? Math.round((present / records.length) * 100) : 0);
    };
    fetchStats();
  }, [selectedTrack]);

  // Get filtered participants based on track scope and cohort filter
  const getFilteredParticipants = () => {
    let list = participants;
    const track = tracks.find((t) => t.id === selectedTrack);

    if (track?.scope === "cohort" && track.cohort_id) {
      list = list.filter((p) => p.cohort_id === track.cohort_id);
    } else if (selectedCohort && selectedCohort !== "all") {
      list = list.filter((p) => p.cohort_id === selectedCohort);
    }

    if (search) {
      list = list.filter((p) => p.full_name.toLowerCase().includes(search.toLowerCase()));
    }

    return list;
  };

  const filteredParticipants = selectedTrack ? getFilteredParticipants() : [];

  const toggleAttendance = (participantId: string) => {
    setAttendance((prev) => {
      const next = new Map(prev);
      next.set(participantId, !next.get(participantId));
      return next;
    });
  };

  const markAll = (present: boolean) => {
    setAttendance((prev) => {
      const next = new Map(prev);
      filteredParticipants.forEach((p) => next.set(p.id, present));
      return next;
    });
  };

  const handleSave = async () => {
    if (!selectedTrack || !sessionDate) {
      toast.error("Selecione uma trilha e data");
      return;
    }

    setSaving(true);

    const records = filteredParticipants.map((p) => ({
      track_id: selectedTrack,
      participant_id: p.id,
      session_date: sessionDate,
      is_present: attendance.get(p.id) ?? false,
      points_awarded: (attendance.get(p.id) ?? false) ? pointsPerPresence : 0,
    }));

    // Upsert: delete existing + insert new
    await supabase
      .from("pdi_attendance")
      .delete()
      .eq("track_id", selectedTrack)
      .eq("session_date", sessionDate);

    const { error } = await supabase.from("pdi_attendance").insert(records);

    if (error) {
      toast.error("Erro ao salvar presença");
      console.error(error);
    } else {
      const presentCount = records.filter((r) => r.is_present).length;
      toast.success(`Presença salva! ${presentCount}/${records.length} presentes (+${presentCount * pointsPerPresence} pts)`);
      setExistingRecords(new Map(attendance));
    }
    setSaving(false);
  };

  const presentCount = filteredParticipants.filter((p) => attendance.get(p.id)).length;
  const hasChanges = (() => {
    for (const p of filteredParticipants) {
      if ((attendance.get(p.id) ?? false) !== (existingRecords.get(p.id) ?? false)) return true;
    }
    return false;
  })();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Presença</h1>
          <p className="text-sm text-muted-foreground">Marque presença dos participantes em cada aula/trilha</p>
        </div>
      </div>

      {/* Stats */}
      {selectedTrack && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-primary">{totalSessions}</p>
              <p className="text-xs text-muted-foreground">Sessões registradas</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-primary">{avgAttendance}%</p>
              <p className="text-xs text-muted-foreground">Presença média</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-primary">{presentCount}/{filteredParticipants.length}</p>
              <p className="text-xs text-muted-foreground">Presentes hoje</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-primary">{pointsPerPresence} pts</p>
              <p className="text-xs text-muted-foreground">Por presença</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <Label className="text-xs mb-1 block">Trilha *</Label>
              <Select value={selectedTrack} onValueChange={setSelectedTrack}>
                <SelectTrigger><SelectValue placeholder="Selecione a trilha..." /></SelectTrigger>
                <SelectContent>
                  {tracks.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs mb-1 block">Data da Sessão *</Label>
              <Input type="date" value={sessionDate} onChange={(e) => setSessionDate(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs mb-1 block">Filtrar por Turma</Label>
              <Select value={selectedCohort || "all"} onValueChange={(v) => setSelectedCohort(v === "all" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Todas as turmas" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as turmas</SelectItem>
                  {cohorts.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs mb-1 block">Pontos por Presença</Label>
              <Input type="number" value={pointsPerPresence} onChange={(e) => setPointsPerPresence(parseInt(e.target.value) || 0)} min={0} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Participants list */}
      {!selectedTrack ? (
        <div className="text-center text-muted-foreground py-12">
          <CalendarCheck className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p>Selecione uma trilha para marcar presença</p>
        </div>
      ) : loading ? (
        <div className="text-center text-muted-foreground py-12">Carregando...</div>
      ) : filteredParticipants.length === 0 ? (
        <div className="text-center text-muted-foreground py-12">Nenhum participante encontrado.</div>
      ) : (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4" />
                Participantes ({filteredParticipants.length})
              </CardTitle>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 h-8 w-48 text-sm" />
                </div>
                <Button variant="outline" size="sm" onClick={() => markAll(true)}>Todos presentes</Button>
                <Button variant="outline" size="sm" onClick={() => markAll(false)}>Limpar</Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="divide-y divide-border">
              {filteredParticipants.map((p) => {
                const isPresent = attendance.get(p.id) ?? false;
                const wasRecorded = existingRecords.has(p.id);
                return (
                  <div
                    key={p.id}
                    className="flex items-center justify-between py-3 px-2 hover:bg-muted/30 rounded-lg cursor-pointer transition-colors"
                    onClick={() => toggleAttendance(p.id)}
                  >
                    <div className="flex items-center gap-3">
                      <Checkbox checked={isPresent} onCheckedChange={() => toggleAttendance(p.id)} />
                      <div>
                        <p className="text-sm font-medium text-foreground">{p.full_name}</p>
                        {p.company && <p className="text-xs text-muted-foreground">{p.company}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {isPresent && (
                        <Badge variant="default" className="text-xs gap-1">
                          <Star className="h-3 w-3" />+{pointsPerPresence} pts
                        </Badge>
                      )}
                      {wasRecorded && (
                        <Badge variant="outline" className="text-[10px]">Já registrado</Badge>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
              <div className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{presentCount}</span> de {filteredParticipants.length} presentes
                {presentCount > 0 && (
                  <span className="ml-2 text-primary font-medium">
                    (+{presentCount * pointsPerPresence} pontos)
                  </span>
                )}
              </div>
              <Button onClick={handleSave} disabled={saving || !hasChanges}>
                <Save className="h-4 w-4 mr-2" />
                {saving ? "Salvando..." : "Salvar Presença"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
