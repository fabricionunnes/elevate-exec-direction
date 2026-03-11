import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Award, Download, Plus, Search } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import jsPDF from "jspdf";

interface Certificate {
  id: string;
  participant_id: string;
  cohort_id: string;
  certificate_code: string;
  total_hours: number;
  issued_at: string;
  participant_name?: string;
  cohort_name?: string;
}

export default function PDICertificatesPage() {
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [participants, setParticipants] = useState<{ id: string; full_name: string; cohort_id: string }[]>([]);
  const [cohorts, setCohorts] = useState<{ id: string; name: string; total_hours: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ participant_id: "", cohort_id: "", total_hours: "" });

  const fetchData = useCallback(async () => {
    const [certRes, partRes, cohRes] = await Promise.all([
      supabase.from("pdi_certificates").select("*").order("issued_at", { ascending: false }),
      supabase.from("pdi_participants").select("id, full_name, cohort_id").eq("status", "active"),
      supabase.from("pdi_cohorts").select("id, name, total_hours"),
    ]);
    const parts = (partRes.data as any[]) || [];
    const cohs = (cohRes.data as any[]) || [];
    setParticipants(parts);
    setCohorts(cohs);
    const pMap = new Map(parts.map((p) => [p.id, p.full_name]));
    const cMap = new Map(cohs.map((c) => [c.id, c.name]));
    setCertificates(((certRes.data as any[]) || []).map((c) => ({
      ...c, participant_name: pMap.get(c.participant_id) || "—", cohort_name: cMap.get(c.cohort_id) || "—",
    })));
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleCreate = async () => {
    if (!form.participant_id || !form.cohort_id) { toast.error("Participante e turma são obrigatórios"); return; }
    setSaving(true);
    await supabase.from("pdi_certificates").insert({
      participant_id: form.participant_id,
      cohort_id: form.cohort_id,
      total_hours: parseFloat(form.total_hours) || 0,
    });
    setSaving(false);
    toast.success("Certificado gerado!");
    setDialogOpen(false);
    setForm({ participant_id: "", cohort_id: "", total_hours: "" });
    fetchData();
  };

  const downloadCertificate = (cert: Certificate) => {
    const doc = new jsPDF({ orientation: "landscape" });
    const w = doc.internal.pageSize.getWidth();
    const h = doc.internal.pageSize.getHeight();

    // Border
    doc.setDrawColor(180, 150, 70);
    doc.setLineWidth(3);
    doc.rect(10, 10, w - 20, h - 20);

    // Header
    doc.setFontSize(14);
    doc.setTextColor(100, 100, 100);
    doc.text("UNIVERSIDADE NACIONAL DE VENDAS", w / 2, 30, { align: "center" });

    doc.setFontSize(28);
    doc.setTextColor(30, 30, 30);
    doc.text("CERTIFICADO", w / 2, 50, { align: "center" });

    doc.setFontSize(12);
    doc.setTextColor(80, 80, 80);
    doc.text("Certificamos que", w / 2, 70, { align: "center" });

    doc.setFontSize(22);
    doc.setTextColor(30, 30, 30);
    doc.text(cert.participant_name || "", w / 2, 85, { align: "center" });

    doc.setFontSize(12);
    doc.setTextColor(80, 80, 80);
    doc.text(`concluiu com êxito o Programa de Desenvolvimento Individual`, w / 2, 100, { align: "center" });
    doc.text(`"${cert.cohort_name}"`, w / 2, 110, { align: "center" });
    doc.text(`com carga horária de ${cert.total_hours}h`, w / 2, 120, { align: "center" });

    doc.text(`Data de Conclusão: ${format(new Date(cert.issued_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}`, w / 2, 140, { align: "center" });
    doc.text(`Código: ${cert.certificate_code}`, w / 2, 150, { align: "center" });

    // Signature line
    doc.setLineWidth(0.5);
    doc.line(w / 2 - 50, 170, w / 2 + 50, 170);
    doc.setFontSize(10);
    doc.text("Assinatura Digital", w / 2, 177, { align: "center" });
    doc.text("Universidade Nacional de Vendas", w / 2, 183, { align: "center" });

    doc.save(`certificado-pdi-${cert.certificate_code}.pdf`);
    toast.success("Certificado baixado!");
  };

  const filtered = certificates.filter((c) =>
    (c.participant_name || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Certificados</h1>
          <p className="text-sm text-muted-foreground">Gere e gerencie certificados de conclusão</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />Gerar Certificado
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar participante..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      {loading ? (
        <div className="text-center text-muted-foreground py-12">Carregando...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center text-muted-foreground py-12">Nenhum certificado gerado.</div>
      ) : (
        <div className="grid gap-3">
          {filtered.map((cert) => (
            <Card key={cert.id} className="hover:border-primary/30 transition-colors">
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                      <Award className="h-5 w-5 text-amber-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-sm text-foreground">{cert.participant_name}</h3>
                      <div className="text-xs text-muted-foreground">
                        {cert.cohort_name} • {cert.total_hours}h • Código: {cert.certificate_code}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Emitido em {format(new Date(cert.issued_at), "dd/MM/yyyy", { locale: ptBR })}
                      </p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => downloadCertificate(cert)}>
                    <Download className="h-3 w-3 mr-1" />PDF
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Gerar Certificado</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label>Turma</Label>
              <Select value={form.cohort_id} onValueChange={(v) => {
                const ch = cohorts.find((c) => c.id === v);
                setForm({ ...form, cohort_id: v, total_hours: ch ? String(ch.total_hours) : "" });
              }}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>{cohorts.map((c) => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Participante</Label>
              <Select value={form.participant_id} onValueChange={(v) => setForm({ ...form, participant_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {participants.filter((p) => !form.cohort_id || p.cohort_id === form.cohort_id).map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Carga Horária</Label><Input type="number" value={form.total_hours} onChange={(e) => setForm({ ...form, total_hours: e.target.value })} /></div>
            <Button onClick={handleCreate} disabled={saving} className="w-full">
              {saving ? "Gerando..." : "Gerar Certificado"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
