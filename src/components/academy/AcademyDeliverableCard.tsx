import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ClipboardCheck, Send, CheckCircle2, AlertCircle, Clock } from "lucide-react";
import { toast } from "sonner";
import { iaDb, type LessonDeliverable } from "@/lib/academy/iaAcademy";

// Entregável da aula: o aluno sobe o link/print da implementação, o time UNV
// revisa (aprova ou pede ajuste) e os pontos entram no ledger.

interface Props {
  lessonId: string;
  onboardingUserId: string | null;
  prompt: string;
  points: number;
}

const STATUS: Record<LessonDeliverable["status"], { label: string; cls: string; icon: typeof Clock }> = {
  submitted: { label: "Em revisão", cls: "bg-amber-500/15 text-amber-700 dark:text-amber-300", icon: Clock },
  approved: { label: "Aprovado", cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300", icon: CheckCircle2 },
  changes_requested: { label: "Ajustes pedidos", cls: "bg-red-500/15 text-red-700 dark:text-red-300", icon: AlertCircle },
};

export function AcademyDeliverableCard({ lessonId, onboardingUserId, prompt, points }: Props) {
  const [row, setRow] = useState<LessonDeliverable | null>(null);
  const [url, setUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!onboardingUserId) return;
    (async () => {
      const { data } = await iaDb
        .from("academy_lesson_deliverables")
        .select("*")
        .eq("lesson_id", lessonId)
        .eq("onboarding_user_id", onboardingUserId)
        .maybeSingle();
      const d = (data as LessonDeliverable) || null;
      setRow(d);
      setUrl(d?.proof_url || "");
      setNotes(d?.notes || "");
      setEditing(!d);
    })();
  }, [lessonId, onboardingUserId]);

  const submit = async () => {
    if (!onboardingUserId) return;
    if (!url.trim() && !notes.trim()) return toast.error("Cole o link do print/documento ou descreva o que implementou.");
    setSaving(true);
    try {
      const { data, error } = await iaDb
        .from("academy_lesson_deliverables")
        .upsert(
          {
            lesson_id: lessonId,
            onboarding_user_id: onboardingUserId,
            proof_url: url.trim() || null,
            notes: notes.trim() || null,
            status: "submitted",
            feedback: null,
            reviewed_at: null,
          },
          { onConflict: "lesson_id,onboarding_user_id" },
        )
        .select("*")
        .single();
      if (error) throw error;
      setRow(data as LessonDeliverable);
      setEditing(false);
      toast.success("Entregável enviado. O time UNV revisa e você recebe o retorno aqui.");
    } catch (e) {
      console.error(e);
      toast.error("Não consegui enviar o entregável");
    } finally {
      setSaving(false);
    }
  };

  if (!onboardingUserId) return null;
  const st = row ? STATUS[row.status] : null;
  const canEdit = !row || row.status === "changes_requested" || editing;

  return (
    <Card className="border-primary/30">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <ClipboardCheck className="h-5 w-5 text-primary" />
          Entregável da aula
          {st && (
            <Badge className={`ml-auto ${st.cls}`} variant="outline">
              <st.icon className="h-3 w-3 mr-1" /> {st.label}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm">{prompt}</p>
        <p className="text-xs text-muted-foreground">Vale {points} pontos quando aprovado. Aula = implantação: sem entregável, não conta.</p>

        {row?.status === "changes_requested" && row.feedback && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-3 text-sm">
            <p className="font-medium mb-1">Retorno do revisor</p>
            <p className="text-muted-foreground whitespace-pre-wrap">{row.feedback}</p>
          </div>
        )}
        {row?.status === "approved" && row.feedback && (
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm">
            <p className="font-medium mb-1">Retorno do revisor</p>
            <p className="text-muted-foreground whitespace-pre-wrap">{row.feedback}</p>
          </div>
        )}

        {canEdit ? (
          <div className="space-y-3">
            <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Link do print, documento, fluxo ou agente (Drive, Notion, N8N...)" />
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="O que você implementou e o que mudou na operação (2 a 4 linhas)" />
            <div className="flex gap-2">
              <Button onClick={submit} disabled={saving}>
                <Send className="h-4 w-4 mr-2" /> {saving ? "Enviando..." : row ? "Reenviar" : "Enviar entregável"}
              </Button>
              {row && editing && <Button variant="ghost" onClick={() => setEditing(false)}>Cancelar</Button>}
            </div>
          </div>
        ) : (
          <div className="space-y-2 text-sm">
            {row?.proof_url && (
              <a href={row.proof_url} target="_blank" rel="noopener noreferrer" className="text-primary underline break-all">{row.proof_url}</a>
            )}
            {row?.notes && <p className="text-muted-foreground whitespace-pre-wrap">{row.notes}</p>}
            {row?.status === "submitted" && (
              <Button variant="outline" size="sm" onClick={() => setEditing(true)}>Editar envio</Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
