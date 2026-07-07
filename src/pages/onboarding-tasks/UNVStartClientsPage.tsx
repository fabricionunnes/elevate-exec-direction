import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ArrowLeft,
  LogOut,
  Search,
  Rocket,
  CheckCircle2,
  Circle,
  Clock,
  Download,
  ChevronDown,
  ChevronRight,
  Users,
  Trophy,
} from "lucide-react";
import { NexusHeader } from "@/components/onboarding-tasks/NexusHeader";

const NAVY = "#0D2B5E";

const DOCS: { step: number; label: string }[] = [
  { step: 1, label: "Raio-X Comercial" },
  { step: 2, label: "ICP e Proposta de Valor" },
  { step: 3, label: "Funil de Vendas" },
  { step: 4, label: "Script de Vendas" },
  { step: 5, label: "Playbook Comercial" },
  { step: 6, label: "Processos Comerciais" },
  { step: 7, label: "Metas e Calendário Comercial" },
];

interface Member {
  id: string;
  name: string;
  email: string;
  whatsapp: string | null;
  company_name: string | null;
  segment: string | null;
  payment_status: string;
  created_at: string;
  access_token: string;
}

interface Deliverable {
  id: string;
  member_id: string;
  step: number;
  module_type: string;
  status: string;
  updated_at: string;
}

const UNVStartClientsPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [delivsByMember, setDelivsByMember] = useState<Record<string, Deliverable[]>>({});
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);

  useEffect(() => {
    checkAccess();
  }, []);

  const checkAccess = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/onboarding-tasks/login");
        return;
      }
      const { data: staff } = await supabase
        .from("onboarding_staff")
        .select("role")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .maybeSingle();
      if (!staff || !["master", "admin", "cs"].includes(staff.role)) {
        navigate("/onboarding-tasks");
        return;
      }
      setIsAdmin(true);
      await loadData();
    } catch (e) {
      console.error(e);
      navigate("/onboarding-tasks");
    } finally {
      setLoading(false);
    }
  };

  const loadData = async () => {
    const [mRes, dRes] = await Promise.all([
      supabase
        .from("unv_start_members")
        .select("id,name,email,whatsapp,company_name,segment,payment_status,created_at,access_token")
        .order("created_at", { ascending: false }),
      supabase
        .from("unv_start_deliverables")
        .select("id,member_id,step,module_type,status,updated_at"),
    ]);
    if (mRes.error) {
      toast.error("Erro ao carregar clientes");
      return;
    }
    setMembers((mRes.data || []) as Member[]);
    const grouped: Record<string, Deliverable[]> = {};
    for (const d of (dRes.data || []) as Deliverable[]) {
      (grouped[d.member_id] = grouped[d.member_id] || []).push(d);
    }
    setDelivsByMember(grouped);
  };

  // conta quantos dos 7 documentos estão finalizados
  const finalStepsOf = (memberId: string): Set<number> => {
    const set = new Set<number>();
    for (const d of delivsByMember[memberId] || []) {
      if (d.status === "final" && d.step >= 1 && d.step <= 7) set.add(d.step);
    }
    return set;
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return members;
    return members.filter((m) =>
      [m.name, m.company_name, m.email, m.whatsapp]
        .filter(Boolean)
        .some((v) => (v as string).toLowerCase().includes(q)),
    );
  }, [members, search]);

  const stats = useMemo(() => {
    const total = members.length;
    const paid = members.filter((m) => m.payment_status === "paid").length;
    const progresses = members.map((m) => finalStepsOf(m.id).size);
    const completed = progresses.filter((p) => p >= 7).length;
    const avg = total ? Math.round((progresses.reduce((a, b) => a + b, 0) / total / 7) * 100) : 0;
    return { total, paid, completed, avg };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [members, delivsByMember]);

  const download = async (member: Member, deliverableId: string) => {
    setDownloading(deliverableId);
    try {
      const { data, error } = await supabase.functions.invoke("unv-start-engine", {
        body: { action: "download_url", token: member.access_token, deliverable_id: deliverableId },
      });
      if (error || !data?.url) throw new Error("indisponível");
      window.open(data.url, "_blank");
    } catch {
      toast.error("Não foi possível abrir o PDF (o cliente pode não ter finalizado esse documento).");
    } finally {
      setDownloading(null);
    }
  };

  const paymentBadge = (status: string) => {
    if (status === "paid") return <Badge className="bg-green-600 hover:bg-green-600 text-white">Pago</Badge>;
    if (status === "pending") return <Badge className="bg-amber-500 hover:bg-amber-500 text-white">Pendente</Badge>;
    return <Badge variant="secondary">{status}</Badge>;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }
  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3 min-w-0">
            <Button variant="ghost" size="icon" onClick={() => navigate("/onboarding-tasks")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2 min-w-0">
              <Rocket className="h-5 w-5 shrink-0" style={{ color: NAVY }} />
              <NexusHeader title="UNV Start — Clientes" />
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={async () => {
              await supabase.auth.signOut();
              navigate("/onboarding-tasks/login");
            }}
            title="Sair"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>

        {/* Resumo */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                <Users className="h-3.5 w-3.5" /> Compradores
              </div>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                <CheckCircle2 className="h-3.5 w-3.5" /> Pagos
              </div>
              <div className="text-2xl font-bold">{stats.paid}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                <Trophy className="h-3.5 w-3.5" /> Estrutura completa
              </div>
              <div className="text-2xl font-bold">{stats.completed}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-muted-foreground text-xs mb-1">Progresso médio</div>
              <div className="text-2xl font-bold">{stats.avg}%</div>
            </CardContent>
          </Card>
        </div>

        {/* Busca */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, empresa, email ou WhatsApp"
            className="pl-9"
          />
        </div>

        {/* Lista */}
        {filtered.length === 0 ? (
          <p className="text-center text-muted-foreground py-12">Nenhum cliente encontrado.</p>
        ) : (
          <div className="space-y-2">
            {filtered.map((m) => {
              const finals = finalStepsOf(m.id);
              const done = finals.size;
              const isOpen = expanded === m.id;
              const delivs = delivsByMember[m.id] || [];
              return (
                <Card key={m.id} className="overflow-hidden">
                  <button
                    className="w-full text-left p-4 flex items-center gap-3 hover:bg-muted/40 transition-colors"
                    onClick={() => setExpanded(isOpen ? null : m.id)}
                  >
                    {isOpen ? (
                      <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold truncate">
                          {m.company_name || m.name}
                        </span>
                        {paymentBadge(m.payment_status)}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {m.company_name ? `${m.name} · ` : ""}
                        {m.email}
                        {m.whatsapp ? ` · ${m.whatsapp}` : ""}
                        {` · ${format(new Date(m.created_at), "dd/MM/yyyy", { locale: ptBR })}`}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-sm font-semibold" style={{ color: NAVY }}>
                        {done}/7
                      </div>
                      <div className="w-24 h-1.5 rounded-full bg-muted mt-1 overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${(done / 7) * 100}%`, background: NAVY }}
                        />
                      </div>
                    </div>
                  </button>

                  {isOpen && (
                    <div className="border-t px-4 py-3 space-y-1.5 bg-muted/20">
                      {DOCS.map((doc) => {
                        const d = delivs.find((x) => x.step === doc.step);
                        const isFinal = d?.status === "final";
                        const isDraft = d?.status === "draft";
                        return (
                          <div key={doc.step} className="flex items-center gap-2 text-sm">
                            {isFinal ? (
                              <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                            ) : isDraft ? (
                              <Clock className="h-4 w-4 text-amber-500 shrink-0" />
                            ) : (
                              <Circle className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                            )}
                            <span className={isFinal ? "" : "text-muted-foreground"}>
                              {doc.step}. {doc.label}
                            </span>
                            <span className="ml-auto flex items-center gap-2">
                              {isFinal && d && (
                                <>
                                  <span className="text-xs text-muted-foreground hidden sm:inline">
                                    {format(new Date(d.updated_at), "dd/MM/yy", { locale: ptBR })}
                                  </span>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 px-2"
                                    disabled={downloading === d.id}
                                    onClick={() => download(m, d.id)}
                                  >
                                    <Download className="h-3.5 w-3.5" />
                                  </Button>
                                </>
                              )}
                              {isDraft && (
                                <span className="text-xs text-amber-600">rascunho</span>
                              )}
                              {!d && (
                                <span className="text-xs text-muted-foreground/60">não iniciado</span>
                              )}
                            </span>
                          </div>
                        );
                      })}
                      {/* Book */}
                      {delivs.some((x) => x.module_type === "book" && x.status === "final") && (
                        <div className="flex items-center gap-2 text-sm pt-1 mt-1 border-t">
                          <Trophy className="h-4 w-4 text-green-600 shrink-0" />
                          <span className="font-medium">Book da Estrutura (compilado)</span>
                          <span className="ml-auto">
                            {(() => {
                              const book = delivs.find(
                                (x) => x.module_type === "book" && x.status === "final",
                              );
                              return book ? (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 px-2"
                                  disabled={downloading === book.id}
                                  onClick={() => download(m, book.id)}
                                >
                                  <Download className="h-3.5 w-3.5" />
                                </Button>
                              ) : null;
                            })()}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default UNVStartClientsPage;
