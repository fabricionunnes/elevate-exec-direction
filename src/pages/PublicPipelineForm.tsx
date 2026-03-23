import { useState, useEffect } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { CheckCircle2, Loader2, AlertCircle } from "lucide-react";

interface FormConfig {
  id: string;
  title: string | null;
  description: string | null;
  pipeline_id: string;
  form_token: string;
  is_active: boolean;
  origin_name: string | null;
}

const PublicPipelineForm = () => {
  const { token } = useParams<{ token: string }>();
  const [searchParams] = useSearchParams();
  const [form, setForm] = useState<FormConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [empresa, setEmpresa] = useState("");
  const [desafio, setDesafio] = useState("");

  useEffect(() => {
    if (token) loadForm();
  }, [token]);

  const loadForm = async () => {
    const { data } = await supabase
      .from("crm_pipeline_forms")
      .select("id, title, description, pipeline_id, form_token, is_active, origin_name")
      .eq("form_token", token)
      .eq("is_active", true)
      .maybeSingle();

    setForm(data);
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form || !nome.trim() || !telefone.trim() || !email.trim()) return;

    setSubmitting(true);
    setError(null);

    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/submit-pipeline-form`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            form_token: form.form_token,
            nome: nome.trim(),
            telefone: telefone.trim(),
            email: email.trim(),
            empresa: empresa.trim() || undefined,
            desafio: desafio.trim() || undefined,
            utm_source: searchParams.get("utm_source") || undefined,
            utm_medium: searchParams.get("utm_medium") || undefined,
            utm_campaign: searchParams.get("utm_campaign") || undefined,
            utm_content: searchParams.get("utm_content") || undefined,
          }),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Erro ao enviar");
      }

      setSubmitted(true);
    } catch (err: any) {
      setError(err.message || "Erro ao enviar formulário");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!form) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h2 className="text-lg font-semibold mb-2">Formulário não encontrado</h2>
            <p className="text-sm text-muted-foreground">
              Este formulário não existe ou está inativo.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <h2 className="text-lg font-semibold mb-2">Enviado com sucesso!</h2>
            <p className="text-sm text-muted-foreground">
              Seus dados foram recebidos. Entraremos em contato em breve.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="max-w-lg w-full">
        <CardHeader>
          <CardTitle>{form.title || "Formulário de Contato"}</CardTitle>
          {form.description && (
            <CardDescription>{form.description}</CardDescription>
          )}
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome completo *</Label>
              <Input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} required maxLength={200} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="telefone">Telefone *</Label>
              <Input id="telefone" value={telefone} onChange={(e) => setTelefone(e.target.value)} required maxLength={20} placeholder="5511999999999" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">E-mail *</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required maxLength={255} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="empresa">Empresa</Label>
              <Input id="empresa" value={empresa} onChange={(e) => setEmpresa(e.target.value)} maxLength={200} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="desafio">Qual seu principal desafio?</Label>
              <Textarea id="desafio" value={desafio} onChange={(e) => setDesafio(e.target.value)} maxLength={1000} rows={3} />
            </div>

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Enviar
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default PublicPipelineForm;
