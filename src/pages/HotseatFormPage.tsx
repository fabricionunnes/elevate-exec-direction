import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, CheckCircle2, Flame } from "lucide-react";
import { motion } from "framer-motion";

const SUBJECT_OPTIONS = [
  { id: "gestao_comercial", label: "Gestão comercial" },
  { id: "metas", label: "Metas" },
  { id: "financeiro", label: "Financeiro" },
  { id: "marketing", label: "Marketing" },
  { id: "planejamento", label: "Planejamento" },
];

export default function HotseatFormPage() {
  const [respondentName, setRespondentName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const toggleSubject = (subjectId: string) => {
    setSelectedSubjects((prev) =>
      prev.includes(subjectId)
        ? prev.filter((s) => s !== subjectId)
        : [...prev, subjectId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!respondentName.trim()) {
      toast.error("Por favor, informe seu nome");
      return;
    }

    if (!companyName.trim()) {
      toast.error("Por favor, informe o nome da sua empresa");
      return;
    }

    if (selectedSubjects.length === 0) {
      toast.error("Por favor, selecione pelo menos um assunto");
      return;
    }

    setIsSubmitting(true);

    try {
      const { data, error } = await supabase.functions.invoke("hotseat-public", {
        body: {
          action: "submit",
          respondentName: respondentName.trim(),
          companyName: companyName.trim(),
          subjects: selectedSubjects.map((id) => 
            SUBJECT_OPTIONS.find((o) => o.id === id)?.label || id
          ),
          description: description.trim() || null,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setIsSubmitted(true);
      toast.success("Formulário enviado com sucesso!");
    } catch (error) {
      console.error("Error submitting hotseat form:", error);
      toast.error("Erro ao enviar formulário. Tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          <Card className="max-w-md w-full text-center shadow-xl border-orange-200">
            <CardContent className="pt-12 pb-10 px-8">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="h-12 w-12 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-3">
                Formulário Enviado!
              </h2>
              <p className="text-muted-foreground">
                Obrigado por preencher o formulário do Hotseat. Nossa equipe entrará em contato em breve para agendar sua sessão.
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50 py-8 px-4">
      <div className="max-w-xl mx-auto">
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.4 }}
        >
          <Card className="shadow-xl border-orange-200">
            <CardHeader className="text-center pb-4">
              <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-amber-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <Flame className="h-9 w-9 text-white" />
              </div>
              <CardTitle className="text-2xl font-bold text-gray-900">
                Hotseat com Fabrício Nunnes
              </CardTitle>
              <CardDescription className="text-base">
                Preencha o formulário abaixo para participar de uma sessão exclusiva
              </CardDescription>
            </CardHeader>
            <div className="mx-6 mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-sm text-amber-900 leading-relaxed">
                <strong>Importante:</strong> O Hotseat será de 20 minutos para cada cliente de forma INDIVIDUAL com o Fabrício Nunnes, por isso é importante você enviar suas dúvidas todas aqui que o Fabrício já vai chegar preparado para a reunião com base nas informações que ele já tem da sua empresa. Nosso time de CS vai entrar em contato e avisar sobre qual será o horário que ele vai falar com você no dia. É muito importante que preencha este formulário sempre até um dia antes do hotseat, para garantir sua vaga e participação.
              </p>
            </div>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Nome */}
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-sm font-medium">
                    Qual seu nome? <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="name"
                    placeholder="Digite seu nome completo"
                    value={respondentName}
                    onChange={(e) => setRespondentName(e.target.value)}
                    className="h-11"
                    required
                  />
                </div>

                {/* Empresa */}
                <div className="space-y-2">
                  <Label htmlFor="company" className="text-sm font-medium">
                    Qual nome da sua empresa? <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="company"
                    placeholder="Digite o nome da empresa"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="h-11"
                    required
                  />
                </div>

                {/* Assuntos */}
                <div className="space-y-3">
                  <Label className="text-sm font-medium">
                    Qual ou quais os assuntos quer tratar? <span className="text-red-500">*</span>
                    <span className="text-muted-foreground font-normal"> (Pode marcar mais de uma opção)</span>
                  </Label>
                  <div className="grid gap-3">
                    {SUBJECT_OPTIONS.map((option) => (
                      <label
                        key={option.id}
                        className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                          selectedSubjects.includes(option.id)
                            ? "border-orange-500 bg-orange-50"
                            : "border-gray-200 hover:border-orange-300 hover:bg-orange-50/50"
                        }`}
                      >
                        <Checkbox
                          checked={selectedSubjects.includes(option.id)}
                          onCheckedChange={() => toggleSubject(option.id)}
                        />
                        <span className="text-sm font-medium">{option.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Descrição */}
                <div className="space-y-2">
                  <Label htmlFor="description" className="text-sm font-medium">
                    O que deseja tratar com Fabrício Nunnes?
                    <span className="text-muted-foreground font-normal"> (Somente assuntos sobre gestão)</span>
                  </Label>
                  <Textarea
                    id="description"
                    placeholder="Descreva o que gostaria de discutir na sessão..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={4}
                    className="resize-none"
                  />
                </div>

                {/* Submit */}
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full h-12 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-semibold"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    "Enviar Formulário"
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
