import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, parseISO, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Search, ExternalLink, ShieldCheck, Clock, Loader2 } from "lucide-react";

interface Props {
  projects: any[];
  onRefresh: () => void;
  isAdmin: boolean;
}

export function CRCompaniesInNoticeTab({ projects, onRefresh, isAdmin }: Props) {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [retentionDialog, setRetentionDialog] = useState<{ open: boolean; project: any | null }>({ open: false, project: null });
  const [strategy, setStrategy] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const inNotice = projects.filter(p =>
    p.status === "cancellation_signaled" || p.status === "notice_period"
  );

  const filtered = inNotice.filter(p => {
    if (!search) return true;
    const q = search.toLowerCase();
    return p.company_name?.toLowerCase().includes(q) || p.product_name?.toLowerCase().includes(q);
  });

  const handleRegisterAttempt = async () => {
    if (!retentionDialog.project) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("retention_attempts" as any).insert({
        project_id: retentionDialog.project.id,
        company_id: retentionDialog.project.onboarding_company_id || null,
        strategy,
        notes,
        result: "pending",
      });
      if (error) throw error;
      toast.success("Tentativa de retenção registrada");
      setRetentionDialog({ open: false, project: null });
      setStrategy("");
      setNotes("");
      onRefresh();
    } catch (err: any) {
      toast.error("Erro: " + (err.message || ""));
    } finally {
      setSaving(false);
    }
  };

  const getDaysRemaining = (endDate: string | null) => {
    if (!endDate) return null;
    return differenceInDays(parseISO(endDate), new Date());
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar empresa..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Empresa</TableHead>
                <TableHead>Consultor</TableHead>
                <TableHead>Data do Aviso</TableHead>
                <TableHead>Motivo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Dias Restantes</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Nenhuma empresa em aviso no momento
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map(p => {
                  const days = getDaysRemaining(p.notice_end_date);
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.company_name || p.product_name}</TableCell>
                      <TableCell>{p.consultant_name || p.cs_name || "—"}</TableCell>
                      <TableCell>
                        {p.cancellation_signal_date ? format(parseISO(p.cancellation_signal_date), "dd/MM/yyyy") : "—"}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">{p.cancellation_signal_reason || "—"}</TableCell>
                      <TableCell>
                        {p.status === "notice_period" ? (
                          <Badge variant="destructive">Cumprindo Aviso</Badge>
                        ) : (
                          <Badge className="bg-amber-500/20 text-amber-600 border-amber-500/30">Sinalizou</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {days !== null ? (
                          <span className={days <= 7 ? "text-destructive font-bold" : ""}>{days}d</span>
                        ) : "—"}
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button size="sm" variant="outline" onClick={() => navigate(`/onboarding-tasks/${p.id}`)}>
                          <ExternalLink className="h-3 w-3 mr-1" /> Ver
                        </Button>
                        {isAdmin && (
                          <Button size="sm" variant="default" onClick={() => setRetentionDialog({ open: true, project: p })}>
                            <ShieldCheck className="h-3 w-3 mr-1" /> Reter
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={retentionDialog.open} onOpenChange={open => !open && setRetentionDialog({ open: false, project: null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar Tentativa de Retenção</DialogTitle>
            <DialogDescription>
              Empresa: {retentionDialog.project?.company_name || retentionDialog.project?.product_name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Estratégia utilizada</label>
              <Select value={strategy} onValueChange={setStrategy}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="desconto">Desconto</SelectItem>
                  <SelectItem value="upgrade">Upgrade de plano</SelectItem>
                  <SelectItem value="reuniao">Reunião de alinhamento</SelectItem>
                  <SelectItem value="troca_consultor">Troca de consultor</SelectItem>
                  <SelectItem value="plano_acao">Plano de ação personalizado</SelectItem>
                  <SelectItem value="pausa">Pausa temporária</SelectItem>
                  <SelectItem value="outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Observações</label>
              <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Detalhes da tentativa..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRetentionDialog({ open: false, project: null })}>Cancelar</Button>
            <Button onClick={handleRegisterAttempt} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Registrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
