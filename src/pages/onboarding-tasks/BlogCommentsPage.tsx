import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Loader2, RefreshCw, MessageSquare, Check, Trash2, Undo2, ExternalLink, Reply, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

type Status = "pendente" | "aprovado" | "removido";

interface Comentario {
  id: string;
  post_slug: string;
  nome: string;
  email: string | null;
  empresa: string | null;
  texto: string;
  status: Status;
  resposta: string | null;
  created_at: string;
  moderado_em: string | null;
}

const FN = "blog-comments";

export default function BlogCommentsPage() {
  const navigate = useNavigate();
  const [aba, setAba] = useState<Status | "todos">("pendente");
  const [itens, setItens] = useState<Comentario[]>([]);
  const [resumo, setResumo] = useState<Record<string, number>>({ pendente: 0, aprovado: 0, removido: 0 });
  const [carregando, setCarregando] = useState(true);
  const [semPermissao, setSemPermissao] = useState(false);
  const [respondendo, setRespondendo] = useState<string | null>(null);
  const [rascunho, setRascunho] = useState("");
  const [salvando, setSalvando] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    const { data, error } = await supabase.functions.invoke(FN, { body: { acao: "fila", status: aba } });
    setCarregando(false);
    if (error || data?.erro) {
      if ((data?.erro ?? "").includes("permissão")) { setSemPermissao(true); return; }
      toast.error(data?.erro ?? "Não foi possível carregar os comentários.");
      return;
    }
    setItens(data.comentarios ?? []);
    setResumo(data.resumo ?? {});
  }, [aba]);

  useEffect(() => { carregar(); }, [carregar]);

  const moderar = async (id: string, status: Status) => {
    setSalvando(id);
    const { data, error } = await supabase.functions.invoke(FN, { body: { acao: "moderar", id, status } });
    setSalvando(null);
    if (error || data?.erro) { toast.error(data?.erro ?? "Erro ao moderar."); return; }
    toast.success(status === "aprovado" ? "Comentário aprovado. Já aparece no site." : status === "removido" ? "Comentário removido." : "Voltou para pendente.");
    carregar();
  };

  const responder = async (id: string) => {
    setSalvando(id);
    const { data, error } = await supabase.functions.invoke(FN, { body: { acao: "responder", id, resposta: rascunho } });
    setSalvando(null);
    if (error || data?.erro) { toast.error(data?.erro ?? "Erro ao salvar resposta."); return; }
    toast.success("Resposta salva. Ela aparece embaixo do comentário no post.");
    setRespondendo(null); setRascunho("");
    carregar();
  };

  if (semPermissao) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="text-center max-w-md">
          <ShieldAlert className="h-10 w-10 mx-auto mb-4 text-muted-foreground" />
          <h1 className="text-xl font-semibold mb-2">Sem permissão</h1>
          <p className="text-muted-foreground mb-6">A moderação de comentários é restrita a perfis admin e master.</p>
          <Button variant="outline" onClick={() => navigate("/onboarding-tasks")}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
          </Button>
        </div>
      </div>
    );
  }

  const abas: Array<{ k: Status | "todos"; label: string; n?: number }> = [
    { k: "pendente", label: "Pendentes", n: resumo.pendente },
    { k: "aprovado", label: "Aprovados", n: resumo.aprovado },
    { k: "removido", label: "Removidos", n: resumo.removido },
    { k: "todos", label: "Todos" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto p-4 sm:p-6">
        <div className="flex items-center gap-3 mb-6 flex-wrap">
          <Button variant="ghost" size="sm" onClick={() => navigate("/onboarding-tasks")}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
          </Button>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <MessageSquare className="h-6 w-6" /> Comentários do Blog
          </h1>
          <Button variant="outline" size="sm" className="ml-auto" onClick={carregar} disabled={carregando}>
            <RefreshCw className={`h-4 w-4 mr-2 ${carregando ? "animate-spin" : ""}`} /> Atualizar
          </Button>
        </div>

        <p className="text-sm text-muted-foreground mb-5">
          Comentário só aparece no site depois de aprovado aqui. A sua resposta entra logo abaixo dele, marcada com o seu nome.
        </p>

        <div className="flex gap-2 mb-6 flex-wrap">
          {abas.map((a) => (
            <Button key={a.k} size="sm" variant={aba === a.k ? "default" : "outline"} onClick={() => setAba(a.k)}>
              {a.label}{typeof a.n === "number" && a.n > 0 ? ` (${a.n})` : ""}
            </Button>
          ))}
        </div>

        {carregando ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando
          </div>
        ) : itens.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            {aba === "pendente" ? "Nenhum comentário esperando aprovação." : "Nada por aqui."}
          </div>
        ) : (
          <div className="space-y-3">
            {itens.map((c) => (
              <div key={c.id} className="border rounded-lg p-4 bg-card">
                <div className="flex items-start gap-3 flex-wrap mb-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold">{c.nome}</span>
                      {c.empresa && <span className="text-sm text-muted-foreground">{c.empresa}</span>}
                      <Badge variant={c.status === "aprovado" ? "default" : c.status === "removido" ? "destructive" : "secondary"}>
                        {c.status}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {new Date(c.created_at).toLocaleString("pt-BR")}
                      {c.email && <> · {c.email}</>}
                    </div>
                  </div>
                  <a
                    href={`https://unvholdings.com.br/blog/${c.post_slug}/`}
                    target="_blank" rel="noreferrer"
                    className="ml-auto text-xs text-muted-foreground hover:underline flex items-center gap-1"
                  >
                    {c.post_slug} <ExternalLink className="h-3 w-3" />
                  </a>
                </div>

                <p className="text-sm whitespace-pre-wrap mb-3">{c.texto}</p>

                {c.resposta && (
                  <div className="text-sm bg-muted/60 border-l-2 border-primary pl-3 py-2 mb-3">
                    <div className="text-xs font-semibold text-primary mb-1">Sua resposta</div>
                    <p className="whitespace-pre-wrap">{c.resposta}</p>
                  </div>
                )}

                {respondendo === c.id ? (
                  <div className="space-y-2">
                    <Textarea
                      value={rascunho} onChange={(e) => setRascunho(e.target.value)}
                      placeholder="Sua resposta aparece embaixo do comentário, no post."
                      className="min-h-[90px]"
                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => responder(c.id)} disabled={salvando === c.id}>
                        {salvando === c.id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar resposta"}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => { setRespondendo(null); setRascunho(""); }}>Cancelar</Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2 flex-wrap">
                    {c.status !== "aprovado" && (
                      <Button size="sm" onClick={() => moderar(c.id, "aprovado")} disabled={salvando === c.id}>
                        <Check className="h-4 w-4 mr-1" /> Aprovar
                      </Button>
                    )}
                    {c.status !== "removido" && (
                      <Button size="sm" variant="destructive" onClick={() => moderar(c.id, "removido")} disabled={salvando === c.id}>
                        <Trash2 className="h-4 w-4 mr-1" /> Remover
                      </Button>
                    )}
                    {c.status !== "pendente" && (
                      <Button size="sm" variant="outline" onClick={() => moderar(c.id, "pendente")} disabled={salvando === c.id}>
                        <Undo2 className="h-4 w-4 mr-1" /> Voltar p/ pendente
                      </Button>
                    )}
                    <Button size="sm" variant="outline" onClick={() => { setRespondendo(c.id); setRascunho(c.resposta ?? ""); }}>
                      <Reply className="h-4 w-4 mr-1" /> {c.resposta ? "Editar resposta" : "Responder"}
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
