import { useState } from "react";
import Papa from "papaparse";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Upload, Loader2, FileSpreadsheet } from "lucide-react";

// normaliza cabeçalho: minúsculo, sem acento
function norm(s: string): string {
  return (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
}
function pick(row: Record<string, any>, keys: string[]): string {
  const map: Record<string, any> = {};
  for (const k of Object.keys(row)) map[norm(k)] = row[k];
  for (const c of keys) if (map[c] != null && String(map[c]).trim()) return String(map[c]).trim();
  return "";
}

export function DialerImportDialog({ open, onOpenChange, onDone }: { open: boolean; onOpenChange: (o: boolean) => void; onDone?: () => void }) {
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState<string>("");

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setProgress("Lendo planilha…");

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (res) => {
        try {
          const rows = (res.data as Record<string, any>[]) || [];
          // funil Discador do tenant (RLS escopa) + 1ª etapa
          const { data: pipeline } = await supabase.from("crm_pipelines").select("id").eq("name", "Discador").eq("is_active", true).maybeSingle();
          let pipelineId = pipeline?.id || null;
          let stageId: string | null = null;
          if (pipelineId) {
            const { data: stage } = await supabase.from("crm_stages").select("id").eq("pipeline_id", pipelineId).order("sort_order", { ascending: true }).limit(1).maybeSingle();
            stageId = stage?.id || null;
          }

          const leads = rows.map((r) => {
            const phone = pick(r, ["phone", "telefone", "celular", "whatsapp", "fone", "tel", "telemovel"]).replace(/[^\d+]/g, "");
            const name = pick(r, ["name", "nome", "contato", "cliente", "lead"]) || phone || "Lead";
            return {
              name,
              phone: phone || null,
              email: pick(r, ["email", "e-mail", "mail"]) || null,
              company: pick(r, ["company", "empresa", "razao social", "razao", "negocio"]) || null,
              city: pick(r, ["city", "cidade"]) || null,
              state: pick(r, ["state", "estado", "uf"]) || null,
              pipeline_id: pipelineId,
              stage_id: stageId,
            };
          }).filter((l) => l.phone); // só leads com telefone fazem sentido pro discador

          if (!leads.length) {
            toast.error("Nenhum lead com telefone encontrado na planilha.");
            setImporting(false);
            return;
          }

          let inserted = 0;
          for (let i = 0; i < leads.length; i += 500) {
            const chunk = leads.slice(i, i + 500);
            setProgress(`Importando ${i + 1}–${Math.min(i + 500, leads.length)} de ${leads.length}…`);
            const { error } = await supabase.from("crm_leads").insert(chunk);
            if (error) throw error;
            inserted += chunk.length;
          }

          toast.success(`${inserted} leads importados na etapa "Para ligar".`);
          onDone?.();
          onOpenChange(false);
        } catch (err: any) {
          toast.error(err?.message || "Erro ao importar");
        } finally {
          setImporting(false);
          setProgress("");
          e.target.value = "";
        }
      },
      error: (err) => { toast.error(err.message); setImporting(false); },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Importar leads (planilha)</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Suba um arquivo <strong>CSV</strong>. O sistema reconhece automaticamente colunas como
            <span className="text-foreground"> nome, telefone, email, empresa, cidade, estado</span>.
            Só entram leads <strong>com telefone</strong>, na etapa "Para ligar" do funil Discador.
          </p>
          <div className="rounded-lg border border-dashed border-border p-6 text-center">
            <FileSpreadsheet className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
            <Label htmlFor="dialer-csv" className="cursor-pointer">
              <span className="inline-flex items-center gap-2 text-sm font-medium text-primary">
                {importing ? <><Loader2 className="h-4 w-4 animate-spin" /> {progress || "Importando…"}</> : <><Upload className="h-4 w-4" /> Escolher arquivo CSV</>}
              </span>
              <input id="dialer-csv" type="file" accept=".csv,text/csv" className="hidden" disabled={importing} onChange={handleFile} />
            </Label>
          </div>
          <div className="flex justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={importing}>Fechar</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
