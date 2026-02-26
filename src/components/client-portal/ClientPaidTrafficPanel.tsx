import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Megaphone, ExternalLink, Settings, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface ClientPaidTrafficPanelProps {
  projectId: string;
  canEdit?: boolean;
}

export const ClientPaidTrafficPanel = ({ projectId, canEdit = false }: ClientPaidTrafficPanelProps) => {
  const [lookerUrl, setLookerUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showConfigDialog, setShowConfigDialog] = useState(false);
  const [urlInput, setUrlInput] = useState("");

  useEffect(() => {
    fetchLookerUrl();
  }, [projectId]);

  const fetchLookerUrl = async () => {
    try {
      const { data, error } = await supabase
        .from("onboarding_projects")
        .select("looker_studio_url")
        .eq("id", projectId)
        .single();

      if (error) throw error;
      setLookerUrl((data as any)?.looker_studio_url || null);
    } catch (error) {
      console.error("Error fetching looker url:", error);
    } finally {
      setLoading(false);
    }
  };

  const saveLookerUrl = async () => {
    try {
      const { error } = await supabase
        .from("onboarding_projects")
        .update({ looker_studio_url: urlInput || null } as any)
        .eq("id", projectId);

      if (error) throw error;
      setLookerUrl(urlInput || null);
      setShowConfigDialog(false);
      toast.success("Link do Looker Studio atualizado!");
    } catch (error) {
      console.error("Error saving looker url:", error);
      toast.error("Erro ao salvar link");
    }
  };

  // Transform Looker Studio URL to embed format
  const getEmbedUrl = (url: string) => {
    return url.replace("/reporting/", "/embed/reporting/").replace("/s/", "/embed/s/");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!lookerUrl) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Megaphone className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-semibold mb-2">Tráfego Pago</h3>
          <p className="text-sm text-muted-foreground mb-4">
            {canEdit
              ? "Configure o link do dashboard do Looker Studio para visualizar os dados de tráfego pago."
              : "O dashboard de tráfego pago ainda não foi configurado para este projeto."}
          </p>
          {canEdit && (
            <Button onClick={() => { setUrlInput(""); setShowConfigDialog(true); }}>
              <Settings className="h-4 w-4 mr-2" />
              Configurar Dashboard
            </Button>
          )}

          <ConfigDialog
            open={showConfigDialog}
            onOpenChange={setShowConfigDialog}
            urlInput={urlInput}
            setUrlInput={setUrlInput}
            onSave={saveLookerUrl}
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Tráfego Pago</h2>
          <p className="text-xs text-muted-foreground">Dashboard de performance de campanhas</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open(lookerUrl, "_blank")}
            className="gap-2"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Abrir no Looker</span>
          </Button>
          {canEdit && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setUrlInput(lookerUrl || ""); setShowConfigDialog(true); }}
            >
              <Settings className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      <div className="w-full rounded-lg border overflow-hidden bg-background" style={{ height: "calc(100vh - 220px)", minHeight: "500px" }}>
        <iframe
          src={getEmbedUrl(lookerUrl)}
          width="100%"
          height="100%"
          frameBorder="0"
          allowFullScreen
          sandbox="allow-storage-access-by-user-activation allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
          style={{ border: 0 }}
        />
      </div>

      <ConfigDialog
        open={showConfigDialog}
        onOpenChange={setShowConfigDialog}
        urlInput={urlInput}
        setUrlInput={setUrlInput}
        onSave={saveLookerUrl}
      />
    </div>
  );
};

function ConfigDialog({
  open,
  onOpenChange,
  urlInput,
  setUrlInput,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  urlInput: string;
  setUrlInput: (v: string) => void;
  onSave: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Configurar Dashboard de Tráfego</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>URL do Looker Studio</Label>
            <Input
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="https://lookerstudio.google.com/reporting/..."
            />
            <p className="text-xs text-muted-foreground mt-1">
              Cole o link de compartilhamento do seu dashboard no Looker Studio.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
              Cancelar
            </Button>
            <Button onClick={onSave} className="flex-1">
              Salvar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
