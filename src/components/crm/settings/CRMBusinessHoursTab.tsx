// Horário de trabalho da empresa (Configurações do CRM). Alimenta a função SQL
// crm_business_seconds_between(a, b), usada nos indicadores de atendimento
// (tempo de resposta em horas úteis). Sem linha salva, o banco assume seg a sex
// 08:00 às 18:00 (Brasília); feriados cadastrados não contam.
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Loader2, Plus, Trash2 } from "lucide-react";

type Dia = { weekday: number; is_open: boolean; open_time: string; close_time: string };
type Feriado = { id: string; date: string; name: string };

const DIAS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const PADRAO: Dia[] = [0, 1, 2, 3, 4, 5, 6].map((w) => ({
  weekday: w, is_open: w >= 1 && w <= 5, open_time: "08:00", close_time: "18:00",
}));
const hhmm = (v: string) => (v || "").slice(0, 5);

export function CRMBusinessHoursTab() {
  const [dias, setDias] = useState<Dia[]>(PADRAO);
  const [usandoPadrao, setUsandoPadrao] = useState(true);
  const [feriados, setFeriados] = useState<Feriado[]>([]);
  const [novoFeriado, setNovoFeriado] = useState({ date: "", name: "" });
  const [excluir, setExcluir] = useState<Feriado | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [ocupado, setOcupado] = useState(false);

  const carregar = useCallback(async () => {
    const [h, f] = await Promise.all([
      (supabase as any).from("crm_business_hours").select("weekday, is_open, open_time, close_time").order("weekday"),
      (supabase as any).from("crm_holidays").select("id, date, name").order("date"),
    ]);
    if (h.error) toast.error("Não consegui carregar o horário de trabalho");
    if (f.error) toast.error("Não consegui carregar os feriados");
    const rows = (h.data || []) as Dia[];
    if (rows.length) {
      setUsandoPadrao(false);
      setDias(PADRAO.map((p) => {
        const r = rows.find((x) => x.weekday === p.weekday);
        return r ? { ...r, open_time: hhmm(r.open_time), close_time: hhmm(r.close_time) } : { ...p, is_open: false };
      }));
    } else {
      setUsandoPadrao(true);
      setDias(PADRAO);
    }
    setFeriados((f.data || []) as Feriado[]);
    setCarregando(false);
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const alterar = (weekday: number, patch: Partial<Dia>) =>
    setDias((prev) => prev.map((d) => (d.weekday === weekday ? { ...d, ...patch } : d)));

  const salvarHorario = async () => {
    for (const d of dias) {
      if (d.is_open && (!d.open_time || !d.close_time || d.open_time >= d.close_time)) {
        toast.error(`${DIAS[d.weekday]}: a abertura precisa ser antes do fechamento`);
        return;
      }
    }
    setSalvando(true);
    const { error } = await (supabase as any).from("crm_business_hours").upsert(
      dias.map((d) => ({ weekday: d.weekday, is_open: d.is_open, open_time: d.open_time, close_time: d.close_time, updated_at: new Date().toISOString() })),
      { onConflict: "weekday" },
    );
    setSalvando(false);
    if (error) { toast.error(`Erro ao salvar: ${error.message}`); return; }
    toast.success("Horário de trabalho salvo");
    carregar();
  };

  const adicionarFeriado = async () => {
    const nome = novoFeriado.name.trim();
    if (!novoFeriado.date) { toast.error("Escolha a data do feriado"); return; }
    if (!nome) { toast.error("Digite o nome do feriado"); return; }
    if (feriados.some((f) => f.date === novoFeriado.date)) { toast.error("Já existe feriado nessa data"); return; }
    setOcupado(true);
    const { error } = await (supabase as any).from("crm_holidays").insert({ date: novoFeriado.date, name: nome });
    setOcupado(false);
    if (error) { toast.error(`Erro ao adicionar: ${error.message}`); return; }
    setNovoFeriado({ date: "", name: "" });
    toast.success("Feriado adicionado");
    carregar();
  };

  const confirmarExclusao = async () => {
    if (!excluir) return;
    setOcupado(true);
    const { error } = await (supabase as any).from("crm_holidays").delete().eq("id", excluir.id);
    setOcupado(false);
    if (error) { toast.error(`Erro ao excluir: ${error.message}`); return; }
    toast.success("Feriado removido");
    setExcluir(null);
    carregar();
  };

  if (carregando) {
    return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            Horário de trabalho
            {usandoPadrao && <Badge variant="outline" className="text-[10px]">usando o padrão</Badge>}
          </CardTitle>
          <CardDescription>
            Define o que conta como hora útil nos indicadores de atendimento (tempo de resposta, SLA).
            Horário de Brasília. Sem configuração salva, vale segunda a sexta das 08:00 às 18:00.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="divide-y divide-border rounded-md border">
            {dias.map((d) => (
              <div key={d.weekday} className="flex flex-wrap items-center gap-3 px-3 py-2">
                <Switch checked={d.is_open} onCheckedChange={(v) => alterar(d.weekday, { is_open: v })} title={d.is_open ? "Fechar" : "Abrir"} />
                <span className={`w-20 text-sm ${d.is_open ? "" : "text-muted-foreground"}`}>{DIAS[d.weekday]}</span>
                {d.is_open ? (
                  <div className="flex items-center gap-2 text-sm">
                    <Input type="time" step={900} value={d.open_time} onChange={(e) => alterar(d.weekday, { open_time: e.target.value })} className="h-8 w-[110px]" />
                    <span className="text-muted-foreground">às</span>
                    <Input type="time" step={900} value={d.close_time} onChange={(e) => alterar(d.weekday, { close_time: e.target.value })} className="h-8 w-[110px]" />
                  </div>
                ) : (
                  <span className="text-sm text-muted-foreground">Fechado</span>
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-end">
            <Button size="sm" onClick={salvarHorario} disabled={salvando}>
              {salvando && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar horário
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Feriados</CardTitle>
          <CardDescription>Dias que não contam como hora útil, mesmo caindo em dia aberto.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Input type="date" value={novoFeriado.date} onChange={(e) => setNovoFeriado((n) => ({ ...n, date: e.target.value }))} className="h-9 w-[160px]" />
            <Input
              value={novoFeriado.name}
              onChange={(e) => setNovoFeriado((n) => ({ ...n, name: e.target.value }))}
              onKeyDown={(e) => { if (e.key === "Enter") adicionarFeriado(); }}
              placeholder="Nome do feriado"
              className="h-9 max-w-xs"
            />
            <Button size="sm" onClick={adicionarFeriado} disabled={ocupado}><Plus className="h-4 w-4 mr-1" />Adicionar</Button>
          </div>
          {feriados.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">Nenhum feriado cadastrado.</p>
          ) : (
            <div className="divide-y divide-border rounded-md border">
              {feriados.map((f) => (
                <div key={f.id} className="flex items-center gap-3 px-3 py-2">
                  <span className="text-sm w-[150px]">{format(parseISO(f.date), "EEE, dd/MM/yyyy", { locale: ptBR })}</span>
                  <span className="text-sm flex-1 truncate">{f.name}</span>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setExcluir(f)} title="Remover">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!excluir} onOpenChange={(o) => { if (!o) setExcluir(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover feriado?</AlertDialogTitle>
            <AlertDialogDescription>
              {excluir ? `${format(parseISO(excluir.date), "dd/MM/yyyy")}, ${excluir.name}. O dia volta a contar como hora útil.` : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmarExclusao} disabled={ocupado} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Remover</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
