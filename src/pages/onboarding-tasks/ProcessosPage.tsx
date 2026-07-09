import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { MermaidDiagram } from "@/components/processos/MermaidDiagram";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  ArrowLeft, Search, BookOpen, Plus, Pencil, ChevronRight, DollarSign, RefreshCw, ImagePlus,
} from "lucide-react";
import { NexusHeader } from "@/components/onboarding-tasks/NexusHeader";

interface StaffProcess {
  id: string;
  title: string;
  slug: string;
  sector: string;
  roles: string[];
  summary: string | null;
  content: string;
  tags: string[];
  sort_order: number;
  is_active: boolean;
  updated_at: string;
}

interface CatalogService {
  id: string;
  name: string;
  price: number;
  billing_type: string;
  is_active: boolean;
}

interface DeliveryService {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
}

interface ProductStat {
  product_name: string;
  ativos: number;
  mediana: number | null;
}

const SECTOR_ORDER = [
  "Comercial",
  "Operações & Clientes",
  "Financeiro",
  "Marketing",
  "Pessoas & RH",
  "Eventos",
  "Produto & Tecnologia",
  "Diretoria",
];

const ROLE_LABELS: Record<string, string> = {
  master: "Diretoria",
  admin: "Admin",
  head_comercial: "Head Comercial",
  closer: "Closer",
  sdr: "SDR",
  bdr: "BDR",
  social_setter: "Social Setter",
  cs: "CS",
  consultant: "Consultor",
  financeiro: "Financeiro",
  rh: "RH",
  marketing: "Marketing",
};

const VALORES_TAB = "__valores__";

const normalize = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

const slugify = (s: string) =>
  normalize(s).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);

const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

const billingLabel = (t: string) =>
  t === "monthly" ? "/mês" : t === "one_time" ? " (único)" : ` (${t})`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const markdownComponents: any = {
  pre: (props: { children?: React.ReactNode } & Record<string, unknown>) => {
    const child = Array.isArray(props.children) ? props.children[0] : props.children;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const codeProps = (child as any)?.props;
    const className: string = codeProps?.className ?? "";
    if (className.includes("language-mermaid")) {
      return <MermaidDiagram code={String(codeProps.children ?? "")} />;
    }
    return <pre {...props} />;
  },
  img: (props: { src?: string; alt?: string }) => (
    <a href={props.src} target="_blank" rel="noopener noreferrer">
      <img
        src={props.src}
        alt={props.alt ?? ""}
        className="my-4 max-h-[480px] w-auto max-w-full rounded-lg border shadow-sm"
      />
    </a>
  ),
};

const emptyForm = {
  id: "",
  title: "",
  sector: SECTOR_ORDER[0],
  roles: [] as string[],
  summary: "",
  content: "",
  tags: "",
  is_active: true,
};

