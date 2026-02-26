import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Megaphone, ExternalLink, Settings, Loader2, Code, Link } from "lucide-react";
import { toast } from "sonner";

interface ClientPaidTrafficPanelProps {
  projectId: string;
  canEdit?: boolean;
}

const extractSrcFromEmbed = (embedCode: string): string | null => {
  const match = embedCode.match(/src=["']([^"']+)["']/);
  return match ? match[1] : null;
};

export const ClientPaidTrafficPanel = ({ projectId, canEdit = false }: ClientPaidTrafficPanelProps) => {
  const [lookerUrl, setLookerUrl] = useState<string | null>(null);
  const [embedCode, setEmbedCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showConfigDialog, setShowConfigDialog] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [embedInput, setEmbedInput] = useState("");
  const [configTab, setConfigTab] = useState("url");

  useEffect(() => {
    fetchData();
  }, [projectId]);

  const fetchData = async () => {
    try {
      const { data, error } = await supabase
        .from("onboarding_projects")
        .select("looker_studio_url, looker_embed_code")
        .eq("id", projectId)
        .single();

      if (error) throw error;
      setLookerUrl((data as any)?.looker_studio_url || null);
      setEmbedCode((data as any)?.looker_embed_code || null);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async () => {
    try {
      const updateData: any = {};
      if (configTab === "url") {
        updateData.looker_studio_url = urlInput || null;
        updateData.looker_embed_code = null;
      } else {
        updateData.looker_embed_code = embedInput || null;
        updateData.looker_studio_url = null;
      }

      const { error } = await supabase
        .from("onboarding_projects")
        .update(updateData)
        .eq("id", projectId);

      if (error) throw error;

      if (configTab === "url") {
        setLookerUrl(urlInput || null);
        setEmbedCode(null);
      } else {
        setEmbedCode(embedInput || null);
        setLookerUrl(null);
      }
      setShowConfigDialog(false);
      toast.success("Dashboard atualizado!");
    } catch (error) {
      console.error("Error saving config:", error);
      toast.error("Erro ao salvar configuração");
    }
  };

  const getEmbedUrl = (url: string) => {
    return url.replace("/reporting/", "/embed/reporting/").replace("/s/", "/embed/s/");
  };

  // Determine the iframe src: embed code takes priority
  const getIframeSrc = (): string | null => {
    if (embedCode) {
      return extractSrcFromEmbed(embedCode);
    }
    if (lookerUrl) {
      return getEmbedUrl(lookerUrl);
    }
    return null;
  };

  const getExternalUrl = (): string | null => {
    if (lookerUrl) return lookerUrl;
    if (embedCode) return extractSrcFromEmbed(embedCode);
    return null;
  };

  const hasConfig = lookerUrl || embedCode;
  const iframeSrc = getIframeSrc();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!hasConfig) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Megaphone className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-semibold mb-2">Tráfego Pago</h3>
          <p className="text-sm text-muted-foreground mb-4">
            {canEdit
              ? "Configure o dashboard de tráfego pago colando um link ou código embed."
              : "O dashboard de tráfego pago ainda não foi configurado para este projeto."}
          </p>
          {canEdit && (
            <Button onClick={() => { setUrlInput(""); setEmbedInput(""); setConfigTab("url"); setShowConfigDialog(true); }}>
              <Settings className="h-4 w-4 mr-2" />
              Configurar Dashboard
            </Button>
          )}
          <ConfigDialog
            open={showConfigDialog}
            onOpenChange={setShowConfigDialog}
            urlInput={urlInput}
            setUrlInput={setUrlInput}
            embedInput={embedInput}
            setEmbedInput={setEmbedInput}
            configTab={configTab}
            setConfigTab={setConfigTab}
            onSave={saveConfig}
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
          {getExternalUrl() && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(getExternalUrl()!, "_blank")}
              className="gap-2"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Abrir no Looker</span>
            </Button>
          )}
          {canEdit && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setUrlInput(lookerUrl || "");
                setEmbedInput(embedCode || "");
                setConfigTab(embedCode ? "embed" : "url");
                setShowConfigDialog(true);
              }}
            >
              <Settings className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      {iframeSrc && (
        <div className="w-full rounded-lg border overflow-hidden bg-background" style={{ height: "calc(100vh - 220px)", minHeight: "500px" }}>
          <iframe
            src={iframeSrc}
            width="100%"
            height="100%"
            frameBorder="0"
            allowFullScreen
            sandbox="allow-storage-access-by-user-activation allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
            style={{ border: 0 }}
          />
        </div>
      )}

      <ConfigDialog
        open={showConfigDialog}
        onOpenChange={setShowConfigDialog}
        urlInput={urlInput}
        setUrlInput={setUrlInput}
        embedInput={embedInput}
        setEmbedInput={setEmbedInput}
        configTab={configTab}
        setConfigTab={setConfigTab}
        onSave={saveConfig}
      />
    </div>
  );
};

function ConfigDialog({
  open,
  onOpenChange,
  urlInput,
  setUrlInput,
  embedInput,
  setEmbedInput,
  configTab,
  setConfigTab,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  urlInput: string;
  setUrlInput: (v: string) => void;
  embedInput: string;
  setEmbedInput: (v: string) => void;
  configTab: string;
  setConfigTab: (v: string) => void;
  onSave: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Configurar Dashboard de Tráfego</DialogTitle>
        </DialogHeader>
        <Tabs value={configTab} onValueChange={setConfigTab}>
          <TabsList className="w-full">
            <TabsTrigger value="url" className="flex-1 gap-1.5">
              <Link className="h-3.5 w-3.5" />
              Link
            </TabsTrigger>
            <TabsTrigger value="embed" className="flex-1 gap-1.5">
              <Code className="h-3.5 w-3.5" />
              Código Embed
            </TabsTrigger>
          </TabsList>
          <TabsContent value="url" className="space-y-3 mt-3">
            <div>
              <Label>URL do Looker Studio</Label>
              <Input
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="https://lookerstudio.google.com/reporting/..."
              />
              <p className="text-xs text-muted-foreground mt-1">
                Cole o link de compartilhamento do seu dashboard.
              </p>
            </div>
          </TabsContent>
          <TabsContent value="embed" className="space-y-3 mt-3">
            <div>
              <Label>Código Embed (iframe)</Label>
              <Textarea
                value={embedInput}
                onChange={(e) => setEmbedInput(e.target.value)}
                placeholder='<iframe src="https://lookerstudio.google.com/embed/reporting/..." ...></iframe>'
                rows={5}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Cole o código embed gerado pelo Looker Studio (Arquivo → Incorporar relatório).
              </p>
            </div>
          </TabsContent>
        </Tabs>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
            Cancelar
          </Button>
          <Button onClick={onSave} className="flex-1">
            Salvar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
