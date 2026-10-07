import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ClipboardList, CheckCircle2, RotateCcw, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import type { AcademyUserContext } from "../AcademyLayout";
import { iaDb, fmtDateTime, type LessonDeliverable } from "@/lib/academy/iaAcademy";

// Fila de revisão dos entregáveis (UNV IA Academy). Aprovar pontua via RPC
// ia_academy_review_deliverable (uma única vez).

interface Row extends LessonDeliverable {
  lesson_title: string;
  track_name: string;
  student_name: string;
  student_email: string;
}

type Filter = "submitted" | "approved" | "changes_requested" | "all";

export const AcademyAdminDeliverablesPage = () => {
  const userContext = useOutletContext<AcademyUserContext>();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("submitted");
  const [review, setReview] = useState<Row | null>(null);
  const [feedback, setFeedback] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, [filter]); // eslint-disable-line react-hooks/exhaustive-deps

  const load = async () => {
    setLoading(true);
    try {
      let q = iaDb
        .from("academy_lesson_deliverables")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(300);
      if (filter !== "all") q = q.eq("status", filter);
      const { data } = await q;
      const list = (data as LessonDeliverable[]) || [];
      const lessonIds = [...new Set(list.map((d) => d.lesson_id))];
      const userIds = [...new Set(list.map((d) => d.onboarding_user_id))];
      const [{ data: lessons }, { data: users }] = await Promise.all([
        lessonIds.length ? supabase.from("academy_lessons").select("id, title, academy_tracks(name)").in("id", lessonIds) : Promise.resolve({ data: [] as any[] }),
        userIds.length ? supabase.from("onboarding_users").select("id, name, email").in("id", userIds) : Promise.resolve({ data: [] as any[] }),
      ]);
      const lmap = new Map<string, any>(); (lessons || []).forEach((l: any) => lmap.set(l.id, l));
      const umap = new Map<string, any>(); (users || []).forEach((u: any) => umap.set(u.id, u));
      setRows(list.map((d) => ({
        ...d,
        lesson_title: lmap.get(d.lesson_id)?.title || "—",
        track_name: lmap.get(d.lesson_id)?.academy_tracks?.name || "—",
        student_name: umap.get(d.onboarding_user_id)?.name || "—",
        student_email: umap.get(d.onboarding_user_id)?.email || "",
      })));
    } finally {
      setLoading(false);
    }
  };

  const decide = async (status: "approved" | "changes_requested") => {
    if (!review) return;
    if (status === "changes_requested" && !feedback.trim()) return toast.error("Diga o que precisa ajustar.");
    setSaving(true);
    try {
      const { error } = await iaDb.rpc("ia_academy_review_deliverable", {
        p_deliverable_id: review.id,
        p_status: status,
        p_feedback: feedback.trim() || null,
      });
      if (error) throw error;
      toast.success(status === "approved" ? "Aprovado e pontuado" : "Ajustes solicitados");
      setReview(null);
      setFeedback("");
      load();
    } catch (e) {
      console.error(e);
      toast.error("Não consegui registrar a revisão");
    } finally {
      setSaving(false);
    }
  };

  if (!userContext.isAdmin) {
    return <div className="p-6"><Card className="p-12 text-center"><h3 className="font-semibold">Acesso negado</h3></Card></div>;
  }

  const filters: { k: Filter; label: string }[] = [
    { k: "submitted", label: "Em revisão" },
    { k: "changes_requested", label: "Ajustes pedidos" },
    { k: "approved", label: "Aprovados" },
    { k: "all", label: "Todos" },
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2"><ClipboardList className="h-7 w-7 text-primary" /> Entregáveis</h1>
        <p className="text-muted-foreground mt-1">Revise a prova de implementação de cada aula. Aprovar pontua o aluno.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {filters.map((f) => (
          <Button key={f.k} size="sm" variant={filter === f.k ? "default" : "outline"} onClick={() => setFilter(f.k)}>{f.label}</Button>
        ))}
      </div>

      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>
          ) : rows.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-12">Nada nesta fila.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Aluno</TableHead>
                  <TableHead>Aula</TableHead>
                  <TableHead>Enviado</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <div className="font-medium">{r.student_name}</div>
                      <div className="text-xs text-muted-foreground">{r.student_email}</div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{r.lesson_title}</div>
                      <div className="text-xs text-muted-foreground">{r.track_name}</div>
                    </TableCell>
                    <TableCell className="text-sm">{fmtDateTime(r.updated_at)}</TableCell>
                    <TableCell>
                      <Badge variant={r.status === "approved" ? "default" : r.status === "submitted" ? "secondary" : "destructive"}>
                        {r.status === "approved" ? `Aprovado · ${r.points_awarded} pts` : r.status === "submitted" ? "Em revisão" : "Ajustes"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" onClick={() => { setReview(r); setFeedback(r.feedback || ""); }}>Revisar</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!review} onOpenChange={(o) => !o && setReview(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>{review?.lesson_title}</DialogTitle></DialogHeader>
          {review && (
            <div className="space-y-4 text-sm">
              <p><span className="text-muted-foreground">Aluno:</span> {review.student_name} · {review.student_email}</p>
              {review.proof_url && (
                <a href={review.proof_url} target="_blank" rel="noopener noreferrer" className="text-primary underline break-all flex items-center gap-1">
                  <ExternalLink className="h-4 w-4" /> {review.proof_url}
                </a>
              )}
              {review.notes && <div className="rounded-lg bg-muted p-3 whitespace-pre-wrap">{review.notes}</div>}
              <div>
                <label className="text-sm font-medium">Retorno pro aluno</label>
                <Textarea className="mt-1" rows={4} value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder="Direto: o que ficou bom, o que falta, próximo passo." />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => decide("changes_requested")} disabled={saving}>
              <RotateCcw className="h-4 w-4 mr-2" /> Pedir ajustes
            </Button>
            <Button onClick={() => decide("approved")} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">
              <CheckCircle2 className="h-4 w-4 mr-2" /> Aprovar e pontuar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AcademyAdminDeliverablesPage;
