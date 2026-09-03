import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface SegmentSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function SegmentSelect({
  value,
  onValueChange,
  placeholder = "Selecione o segmento",
  className,
}: SegmentSelectProps) {
  const [segments, setSegments] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newSegment, setNewSegment] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchSegments = async () => {
    const { data } = await supabase
      .from("company_segments")
      .select("name")
      .eq("is_active", true)
      .order("name");
    setSegments((data || []).map((s: any) => s.name));
    setLoading(false);
  };

  useEffect(() => {
    fetchSegments();
  }, []);

  const handleAddSegment = async () => {
    const trimmed = newSegment.trim();
    if (!trimmed) return;
    if (segments.includes(trimmed)) {
      toast.error("Esse segmento já existe");
      return;
    }

    setSaving(true);
    const { error } = await supabase
      .from("company_segments")
      .insert({ name: trimmed });

    if (error) {
      toast.error("Erro ao adicionar segmento");
    } else {
      toast.success("Segmento adicionado");
      setNewSegment("");
      setAdding(false);
      await fetchSegments();
      onValueChange(trimmed);
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <SearchableSelect value="none" onValueChange={() => {}} options={[]} placeholder="Carregando..." className={className} />
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="flex gap-2">
        <div className="flex-1 min-w-0">
          <SearchableSelect
            value={value || "none"}
            onValueChange={(v) => onValueChange(v === "none" ? "" : v)}
            options={segments.map((seg) => ({ value: seg, label: seg }))}
            allowNone
            noneLabel="Sem segmento"
            placeholder={placeholder === "Selecione o segmento" ? "Digite pra buscar o segmento" : placeholder}
            emptyMessage="Nenhum segmento encontrado"
            className={className}
          />
        </div>
        <Button type="button" variant="outline" size="icon" title="Adicionar segmento" onClick={() => setAdding((a) => !a)}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      {adding && (
        <div className="flex items-center gap-1">
          <Input
            value={newSegment}
            onChange={(e) => setNewSegment(e.target.value)}
            placeholder="Nome do novo segmento"
            className="h-8 text-sm"
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); handleAddSegment(); }
              if (e.key === "Escape") setAdding(false);
            }}
            autoFocus
          />
          <Button size="sm" className="h-8 px-2" onClick={handleAddSegment} disabled={saving || !newSegment.trim()}>
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : "OK"}
          </Button>
        </div>
      )}
    </div>
  );
}
