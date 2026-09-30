// Peças comuns dos dashboards de Atendimento, Atividades e Negócios (benchmark Datacrazy,
// 30/09/2026): filtro de período (presets + intervalo livre), cards de KPI, moldura de
// gráfico, diálogo de exportação pra Excel e lista de staff pros filtros.
import { useEffect, useState, type ReactElement } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SearchableSelect } from "@/components/crm/traffic/SearchableSelect";
import { CalendarIcon, Download } from "lucide-react";
import { ResponsiveContainer } from "recharts";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { exportarXlsx } from "@/lib/exportXlsx";
import { toast } from "sonner";

export const C = { azul: "#2a78d6", verde: "#1baf7a", violeta: "#4a3aa7", amarelo: "#eda100", vermelho: "#d4321c", laranja: "#eb6834", cinza: "#6b7280" };
export const SERIES = [C.azul, C.verde, C.violeta, C.amarelo, C.laranja, "#e87ba4", "#008300", "#666"];
export const tipStyle = { fontSize: 12, borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--popover))", color: "hsl(var(--popover-foreground))" };
export const n = (v: unknown) => Number(v || 0);
export const pct = (a: number, b: number) => (b > 0 ? `${Math.round((a / b) * 100)}%` : "-");
export const diaCurto = (s: string) => { const [, m, d] = String(s).split("-"); return `${d}/${m}`; };
export const DOW = ["", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
export const moeda = (v: unknown) => n(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
export const dataHora = (v: string | null | undefined) =>
  v ? new Date(v).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "-";

// ------------------------------------------------------------------ período
export type PeriodoKey = "7" | "30" | "90" | "mes" | "mes_passado" | "custom";
export const PERIODOS: { value: PeriodoKey; label: string }[] = [
  { value: "7", label: "Últimos 7 dias" }, { value: "30", label: "Últimos 30 dias" }, { value: "90", label: "Últimos 90 dias" },
  { value: "mes", label: "Este mês" }, { value: "mes_passado", label: "Mês passado" }, { value: "custom", label: "Intervalo" },
];

export interface Periodo { key: PeriodoKey; from?: Date; to?: Date }

/** Intervalo [from, to) e o texto que aparece no título. */
export function intervalo(p: Periodo): { from: Date; to: Date; texto: string } {
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const amanha = new Date(hoje); amanha.setDate(amanha.getDate() + 1);
  if (p.key === "custom") {
    const from = p.from ? new Date(p.from) : new Date(hoje.getTime() - 29 * 86400000);
    from.setHours(0, 0, 0, 0);
    const to = p.to ? new Date(p.to) : hoje;
    to.setHours(0, 0, 0, 0); to.setDate(to.getDate() + 1);
    return { from, to, texto: `${format(from, "dd/MM/yy")} a ${format(new Date(to.getTime() - 1), "dd/MM/yy")}` };
  }
  if (p.key === "mes") return { from: new Date(hoje.getFullYear(), hoje.getMonth(), 1), to: amanha, texto: "este mês" };
  if (p.key === "mes_passado") return { from: new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1), to: new Date(hoje.getFullYear(), hoje.getMonth(), 1), texto: "mês passado" };
  const from = new Date(hoje); from.setDate(from.getDate() - (Number(p.key) - 1));
  return { from, to: amanha, texto: `últimos ${p.key} dias` };
}

/** Seletor de período: presets pesquisáveis e, no "Intervalo", dois calendários. */
export function PeriodoFiltro({ value, onChange }: { value: Periodo; onChange: (p: Periodo) => void }) {
  const Dia = ({ d, label, onPick }: { d?: Date; label: string; onPick: (d?: Date) => void }) => (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className={cn("h-9 w-[118px] justify-start text-left text-xs", !d && "text-muted-foreground")}>
          <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
          {d ? format(d, "dd/MM/yy") : label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={d} onSelect={onPick} initialFocus locale={ptBR} /></PopoverContent>
    </Popover>
  );
  return (
    <div className="flex items-center gap-2">
      <div className="w-[160px]"><SearchableSelect value={value.key} onChange={(v) => onChange({ ...value, key: v as PeriodoKey })} options={PERIODOS} /></div>
      {value.key === "custom" && (
        <>
          <Dia d={value.from} label="De" onPick={(d) => onChange({ ...value, from: d })} />
          <Dia d={value.to} label="Até" onPick={(d) => onChange({ ...value, to: d })} />
        </>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ visual
export function Kpi({ label, valor, sub, cor, destaque }: { label: string; valor: string; sub?: string; cor: string; destaque?: boolean }) {
  return (
    <Card className="overflow-hidden relative">
      <div className="absolute inset-x-0 top-0 h-1" style={{ background: `linear-gradient(90deg, ${cor}, ${cor}55)` }} />
      <CardContent className="p-3 pt-4">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className={`font-semibold ${destaque ? "text-2xl" : "text-xl"}`} style={{ color: cor }}>{valor}</p>
        {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  );
}

export function Grafico({ titulo, subtitulo, children, altura = 260 }: { titulo: string; subtitulo?: string; children: ReactElement; altura?: number }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-sm font-medium">{titulo}</p>
        {subtitulo && <p className="text-xs text-muted-foreground mb-2">{subtitulo}</p>}
        <div style={{ height: altura }} className="mt-2">
          <ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

// ------------------------------------------------------------------ exportação
export interface BlocoDashboard { chave: string; rotulo: string; linhas: Record<string, unknown>[] }

/** Diálogo de exportação: escolhe os blocos que vão pra planilha (um por aba). */
export function ExportarDialog({ open, onOpenChange, blocos, nomeArquivo }: {
  open: boolean; onOpenChange: (v: boolean) => void; nomeArquivo: string; blocos: BlocoDashboard[];
}) {
  const [sel, setSel] = useState<string[]>([]);
  useEffect(() => { if (open) setSel(blocos.filter((b) => b.linhas.length).map((b) => b.chave)); }, [open, blocos]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Exportar pra Excel</DialogTitle>
          <DialogDescription>Escolha o que vai na planilha. Cada bloco vira uma aba.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <button type="button" className="text-xs text-primary underline" onClick={() => setSel(sel.length === blocos.length ? [] : blocos.map((b) => b.chave))}>
            {sel.length === blocos.length ? "Limpar" : "Marcar todos"}
          </button>
          {blocos.map((b) => (
            <label key={b.chave} className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox checked={sel.includes(b.chave)} onCheckedChange={(v) => setSel(v ? [...sel, b.chave] : sel.filter((x) => x !== b.chave))} />
              <span className="flex-1">{b.rotulo}</span>
              <span className="text-xs text-muted-foreground tabular-nums">{b.linhas.length} linha(s)</span>
            </label>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button disabled={!sel.length} onClick={() => {
            exportarXlsx(nomeArquivo, blocos.filter((b) => sel.includes(b.chave)).map((b) => ({ aba: b.rotulo, linhas: b.linhas })));
            toast.success("Planilha gerada");
            onOpenChange(false);
          }}><Download className="h-4 w-4 mr-1.5" /> Exportar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ------------------------------------------------------------------ staff
export interface StaffOpcao { id: string; name: string; role: string | null }

/** Staff ativo da UNV, pra filtros de atendente/responsável/dono. */
export function useStaffOptions() {
  const [staff, setStaff] = useState<StaffOpcao[]>([]);
  useEffect(() => {
    let vivo = true;
    supabase.from("onboarding_staff").select("id, name, role").eq("is_active", true).order("name")
      .then(({ data }) => { if (vivo) setStaff((data || []) as StaffOpcao[]); });
    return () => { vivo = false; };
  }, []);
  return staff;
}

/** Cabeçalho de coluna ordenável das tabelas dos dashboards. */
export function ThOrdenavel({ label, chave, sort, onSort, alinhar = "left" }: {
  label: string; chave: string; sort: { key: string; dir: "asc" | "desc" }; onSort: (k: string) => void; alinhar?: "left" | "right";
}) {
  const ativo = sort.key === chave;
  return (
    <th className={`font-medium py-1.5 cursor-pointer select-none whitespace-nowrap ${alinhar === "right" ? "text-right" : "text-left"} ${ativo ? "text-foreground" : ""}`}
      onClick={() => onSort(chave)} title="Clique pra ordenar">
      {label}{ativo ? (sort.dir === "asc" ? " ↑" : " ↓") : ""}
    </th>
  );
}
