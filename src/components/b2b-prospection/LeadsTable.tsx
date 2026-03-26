import { useState, useMemo } from "react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ExternalLink, Star, MessageCircle, StickyNote, ChevronUp, ChevronDown,
  MoreHorizontal, Phone,
} from "lucide-react";
import { B2B_LEAD_STATUSES } from "@/types/b2bProspection";
import type { B2BLead, B2BLeadStatus } from "@/types/b2bProspection";

interface LeadsTableProps {
  leads: B2BLead[];
  loading: boolean;
  selectedIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
  onStatusChange?: (lead: B2BLead, status: B2BLeadStatus) => void;
  onAddNote?: (lead: B2BLead) => void;
  existingPhones?: Set<string>;
}

type SortKey = "name" | "segment" | "city" | "google_rating";
type SortDir = "asc" | "desc";

export function LeadsTable({
  leads,
  loading,
  selectedIds,
  onSelectionChange,
  onStatusChange,
  onAddNote,
  existingPhones,
}: LeadsTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [page, setPage] = useState(0);
  const pageSize = 50;

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  };

  const sorted = useMemo(() => {
    return [...leads].sort((a, b) => {
      const av = a[sortKey] ?? "";
      const bv = b[sortKey] ?? "";
      const cmp = typeof av === "number" && typeof bv === "number"
        ? av - bv
        : String(av).localeCompare(String(bv), "pt-BR");
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [leads, sortKey, sortDir]);

  const totalPages = Math.ceil(sorted.length / pageSize);
  const paged = sorted.slice(page * pageSize, (page + 1) * pageSize);

  const allSelected = paged.length > 0 && paged.every((l) => selectedIds.has(l.place_id));

  const toggleAll = () => {
    if (allSelected) {
      const newIds = new Set(selectedIds);
      paged.forEach((l) => newIds.delete(l.place_id));
      onSelectionChange(newIds);
    } else {
      const newIds = new Set(selectedIds);
      paged.forEach((l) => newIds.add(l.place_id));
      onSelectionChange(newIds);
    }
  };

  const toggleOne = (placeId: string) => {
    const newIds = new Set(selectedIds);
    if (newIds.has(placeId)) newIds.delete(placeId);
    else newIds.add(placeId);
    onSelectionChange(newIds);
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return null;
    return sortDir === "asc" ? <ChevronUp className="h-3 w-3 inline ml-1" /> : <ChevronDown className="h-3 w-3 inline ml-1" />;
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (!leads.length) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <Search className="h-12 w-12 mx-auto mb-4 opacity-30" />
        <p className="text-lg font-medium">Nenhum lead encontrado</p>
        <p className="text-sm">Tente ajustar os filtros de busca</p>
      </div>
    );
  }

  const renderStars = (rating: number | null) => {
    if (!rating) return <span className="text-muted-foreground text-xs">-</span>;
    return (
      <div className="flex items-center gap-0.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star
            key={i}
            className={`h-3 w-3 ${i < Math.round(rating) ? "text-yellow-500 fill-yellow-500" : "text-muted-foreground/30"}`}
          />
        ))}
        <span className="text-xs ml-1 text-muted-foreground">{rating}</span>
      </div>
    );
  };

  return (
    <TooltipProvider>
      <div className="space-y-3">
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40px]">
                  <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
                </TableHead>
                <TableHead className="w-[40px]">#</TableHead>
                <TableHead className="cursor-pointer" onClick={() => toggleSort("name")}>
                  Empresa <SortIcon col="name" />
                </TableHead>
                <TableHead className="cursor-pointer" onClick={() => toggleSort("segment")}>
                  Segmento <SortIcon col="segment" />
                </TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Endereço</TableHead>
                <TableHead className="cursor-pointer" onClick={() => toggleSort("city")}>
                  Cidade/UF <SortIcon col="city" />
                </TableHead>
                <TableHead>Website</TableHead>
                <TableHead className="cursor-pointer" onClick={() => toggleSort("google_rating")}>
                  Avaliação <SortIcon col="google_rating" />
                </TableHead>
                <TableHead className="w-[80px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.map((lead, idx) => {
                const isSelected = selectedIds.has(lead.place_id);
                const isDuplicate = existingPhones && lead.phone && existingPhones.has(lead.phone);
                return (
                  <TableRow
                    key={lead.place_id}
                    className={isSelected ? "bg-primary/5" : ""}
                  >
                    <TableCell>
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleOne(lead.place_id)}
                      />
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {page * pageSize + idx + 1}
                    </TableCell>
                    <TableCell className="font-medium max-w-[200px] truncate">
                      <div className="flex items-center gap-1.5">
                        {lead.name}
                        {isDuplicate && (
                          <Tooltip>
                            <TooltipTrigger>
                              <Badge variant="outline" className="text-[10px] px-1 py-0 border-yellow-500 text-yellow-600">
                                Já prospectado
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent>Este telefone já está em uma lista salva</TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{lead.segment}</TableCell>
                    <TableCell>
                      {lead.phone ? (
                        <div className="flex items-center gap-1">
                          <Phone className="h-3 w-3 text-muted-foreground" />
                          <span className="text-sm">{lead.phone}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-xs">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                      {lead.address}
                    </TableCell>
                    <TableCell className="text-sm">
                      {lead.city}/{lead.state}
                    </TableCell>
                    <TableCell>
                      {lead.website ? (
                        <a
                          href={lead.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:text-primary/80"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      ) : (
                        <span className="text-muted-foreground text-xs">-</span>
                      )}
                    </TableCell>
                    <TableCell>{renderStars(lead.google_rating)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {lead.phone && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <a
                                href={`https://wa.me/55${lead.phone.replace(/\D/g, "")}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1 rounded hover:bg-green-100 text-green-600"
                              >
                                <MessageCircle className="h-4 w-4" />
                              </a>
                            </TooltipTrigger>
                            <TooltipContent>Abrir no WhatsApp</TooltipContent>
                          </Tooltip>
                        )}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {onAddNote && (
                              <DropdownMenuItem onClick={() => onAddNote(lead)}>
                                <StickyNote className="h-4 w-4 mr-2" />
                                Adicionar Nota
                              </DropdownMenuItem>
                            )}
                            {onStatusChange && B2B_LEAD_STATUSES.map((s) => (
                              <DropdownMenuItem
                                key={s.value}
                                onClick={() => onStatusChange(lead, s.value)}
                              >
                                <Badge className={`${s.color} text-[10px] mr-2`}>{s.label}</Badge>
                                Marcar como {s.label}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              Mostrando {page * pageSize + 1}-{Math.min((page + 1) * pageSize, sorted.length)} de {sorted.length}
            </span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(page - 1)}>
                Anterior
              </Button>
              <Button size="sm" variant="outline" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>
                Próximo
              </Button>
            </div>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}

function Search(props: React.SVGProps<SVGSVGElement> & { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
    </svg>
  );
}
