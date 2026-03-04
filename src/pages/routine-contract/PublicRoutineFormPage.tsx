import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, Loader2, FileText } from "lucide-react";

const PublicRoutineFormPage = () => {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [linkData, setLinkData] = useState<{ id: string; project_id: string } | null>(null);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    employee_name: "",
    employee_role: "",
    employee_department: "",
    employee_tenure: "",
    daily_activities: "",
    most_important_activities: "",
    time_per_activity: "",
    weekly_activities: "",
    weekly_activities_list: "",
    daily_contacts: "",
    weekly_meetings: "",
    monthly_sales: "",
    main_responsibilities: "",
    main_challenges: "",
    productivity_suggestions: "",
  });

  useEffect(() => {
    const loadLink = async () => {
      if (!token) { setError("Link inválido."); setLoading(false); return; }
      const { data, error: err } = await supabase
        .from("routine_form_links")
        .select("id, project_id, is_active, expires_at")
        .eq("access_token", token)
        .maybeSingle();

      if (err || !data) { setError("Link não encontrado."); setLoading(false); return; }
      if (!data.is_active) { setError("Este link foi desativado."); setLoading(false); return; }
      if (data.expires_at && new Date(data.expires_at) < new Date()) { setError("Este link expirou."); setLoading(false); return; }
      setLinkData({ id: data.id, project_id: data.project_id });
      setLoading(false);
    };
    loadLink();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkData || !form.employee_name.trim()) return;
    setSubmitting(true);
    try {
      const { error: insertErr } = await supabase.from("routine_form_responses").insert({
        project_id: linkData.project_id,
        form_link_id: linkData.id,
        employee_name: form.employee_name,
        employee_role: form.employee_role || null,
        employee_department: form.employee_department || null,
        employee_tenure: form.employee_tenure || null,
        daily_activities: form.daily_activities || null,
        most_important_activities: form.most_important_activities || null,
        time_per_activity: form.time_per_activity || null,
        weekly_activities: form.weekly_activities || null,
        weekly_activities_list: form.weekly_activities_list || null,
        daily_contacts: form.daily_contacts ? parseInt(form.daily_contacts) : null,
        weekly_meetings: form.weekly_meetings ? parseInt(form.weekly_meetings) : null,
        monthly_sales: form.monthly_sales ? parseInt(form.monthly_sales) : null,
        main_responsibilities: form.main_responsibilities || null,
        main_challenges: form.main_challenges || null,
        productivity_suggestions: form.productivity_suggestions || null,
      });
      if (insertErr) throw insertErr;
      setSubmitted(true);
    } catch (err) {
      console.error(err);
      setError("Erro ao enviar. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  };

  const updateField = (field: string, value: string) => setForm((prev) => ({ ...prev, [field]: value }));

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (error) return <div className="min-h-screen flex items-center justify-center"><Card className="max-w-md w-full mx-4"><CardContent className="pt-6 text-center"><p className="text-destructive">{error}</p></CardContent></Card></div>;

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center space-y-4">
            <CheckCircle2 className="h-16 w-16 text-green-600 mx-auto" />
            <h2 className="text-2xl font-bold">Formulário Enviado!</h2>
            <p className="text-muted-foreground">Suas respostas foram registradas com sucesso. O consultor responsável irá analisar e organizar sua rotina.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <FileText className="h-12 w-12 text-primary mx-auto" />
          <h1 className="text-2xl font-bold">Contrato de Rotina</h1>
          <p className="text-muted-foreground">Preencha o formulário abaixo descrevendo sua rotina de trabalho</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Dados do Colaborador */}
          <Card>
            <CardHeader><CardTitle className="text-lg">👤 Dados do Colaborador</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div><Label>Nome completo *</Label><Input value={form.employee_name} onChange={(e) => updateField("employee_name", e.target.value)} required /></div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div><Label>Cargo</Label><Input value={form.employee_role} onChange={(e) => updateField("employee_role", e.target.value)} /></div>
                <div><Label>Área ou setor</Label><Input value={form.employee_department} onChange={(e) => updateField("employee_department", e.target.value)} /></div>
              </div>
              <div><Label>Tempo de empresa</Label><Input value={form.employee_tenure} onChange={(e) => updateField("employee_tenure", e.target.value)} placeholder="Ex: 2 anos" /></div>
            </CardContent>
          </Card>

          {/* Rotina Diária */}
          <Card>
            <CardHeader><CardTitle className="text-lg">📅 Rotina Diária</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div><Label>Quais atividades você realiza diariamente?</Label><Textarea value={form.daily_activities} onChange={(e) => updateField("daily_activities", e.target.value)} rows={4} /></div>
              <div><Label>Quais atividades você considera mais importantes no seu trabalho?</Label><Textarea value={form.most_important_activities} onChange={(e) => updateField("most_important_activities", e.target.value)} rows={3} /></div>
              <div><Label>Quanto tempo em média você dedica para cada atividade?</Label><Textarea value={form.time_per_activity} onChange={(e) => updateField("time_per_activity", e.target.value)} rows={3} /></div>
            </CardContent>
          </Card>

          {/* Rotina Semanal */}
          <Card>
            <CardHeader><CardTitle className="text-lg">📆 Rotina Semanal</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div><Label>Existem atividades que você realiza semanalmente?</Label><Textarea value={form.weekly_activities} onChange={(e) => updateField("weekly_activities", e.target.value)} rows={3} /></div>
              <div><Label>Quais são?</Label><Textarea value={form.weekly_activities_list} onChange={(e) => updateField("weekly_activities_list", e.target.value)} rows={3} /></div>
            </CardContent>
          </Card>

          {/* Processo Comercial */}
          <Card>
            <CardHeader><CardTitle className="text-lg">💼 Processo Comercial (se vendedor)</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div><Label>Contatos por dia</Label><Input type="number" value={form.daily_contacts} onChange={(e) => updateField("daily_contacts", e.target.value)} /></div>
                <div><Label>Reuniões por semana</Label><Input type="number" value={form.weekly_meetings} onChange={(e) => updateField("weekly_meetings", e.target.value)} /></div>
                <div><Label>Vendas por mês</Label><Input type="number" value={form.monthly_sales} onChange={(e) => updateField("monthly_sales", e.target.value)} /></div>
              </div>
            </CardContent>
          </Card>

          {/* Responsabilidades */}
          <Card>
            <CardHeader><CardTitle className="text-lg">🎯 Responsabilidades</CardTitle></CardHeader>
            <CardContent>
              <div><Label>Quais são suas principais responsabilidades dentro da empresa?</Label><Textarea value={form.main_responsibilities} onChange={(e) => updateField("main_responsibilities", e.target.value)} rows={4} /></div>
            </CardContent>
          </Card>

          {/* Desafios */}
          <Card>
            <CardHeader><CardTitle className="text-lg">⚠️ Desafios</CardTitle></CardHeader>
            <CardContent>
              <div><Label>O que mais dificulta sua rotina hoje?</Label><Textarea value={form.main_challenges} onChange={(e) => updateField("main_challenges", e.target.value)} rows={3} /></div>
            </CardContent>
          </Card>

          {/* Sugestões */}
          <Card>
            <CardHeader><CardTitle className="text-lg">💡 Sugestões</CardTitle></CardHeader>
            <CardContent>
              <div><Label>O que poderia melhorar sua produtividade?</Label><Textarea value={form.productivity_suggestions} onChange={(e) => updateField("productivity_suggestions", e.target.value)} rows={3} /></div>
            </CardContent>
          </Card>

          <Button type="submit" className="w-full" size="lg" disabled={submitting || !form.employee_name.trim()}>
            {submitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Enviando...</> : "Enviar Formulário"}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default PublicRoutineFormPage;
