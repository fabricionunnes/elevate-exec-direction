import { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface TableLead {
  id: string;
  name: string;
  phone: string | null;
  stage_id: string;
  owner_staff_id: string | null;
  opportunity_value: number | null;
  last_activity_at: string | null;
  created_at: string;
  closed_at?: string | null;
  stage_entered_at?: string | null;
  origin?: { name: string } | null;
  owner?: { name: string } | null;
  tags?: { tag: { id: string; name: string; color: string } }[];
}

interface TableStage {
  id: string;
  name: string;
  color: string;
  sort_order: number;
  final_type: string | null;
}

interface KanbanTableViewProps {
  leads: TableLead[];
  stages: TableStage[];
  selectedLeads: string[];
  isMaster: boolean;
  onSelectLead: (leadId: string, selected: boolean) => void;
  onSelectMany: (leadIds: string[], selected: boolean) => void;
}

type SortKey = "name" | "phone" | "stage" | "owner" | "value" | "origin" | "open_days" | "stage_days" | "last_activity" | "tags";

const PAGE = 100;
const DAY = 86400000;

const daysSince = (iso: string | null | undefined, until?: string | null) => {
  if (!iso) return null;
  const end = until ? new Date(until).getTime() : Date.now();
  return Math.max(0, Math.floor((end - new Date(iso).getTime()) / DAY));
};

const formatCurrency = (value: number | null) =>
  value ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 }).format(value) : "";

/**
 * Mesmo funil em formato de tabela: mesmos dados e filtros do kanban, ordenável por
 * coluna, com a mesma seleção múltipla (a barra de ações em massa é a do kanban).
 */
