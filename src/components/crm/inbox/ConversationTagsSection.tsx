// Etiquetas do lead direto no painel da conversa (Atendimento): ver, adicionar,
// remover e criar etiqueta sem sair da conversa (pedido do Fabrício, 16/09/2026).
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, Plus, Tag as TagIcon, X } from "lucide-react";

interface Etiqueta { id: string; name: string; color: string | null }

const HEX = /^#[0-9a-f]{6}$/i;
const corDe = (c: string | null) => (c && HEX.test(c) ? c : "#64748b");

export function ConversationTagsSection({ leadId }: { leadId: string }) {
  const [todas, setTodas] = useState<Etiqueta[]>([]);
  const [doLead, setDoLead] = useState<Etiqueta[]>([]);
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    let ativo = true;
    (async () => {
      const [{ data: tags }, { data: lt }] = await Promise.all([
        supabase.from("crm_tags").select("id, name, color").eq("is_active", true).order("name"),
        supabase.from("crm_lead_tags").select("tag:crm_tags(id, name, color)").eq("lead_id", leadId),
      ]);
      if (!ativo) return;
      setTodas((tags || []) as Etiqueta[]);
      setDoLead(((lt || []) as any[]).map((r) => r.tag).filter(Boolean));
    })();
    return () => { ativo = false; };
  }, [leadId]);

  const adicionar = async (tag: Etiqueta) => {
    setSalvando(true);
    const { error } = await supabase.from("crm_lead_tags")
      .upsert({ lead_id: leadId, tag_id: tag.id } as any, { onConflict: "lead_id,tag_id", ignoreDuplicates: true });
    setSalvando(false);
    if (error) { toast.error("Não consegui adicionar a etiqueta"); return; }
    setDoLead((m) => (m.some((t) => t.id === tag.id) ? m : [...m, tag]));
  };

  const remover = async (tag: Etiqueta) => {
    setSalvando(true);
    const { error } = await supabase.from("crm_lead_tags").delete().eq("lead_id", leadId).eq("tag_id", tag.id);
    setSalvando(false);
    if (error) { toast.error("Não consegui remover a etiqueta"); return; }
    setDoLead((m) => m.filter((t) => t.id !== tag.id));
  };

  const criar = async () => {
    const nome = busca.trim();
    if (!nome) return;
    setSalvando(true);
    const { data, error } = await supabase.from("crm_tags")
      .insert({ name: nome, color: "#2563eb", is_active: true } as any).select("id, name, color").single();
    setSalvando(false);
    if (error || !data) { toast.error("Não consegui criar a etiqueta"); return; }
    const nova = data as Etiqueta;
    setTodas((a) => [...a, nova].sort((x, y) => x.name.localeCompare(y.name)));
    setBusca("");
    await adicionar(nova);
    toast.success(`Etiqueta "${nova.name}" criada`);
  };

  return (
    <div className="p-4 border-b border-border space-y-2">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-sm font-medium">
          <TagIcon className="h-4 w-4" /> Etiquetas
        </span>
        <Popover open={aberto} onOpenChange={setAberto}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" disabled={salvando}>
              <Plus className="h-3.5 w-3.5" /> Adicionar
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-0" align="end">
            <Command>
              <CommandInput placeholder="Buscar etiqueta..." value={busca} onValueChange={setBusca} />
              <CommandList>
                <CommandEmpty>
                  {busca.trim() ? (
                    <button type="button" className="w-full px-3 py-1.5 text-left text-sm hover:bg-muted" onClick={criar}>
                      Criar etiqueta "{busca.trim()}"
                    </button>
                  ) : "Nenhuma etiqueta."}
                </CommandEmpty>
                <CommandGroup>
                  {todas.map((t) => {
                    const tem = doLead.some((m) => m.id === t.id);
                    return (
                      <CommandItem key={t.id} value={t.name} onSelect={() => (tem ? remover(t) : adicionar(t))}>
                        <span className="mr-2 h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: corDe(t.color) }} />
                        <span className="flex-1 truncate">{t.name}</span>
                        {tem && <Check className="h-4 w-4 text-primary" />}
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>
      {doLead.length ? (
        <div className="flex flex-wrap gap-1.5">
          {doLead.map((t) => (
            <span
              key={t.id}
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
              style={{ backgroundColor: `${corDe(t.color)}1f`, color: corDe(t.color) }}
            >
              {t.name}
              <button type="button" onClick={() => remover(t)} className="opacity-70 hover:opacity-100" title="Remover etiqueta" disabled={salvando}>
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Nenhuma etiqueta neste lead.</p>
      )}
    </div>
  );
}
