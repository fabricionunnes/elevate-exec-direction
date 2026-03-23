import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { FileText } from "lucide-react";

interface Answer {
  id: string;
  answer_text: string;
  question: {
    question_text: string;
    question_type: string;
  };
}

export const LeadFormAnswersTab = ({ leadId }: { leadId: string }) => {
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAnswers();
  }, [leadId]);

  const loadAnswers = async () => {
    const { data } = await supabase
      .from("crm_lead_form_answers" as any)
      .select("id, answer_text, question_id")
      .eq("lead_id", leadId);

    if (!data || data.length === 0) {
      setAnswers([]);
      setLoading(false);
      return;
    }

    // Load questions
    const questionIds = (data as any[]).map((a: any) => a.question_id);
    const { data: questions } = await supabase
      .from("crm_pipeline_form_questions" as any)
      .select("id, question_text, question_type")
      .in("id", questionIds);

    const qMap = new Map((questions as any[] || []).map((q: any) => [q.id, q]));

    const mapped = (data as any[])
      .map((a: any) => ({
        id: a.id,
        answer_text: a.answer_text,
        question: qMap.get(a.question_id) || { question_text: "Pergunta", question_type: "open" },
      }))
      .filter((a) => a.answer_text);

    setAnswers(mapped);
    setLoading(false);
  };

  if (loading) {
    return <div className="p-4"><div className="h-20 bg-muted rounded animate-pulse" /></div>;
  }

  if (answers.length === 0) {
    return (
      <div className="p-6 text-center text-muted-foreground text-sm">
        <FileText className="h-8 w-8 mx-auto mb-2 opacity-40" />
        Nenhuma resposta de formulário registrada.
      </div>
    );
  }

  return (
    <div className="p-4 space-y-3">
      {answers.map((a) => (
        <div key={a.id} className="border rounded-lg p-3 space-y-1">
          <p className="text-xs font-medium text-muted-foreground">{a.question.question_text}</p>
          <p className="text-sm">{a.answer_text}</p>
        </div>
      ))}
    </div>
  );
};
