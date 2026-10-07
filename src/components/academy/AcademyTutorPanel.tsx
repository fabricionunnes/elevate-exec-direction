import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Bot, Send, Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import { iaDb } from "@/lib/academy/iaAcademy";

// Tutor IA da aula: responde com base no roteiro, no entregável e no Método
// CRESCER (edge function academy-tutor). Histórico fica em ia_academy_tutor_messages.

interface Msg { role: "user" | "assistant"; content: string; id?: string }

interface Props {
  lessonId: string;
  onboardingUserId: string | null;
  lessonTitle: string;
}

const SUGGESTIONS = [
  "Como adapto isso pro meu segmento?",
  "O que falta no meu entregável pra ser aprovado?",
  "Me dá o passo a passo resumido desta aula.",
];

export function AcademyTutorPanel({ lessonId, onboardingUserId, lessonTitle }: Props) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!onboardingUserId) return;
    (async () => {
      const { data } = await iaDb
        .from("ia_academy_tutor_messages")
        .select("id, role, content")
        .eq("onboarding_user_id", onboardingUserId)
        .eq("lesson_id", lessonId)
        .order("created_at", { ascending: true })
        .limit(40);
      setMessages((data as Msg[]) || []);
      setLoaded(true);
    })();
  }, [lessonId, onboardingUserId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, sending]);

  const send = async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || !onboardingUserId || sending) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", content: msg }]);
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("academy-tutor", {
        body: { onboarding_user_id: onboardingUserId, lesson_id: lessonId, message: msg },
      });
      if (error) {
        let detail = error.message;
        try {
          const body = await (error as any).context?.json?.();
          if (body?.error) detail = body.error;
        } catch { /* noop */ }
        throw new Error(detail);
      }
      setMessages((m) => [...m, { role: "assistant", content: data?.reply || "Sem resposta." }]);
    } catch (e) {
      console.error(e);
      toast.error((e as Error).message || "Tutor indisponível agora");
      setMessages((m) => m.slice(0, -1));
      setInput(msg);
    } finally {
      setSending(false);
    }
  };

  if (!onboardingUserId) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Bot className="h-5 w-5 text-primary" /> Tutor IA
          <span className="text-xs font-normal text-muted-foreground ml-1">· dúvidas de implementação desta aula</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="max-h-[380px] overflow-y-auto space-y-3 pr-1">
          {loaded && messages.length === 0 && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Pergunte como aplicar “{lessonTitle}” na sua empresa. Comece por uma dessas:</p>
              <div className="flex flex-wrap gap-2">
                {SUGGESTIONS.map((s) => (
                  <Button key={s} size="sm" variant="outline" onClick={() => send(s)} disabled={sending}>{s}</Button>
                ))}
              </div>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={m.id || i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                {m.role === "assistant" ? (
                  <div className="prose prose-sm max-w-none dark:prose-invert prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5">
                    <ReactMarkdown>{m.content}</ReactMarkdown>
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap">{m.content}</p>
                )}
              </div>
            </div>
          ))}
          {sending && (
            <div className="flex justify-start">
              <div className="rounded-2xl bg-muted px-4 py-2.5 text-sm flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> pensando...
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
        <div className="flex gap-2 items-end">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            rows={2}
            placeholder="Sua dúvida de implementação..."
            className="resize-none"
          />
          <Button onClick={() => send()} disabled={sending || !input.trim()} size="icon" className="shrink-0">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