export default function ProcessosPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [isEditor, setIsEditor] = useState(false);
  const [processes, setProcesses] = useState<StaffProcess[]>([]);
  const [catalog, setCatalog] = useState<CatalogService[]>([]);
  const [delivery, setDelivery] = useState<DeliveryService[]>([]);
  const [productStats, setProductStats] = useState<ProductStat[]>([]);
  const [search, setSearch] = useState("");
  const [sector, setSector] = useState<string | null>(null);
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const contentRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const uploadImage = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Só imagens (PNG, JPG, WEBP, GIF)");
      return;
    }
    setUploading(true);
    const ext = file.name.split(".").pop()?.toLowerCase() || "png";
    const path = `${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("staff-processes").upload(path, file, {
      contentType: file.type,
      cacheControl: "31536000",
    });
    setUploading(false);
    if (error) {
      toast.error("Erro no upload: " + error.message);
      return;
    }
    const { data } = supabase.storage.from("staff-processes").getPublicUrl(path);
    const snippet = `\n![print](${data.publicUrl})\n`;
    const el = contentRef.current;
    setForm((f) => {
      if (el) {
        const pos = el.selectionStart ?? f.content.length;
        return { ...f, content: f.content.slice(0, pos) + snippet + f.content.slice(pos) };
      }
      return { ...f, content: f.content + snippet };
    });
    toast.success("Imagem inserida no conteúdo");
  };

  const selectedSlug = searchParams.get("p");
  const selected = processes.find((p) => p.slug === selectedSlug) ?? null;

  const loadAll = async () => {
    const [{ data: procs, error }, { data: cat }, { data: del }, { data: stats }] =
      await Promise.all([
        supabase
          .from("staff_processes")
          .select("id, title, slug, sector, roles, summary, content, tags, sort_order, is_active, updated_at")
          .order("sort_order")
          .order("title"),
        supabase
          .from("service_catalog")
          .select("id, name, price, billing_type, is_active")
          .is("tenant_id", null)
          .eq("is_active", true)
          .order("sort_order"),
        supabase
          .from("onboarding_services")
          .select("id, name, description, is_active")
          .eq("is_active", true)
          .order("name"),
        supabase.rpc("get_product_contract_stats"),
      ]);
    if (error) {
      toast.error("Erro ao carregar processos: " + error.message);
    }
    setProcesses((procs as StaffProcess[]) ?? []);
    setCatalog((cat as CatalogService[]) ?? []);
    setDelivery((del as DeliveryService[]) ?? []);
    setProductStats((stats as ProductStat[]) ?? []);
  };

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: staff } = await supabase
          .from("onboarding_staff")
          .select("role")
          .eq("user_id", user.id)
          .eq("is_active", true)
          .maybeSingle();
        setIsEditor(staff?.role === "master" || staff?.role === "admin");
      }
      await loadAll();
      setLoading(false);
    };
    init();
  }, []);

  const visibleProcesses = useMemo(() => {
    const q = normalize(search.trim());
    return processes.filter((p) => {
      if (!p.is_active && !isEditor) return false;
      if (sector && sector !== VALORES_TAB && p.sector !== sector) return false;
      if (roleFilter !== "all" && p.roles.length > 0 && !p.roles.includes(roleFilter)) return false;
      if (!q) return true;
      const haystack = normalize(
        `${p.title} ${p.summary ?? ""} ${p.content} ${p.tags.join(" ")} ${p.sector}`
      );
      return q.split(/\s+/).every((term) => haystack.includes(term));
    });
  }, [processes, search, sector, roleFilter, isEditor]);

  const sectors = useMemo(() => {
    const found = new Set(processes.map((p) => p.sector));
    const ordered = SECTOR_ORDER.filter((s) => found.has(s));
    const extras = [...found].filter((s) => !SECTOR_ORDER.includes(s)).sort();
    return [...ordered, ...extras];
  }, [processes]);

  const grouped = useMemo(() => {
    const map = new Map<string, StaffProcess[]>();
    for (const p of visibleProcesses) {
      if (!map.has(p.sector)) map.set(p.sector, []);
      map.get(p.sector)!.push(p);
    }
    return [...map.entries()].sort((a, b) => {
      const ia = SECTOR_ORDER.indexOf(a[0]);
      const ib = SECTOR_ORDER.indexOf(b[0]);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    });
  }, [visibleProcesses]);

  const openProcess = (slug: string | null) => {
    if (slug) setSearchParams({ p: slug });
    else setSearchParams({});
    window.scrollTo({ top: 0 });
  };

  const openCreate = () => {
    setForm({ ...emptyForm, sector: sector && sector !== VALORES_TAB ? sector : SECTOR_ORDER[0] });
    setDialogOpen(true);
  };

  const openEdit = (p: StaffProcess) => {
    setForm({
      id: p.id,
      title: p.title,
      sector: p.sector,
      roles: p.roles,
      summary: p.summary ?? "",
      content: p.content,
      tags: p.tags.join(", "),
      is_active: p.is_active,
    });
    setDialogOpen(true);
  };

  const saveProcess = async () => {
    if (!form.title.trim() || !form.content.trim()) {
      toast.error("Título e conteúdo são obrigatórios");
      return;
    }
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const payload = {
      title: form.title.trim(),
      sector: form.sector,
      roles: form.roles,
      summary: form.summary.trim() || null,
      content: form.content,
      tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
      is_active: form.is_active,
      updated_by: user?.id ?? null,
    };
    let error;
    if (form.id) {
      ({ error } = await supabase.from("staff_processes").update(payload).eq("id", form.id));
    } else {
      ({ error } = await supabase.from("staff_processes").insert({
        ...payload,
        slug: slugify(form.title),
        created_by: user?.id ?? null,
      }));
    }
    setSaving(false);
    if (error) {
      toast.error("Erro ao salvar: " + error.message);
      return;
    }
    toast.success(form.id ? "Processo atualizado" : "Processo criado");
    setDialogOpen(false);
    await loadAll();
  };

  const toggleRole = (role: string) => {
    setForm((f) => ({
      ...f,
      roles: f.roles.includes(role) ? f.roles.filter((r) => r !== role) : [...f.roles, role],
    }));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-4 min-w-0">
            <Button variant="ghost" size="icon" className="shrink-0" onClick={() => navigate("/onboarding-tasks")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <NexusHeader title="Manual de Processos" />
          </div>
          {isEditor && (
            <Button size="sm" onClick={openCreate} className="gap-1 sm:gap-2 text-xs sm:text-sm">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Novo Processo</span>
            </Button>
          )}
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-5xl">
        {selected ? (
          /* ── Detalhe do processo ─────────────────────── */
          <article>
            <Button variant="ghost" size="sm" className="mb-4 gap-1 -ml-2" onClick={() => openProcess(null)}>
              <ArrowLeft className="h-4 w-4" /> Todos os processos
            </Button>
            <div className="flex items-start justify-between gap-4 mb-2">
              <h1 className="text-2xl sm:text-3xl font-bold">{selected.title}</h1>
              {isEditor && (
                <Button variant="outline" size="sm" className="gap-1 shrink-0" onClick={() => openEdit(selected)}>
                  <Pencil className="h-4 w-4" /> Editar
                </Button>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2 mb-6">
              <Badge variant="secondary">{selected.sector}</Badge>
              {(selected.roles.length ? selected.roles : []).map((r) => (
                <Badge key={r} variant="outline">{ROLE_LABELS[r] ?? r}</Badge>
              ))}
              {selected.roles.length === 0 && <Badge variant="outline">Todos os cargos</Badge>}
              {!selected.is_active && <Badge variant="destructive">Inativo</Badge>}
              <span className="text-xs text-muted-foreground ml-auto">
                Atualizado em {new Date(selected.updated_at).toLocaleDateString("pt-BR")}
              </span>
            </div>
            <div className="prose prose-sm sm:prose-base dark:prose-invert max-w-none prose-table:text-sm prose-th:text-left">
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                {selected.content}
              </ReactMarkdown>
            </div>
          </article>
        ) : (
          <>
            {/* ── Busca ───────────────────────────────────── */}
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar processo... (ex: cancelamento, proposta, cobrança, evento)"
                className="pl-10 h-12 text-base"
              />
            </div>

            {/* ── Filtros ─────────────────────────────────── */}
            <div className="flex flex-wrap items-center gap-2 mb-6">
              <Badge
                variant={sector === null ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => setSector(null)}
              >
                Todos
              </Badge>
              {sectors.map((s) => (
                <Badge
                  key={s}
                  variant={sector === s ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => setSector(sector === s ? null : s)}
                >
                  {s}
                </Badge>
              ))}
              <Badge
                variant={sector === VALORES_TAB ? "default" : "outline"}
                className="cursor-pointer gap-1"
                onClick={() => setSector(sector === VALORES_TAB ? null : VALORES_TAB)}
              >
                <DollarSign className="h-3 w-3" /> Produtos & Valores
              </Badge>
              <div className="ml-auto">
                <Select value={roleFilter} onValueChange={setRoleFilter}>
                  <SelectTrigger className="w-[170px] h-8 text-xs">
                    <SelectValue placeholder="Cargo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os cargos</SelectItem>
                    {Object.entries(ROLE_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {sector === VALORES_TAB ? (
              /* ── Produtos & Valores (vivo, direto do sistema) ── */
              <div className="space-y-6">
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <RefreshCw className="h-4 w-4" />
                  Dados puxados do sistema em tempo real — não existe planilha de preço paralela.
                  Valor errado aqui = cadastro errado no Nexus: corrija na origem.
                </p>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">Contratos ativos por produto</CardTitle>
                    <CardDescription>
                      Contagem e mediana dos valores de contrato dos projetos ativos no Nexus.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="overflow-x-auto">
                    {productStats.length > 0 && (
                      <div className="mb-6 h-56 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={productStats} margin={{ top: 4, right: 8, left: -16, bottom: 32 }}>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                            <XAxis
                              dataKey="product_name"
                              angle={-28}
                              textAnchor="end"
                              interval={0}
                              tick={{ fontSize: 11 }}
                              height={56}
                            />
                            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                            <RechartsTooltip
                              formatter={(value: number) => [`${value} clientes`, "Ativos"]}
                              labelClassName="font-medium"
                            />
                            <Bar dataKey="ativos" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} maxBarSize={48} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-muted-foreground">
                          <th className="py-2 pr-4 font-medium">Produto</th>
                          <th className="py-2 pr-4 font-medium text-right">Clientes ativos</th>
                          <th className="py-2 font-medium text-right">Mediana do contrato</th>
                        </tr>
                      </thead>
                      <tbody>
                        {productStats.map((s) => (
                          <tr key={s.product_name} className="border-b last:border-0">
                            <td className="py-2 pr-4 font-medium">{s.product_name}</td>
                            <td className="py-2 pr-4 text-right">{s.ativos}</td>
                            <td className="py-2 text-right">
                              {s.mediana != null ? brl(Number(s.mediana)) : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">Catálogo de serviços (autoatendimento)</CardTitle>
                    <CardDescription>Preços vigentes do catálogo — o que o cliente contrata direto no portal.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid sm:grid-cols-2 gap-2">
                      {catalog.map((c) => (
                        <div key={c.id} className="flex items-center justify-between rounded-md border px-3 py-2">
                          <span className="text-sm">{c.name}</span>
                          <span className="text-sm font-semibold whitespace-nowrap">
                            {brl(Number(c.price))}
                            <span className="text-muted-foreground font-normal">{billingLabel(c.billing_type)}</span>
                          </span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">Serviços de entrega</CardTitle>
                    <CardDescription>Tipos de serviço que a operação entrega hoje (base dos projetos de onboarding).</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {delivery.map((d) => (
                        <Badge key={d.id} variant="secondary" title={d.description ?? undefined}>
                          {d.name}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : visibleProcesses.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <BookOpen className="h-10 w-10 mx-auto mb-3 opacity-40" />
                <p>Nenhum processo encontrado{search ? ` para "${search}"` : ""}.</p>
                {isEditor && (
                  <Button variant="outline" size="sm" className="mt-4 gap-1" onClick={openCreate}>
                    <Plus className="h-4 w-4" /> Criar processo
                  </Button>
                )}
              </div>
            ) : (
              /* ── Lista agrupada por setor ────────────────── */
              <div className="space-y-8">
                {grouped.map(([sectorName, procs]) => (
                  <section key={sectorName}>
                    <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                      {sectorName}
                    </h2>
                    <div className="grid sm:grid-cols-2 gap-3">
                      {procs.map((p) => (
                        <Card
                          key={p.id}
                          className={`cursor-pointer hover:border-primary/50 transition-colors ${!p.is_active ? "opacity-50" : ""}`}
                          onClick={() => openProcess(p.slug)}
                        >
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <h3 className="font-semibold leading-snug">{p.title}</h3>
                                {p.summary && (
                                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{p.summary}</p>
                                )}
                                <div className="flex flex-wrap gap-1 mt-2">
                                  {(p.roles.length ? p.roles : []).slice(0, 4).map((r) => (
                                    <Badge key={r} variant="outline" className="text-[10px] px-1.5 py-0">
                                      {ROLE_LABELS[r] ?? r}
                                    </Badge>
                                  ))}
                                  {p.roles.length === 0 && (
                                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">Todos</Badge>
                                  )}
                                </div>
                              </div>
                              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </>
        )}
      </main>

      {/* ── Editor (master/admin) ───────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{form.id ? "Editar processo" : "Novo processo"}</DialogTitle>
            <DialogDescription>Conteúdo em markdown. Visível pra todo o staff da UNV.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Título</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Setor</Label>
                <Select value={form.sector} onValueChange={(v) => setForm({ ...form, sector: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[...new Set([...SECTOR_ORDER, ...sectors])].map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Tags (separadas por vírgula)</Label>
                <Input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Cargos (vazio = todos)</Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {Object.entries(ROLE_LABELS).map(([k, v]) => (
                  <label key={k} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox checked={form.roles.includes(k)} onCheckedChange={() => toggleRole(k)} />
                    {v}
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Resumo (uma linha, aparece no card)</Label>
              <Input value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>Conteúdo (markdown — suporta tabelas, checklists, imagens e diagramas mermaid)</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1 text-xs"
                  disabled={uploading}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <ImagePlus className="h-3.5 w-3.5" />
                  {uploading ? "Enviando..." : "Imagem"}
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) uploadImage(f);
                    e.target.value = "";
                  }}
                />
              </div>
              <Textarea
                ref={contentRef}
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
                onPaste={(e) => {
                  const img = [...e.clipboardData.items].find((i) => i.type.startsWith("image/"));
                  if (img) {
                    e.preventDefault();
                    const f = img.getAsFile();
                    if (f) uploadImage(f);
                  }
                }}
                rows={16}
                className="font-mono text-sm"
                placeholder="Cole um print direto aqui (Cmd+V) que ele vira imagem no processo."
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
              Ativo (visível pro time)
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={saveProcess} disabled={saving}>
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
