import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Link2, Plus, Trash2, Search } from "lucide-react";
import type {
  CRMMetaAccount, CRMMetaCampaign, CampaignPipelineLink,
} from "./useCRMTrafficData";

interface Props {
  account: CRMMetaAccount;
  campaigns: CRMMetaCampaign[];
  links: CampaignPipelineLink[];
  pipelines: { id: string; name: string }[];
  onChanged: () => void;
}

export const CRMCampaignPipelineLinks = ({
  account, campaigns, links, pipelines, onChanged,
}: Props) => {
  const [search, setSearch] = useState("");
  const [openCampaign, setOpenCampaign] = useState<CRMMetaCampaign | null>(null);

  // Agrupa: para cada campanha, lista de funis vinculados
  const linksByCampaign = new Map<string, CampaignPipelineLink[]>();
  for (const l of links) {
    const arr = linksByCampaign.get(l.campaign_id) || [];
    arr.push(l);
    linksByCampaign.set(l.campaign_id, arr);
  }

  const filtered = campaigns.filter(c =>
    !search || (c.campaign_name || "").toLowerCase().includes(search.toLowerCase()),
  );

  const handleToggle = async (campaign: CRMMetaCampaign, pipelineId: string, checked: boolean) => {
    if (checked) {
      const { error } = await supabase.from("crm_meta_campaign_pipelines").insert({
        account_id: account.id,
        campaign_id: campaign.campaign_id,
        pipeline_id: pipelineId,
        weight: 1.0,
      });
      if (error) return toast.error(error.message);
      toast.success("Funil vinculado");
    } else {
      const link = links.find(
        l => l.campaign_id === campaign.campaign_id && l.pipeline_id === pipelineId,
      );
      if (!link) return;
      const { error } = await supabase
        .from("crm_meta_campaign_pipelines")
        .delete()
        .eq("id", link.id);
      if (error) return toast.error(error.message);
      toast.success("Vínculo removido");
    }
    onChanged();
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Link2 className="h-4 w-4" /> Vincular campanhas a funis
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Cada campanha pode ser vinculada a um ou vários funis. Um funil também pode receber várias campanhas.
        </p>
      </CardHeader>
      <CardContent>
        <div className="relative mb-3">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar campanha..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-9"
          />
        </div>

        <div className="space-y-2 max-h-[420px] overflow-auto">
          {filtered.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">
              Nenhuma campanha encontrada. Sincronize a conta primeiro.
            </p>
          )}
          {filtered.map((c) => {
            const linked = linksByCampaign.get(c.campaign_id) || [];
            return (
              <div
                key={c.id}
                className="flex items-center justify-between gap-3 p-3 rounded-lg border border-border/40 hover:bg-muted/30 transition"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm truncate">{c.campaign_name || c.campaign_id}</p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {linked.length === 0 && (
                      <span className="text-[10px] text-muted-foreground">Sem funil vinculado</span>
                    )}
                    {linked.map((l) => (
                      <Badge key={l.id} variant="secondary" className="text-[10px] gap-1">
                        {l.pipeline_name}
                        <button
                          onClick={() => handleToggle(c, l.pipeline_id, false)}
                          className="ml-1 hover:text-destructive"
                        >
                          <Trash2 className="h-2.5 w-2.5" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                </div>
                <Dialog
                  open={openCampaign?.id === c.id}
                  onOpenChange={(o) => setOpenCampaign(o ? c : null)}
                >
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-1 h-8">
                      <Plus className="h-3 w-3" /> Vincular
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle className="text-base">Funis para "{c.campaign_name}"</DialogTitle>
                    </DialogHeader>
                    <ScrollArea className="max-h-[400px]">
                      <div className="space-y-2 pr-2">
                        {pipelines.map((p) => {
                          const isLinked = linked.some((l) => l.pipeline_id === p.id);
                          return (
                            <label
                              key={p.id}
                              className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50 cursor-pointer"
                            >
                              <Checkbox
                                checked={isLinked}
                                onCheckedChange={(v) => handleToggle(c, p.id, !!v)}
                              />
                              <span className="text-sm">{p.name}</span>
                            </label>
                          );
                        })}
                        {pipelines.length === 0 && (
                          <p className="text-xs text-muted-foreground text-center py-4">
                            Nenhum funil ativo encontrado.
                          </p>
                        )}
                      </div>
                    </ScrollArea>
                  </DialogContent>
                </Dialog>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};