export const KanbanTableView = ({ leads, stages, selectedLeads, isMaster, onSelectLead, onSelectMany }: KanbanTableViewProps) => {
  const navigate = useNavigate();
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "open_days", dir: "desc" });
  const [visible, setVisible] = useState(PAGE);

  useEffect(() => {
    setVisible(PAGE);
  }, [leads.length, sort]);

  const stageById = useMemo(() => new Map(stages.map((s) => [s.id, s])), [stages]);

  const rows = useMemo(() => {
    const enriched = leads.map((l) => {
      const st = stageById.get(l.stage_id);
      const closed = st?.final_type === "won" || st?.final_type === "lost";
      return {
        lead: l,
        stageName: st?.name || "",
        stageColor: st?.color || "#888",
        stageOrder: st?.sort_order ?? 999,
        openDays: daysSince(l.created_at, closed ? l.closed_at : null),
        stageDays: daysSince(l.stage_entered_at || null),
        lastActivity: l.last_activity_at ? new Date(l.last_activity_at).getTime() : null,
        tagNames: (l.tags || []).map((t) => t.tag?.name).filter(Boolean).join(", "),
      };
    });
    const dir = sort.dir === "asc" ? 1 : -1;
    const cmpNull = (a: number | null, b: number | null) => {
      if (a === null && b === null) return 0;
      if (a === null) return 1; // vazio sempre no fim
      if (b === null) return -1;
      return (a - b) * dir;
    };
    const cmpText = (a: string, b: string) => a.localeCompare(b, "pt-BR", { sensitivity: "base" }) * dir;
    enriched.sort((x, y) => {
      switch (sort.key) {
        case "name": return cmpText(x.lead.name || "", y.lead.name || "");
        case "phone": return cmpText(x.lead.phone || "", y.lead.phone || "");
        case "stage": return (x.stageOrder - y.stageOrder) * dir;
        case "owner": return cmpText(x.lead.owner?.name || "", y.lead.owner?.name || "");
        case "value": return cmpNull(x.lead.opportunity_value ?? null, y.lead.opportunity_value ?? null);
        case "origin": return cmpText(x.lead.origin?.name || "", y.lead.origin?.name || "");
        case "open_days": return cmpNull(x.openDays, y.openDays);
        case "stage_days": return cmpNull(x.stageDays, y.stageDays);
        case "last_activity": return cmpNull(x.lastActivity, y.lastActivity);
        case "tags": return cmpText(x.tagNames, y.tagNames);
        default: return 0;
      }
    });
    return enriched;
  }, [leads, stageById, sort]);

  const toggleSort = (key: SortKey) =>
    setSort((prev) => (prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: key === "name" || key === "owner" || key === "origin" || key === "stage" ? "asc" : "desc" }));

  const shown = rows.slice(0, visible);
  const shownIds = shown.map((r) => r.lead.id);
  const allShownSelected = shownIds.length > 0 && shownIds.every((id) => selectedLeads.includes(id));

  const Head = ({ k, children, className }: { k: SortKey; children: React.ReactNode; className?: string }) => (
    <TableHead className={cn("h-9 text-[11px] uppercase tracking-wide whitespace-nowrap", className)}>
      <button type="button" onClick={() => toggleSort(k)} className="inline-flex items-center gap-1 hover:text-foreground">
        {children}
        {sort.key === k ? (sort.dir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-40" />}
      </button>
    </TableHead>
  );

  return (
    <div className="h-full min-h-0 overflow-auto px-2 sm:px-4 pb-4">
      <div className="rounded-lg border border-border/60 bg-card">
        <Table>
          <TableHeader className="sticky top-0 bg-card z-10">
            <TableRow>
              {isMaster && (
                <TableHead className="w-8 h-9">
                  <Checkbox
                    checked={allShownSelected}
                    onCheckedChange={(c) => onSelectMany(shownIds, !!c)}
                    className="h-3.5 w-3.5"
                    title={allShownSelected ? "Desmarcar os visíveis" : "Selecionar os visíveis"}
                  />
                </TableHead>
              )}
              <Head k="name">Nome</Head>
              <Head k="phone">Telefone</Head>
              <Head k="stage">Etapa</Head>
              <Head k="owner">Responsável</Head>
              <Head k="value" className="text-right">Valor</Head>
              <Head k="origin">Origem</Head>
              <Head k="open_days" className="text-right">Dias em aberto</Head>
              <Head k="stage_days" className="text-right">Parado na etapa</Head>
              <Head k="last_activity">Última atividade</Head>
              <Head k="tags">Etiquetas</Head>
            </TableRow>
          </TableHeader>
          <TableBody>
            {shown.length === 0 && (
              <TableRow>
                <TableCell colSpan={isMaster ? 11 : 10} className="text-center text-sm text-muted-foreground py-10">
                  Nenhum lead com os filtros atuais
                </TableCell>
              </TableRow>
            )}
            {shown.map(({ lead, stageName, stageColor, openDays, stageDays }) => {
              const selected = selectedLeads.includes(lead.id);
              return (
                <TableRow
                  key={lead.id}
                  className={cn("cursor-pointer text-[13px]", selected && "bg-primary/5")}
                  onClick={() => navigate(`/crm/leads/${lead.id}`)}
                >
                  {isMaster && (
                    <TableCell className="py-1.5" onClick={(e) => e.stopPropagation()}>
                      <Checkbox checked={selected} onCheckedChange={(c) => onSelectLead(lead.id, !!c)} className="h-3.5 w-3.5" />
                    </TableCell>
                  )}
                  <TableCell className="py-1.5 font-medium max-w-[220px] truncate" title={lead.name}>{lead.name}</TableCell>
                  <TableCell className="py-1.5 whitespace-nowrap tabular-nums">{lead.phone || ""}</TableCell>
                  <TableCell className="py-1.5 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: stageColor }} />
                      {stageName}
                    </span>
                  </TableCell>
                  <TableCell className="py-1.5 whitespace-nowrap">{lead.owner?.name || <span className="text-muted-foreground">Sem responsável</span>}</TableCell>
                  <TableCell className="py-1.5 text-right tabular-nums whitespace-nowrap">{formatCurrency(lead.opportunity_value)}</TableCell>
                  <TableCell className="py-1.5 whitespace-nowrap max-w-[160px] truncate">{lead.origin?.name || ""}</TableCell>
                  <TableCell className="py-1.5 text-right tabular-nums">{openDays ?? ""}</TableCell>
                  <TableCell className="py-1.5 text-right tabular-nums">{stageDays ?? ""}</TableCell>
                  <TableCell className="py-1.5 whitespace-nowrap text-muted-foreground">
                    {lead.last_activity_at ? formatDistanceToNow(new Date(lead.last_activity_at), { locale: ptBR, addSuffix: true }) : ""}
                  </TableCell>
                  <TableCell className="py-1.5">
                    <div className="flex flex-wrap gap-1 max-w-[220px]">
                      {(lead.tags || []).slice(0, 4).map((t) => (
                        <Badge key={t.tag.id} variant="outline" className="text-[9px] px-1.5 py-0 h-4 rounded font-medium border-0"
                          style={{ color: t.tag.color, backgroundColor: `${t.tag.color}14` }}>
                          {t.tag.name}
                        </Badge>
                      ))}
                      {(lead.tags?.length || 0) > 4 && <span className="text-[10px] text-muted-foreground">+{lead.tags!.length - 4}</span>}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        {rows.length > visible && (
          <div className="flex items-center justify-center gap-3 py-2 border-t border-border/60 text-xs text-muted-foreground">
            <span>{visible} de {rows.length}</span>
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setVisible((v) => v + 200)}>
              Mostrar mais 200
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
