import { useState, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Plus, Edit2, Trash2, QrCode, Download, Copy, Eye, ExternalLink } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import QRCode from "qrcode";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ContextType {
  companyId: string;
  pointsName: string;
}

interface Rule {
  id: string;
  name: string;
  points_value: number;
}

interface Campaign {
  id: string;
  name: string;
  description: string | null;
  rule_id: string | null;
  access_token: string;
  form_fields: any[];
  limit_per_cpf_per_day: number | null;
  limit_per_cpf_total: number | null;
  min_hours_between: number | null;
  is_active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  total_scans: number;
  created_at: string;
  rule?: { name: string; points_value: number } | null;
}

interface FormField {
  id: string;
  label: string;
  type: "text" | "number" | "select";
  required: boolean;
  options?: string[];
}

export default function CustomerPointsQRCodes() {
  const { companyId, pointsName } = useOutletContext<ContextType>();
  const [loading, setLoading] = useState(true);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [rules, setRules] = useState<Rule[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState("");
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    rule_id: "",
    limit_per_cpf_per_day: "1",
    limit_per_cpf_total: "",
    min_hours_between: "0",
    starts_at: "",
    ends_at: "",
    form_fields: [] as FormField[],
  });

  useEffect(() => {
    if (companyId) fetchData();
  }, [companyId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: campaignsData, error: campError } = await supabase
        .from("customer_points_qr_campaigns")
        .select("*, rule:customer_points_rules(name, points_value)")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false });

      if (campError) throw campError;
      setCampaigns((campaignsData || []) as Campaign[]);

      const { data: rulesData } = await supabase
        .from("customer_points_rules")
        .select("id, name, points_value")
        .eq("company_id", companyId)
        .eq("is_active", true)
        .order("sort_order");
      setRules(rulesData || []);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      rule_id: "",
      limit_per_cpf_per_day: "1",
      limit_per_cpf_total: "",
      min_hours_between: "0",
      starts_at: "",
      ends_at: "",
      form_fields: [],
    });
    setEditingCampaign(null);
  };

  const openEditDialog = (campaign: Campaign) => {
    setEditingCampaign(campaign);
    setFormData({
      name: campaign.name,
      description: campaign.description || "",
      rule_id: campaign.rule_id || "",
      limit_per_cpf_per_day: campaign.limit_per_cpf_per_day?.toString() || "1",
      limit_per_cpf_total: campaign.limit_per_cpf_total?.toString() || "",
      min_hours_between: campaign.min_hours_between?.toString() || "0",
      starts_at: campaign.starts_at ? campaign.starts_at.split("T")[0] : "",
      ends_at: campaign.ends_at ? campaign.ends_at.split("T")[0] : "",
      form_fields: campaign.form_fields || [],
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }
    if (!formData.rule_id) {
      toast.error("Selecione uma regra de pontuação");
      return;
    }

    setSaving(true);
    try {
      const campaignData = {
        company_id: companyId,
        name: formData.name.trim(),
        description: formData.description || null,
        rule_id: formData.rule_id,
        limit_per_cpf_per_day: formData.limit_per_cpf_per_day ? parseInt(formData.limit_per_cpf_per_day) : null,
        limit_per_cpf_total: formData.limit_per_cpf_total ? parseInt(formData.limit_per_cpf_total) : null,
        min_hours_between: formData.min_hours_between ? parseInt(formData.min_hours_between) : 0,
        starts_at: formData.starts_at ? new Date(formData.starts_at).toISOString() : null,
        ends_at: formData.ends_at ? new Date(formData.ends_at).toISOString() : null,
        form_fields: formData.form_fields as any,
      };

      if (editingCampaign) {
        const { error } = await supabase
          .from("customer_points_qr_campaigns")
          .update(campaignData)
          .eq("id", editingCampaign.id);
        if (error) throw error;
        toast.success("Campanha atualizada!");
      } else {
        const { error } = await supabase
          .from("customer_points_qr_campaigns")
          .insert(campaignData);
        if (error) throw error;
        toast.success("Campanha criada!");
      }

      setDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error: any) {
      console.error("Error saving campaign:", error);
      toast.error(error.message || "Erro ao salvar campanha");
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (campaign: Campaign) => {
    try {
      const { error } = await supabase
        .from("customer_points_qr_campaigns")
        .update({ is_active: !campaign.is_active })
        .eq("id", campaign.id);
      if (error) throw error;
      toast.success(campaign.is_active ? "Campanha desativada" : "Campanha ativada");
      fetchData();
    } catch (error) {
      console.error("Error toggling status:", error);
      toast.error("Erro ao alterar status");
    }
  };

  const deleteCampaign = async (campaignId: string) => {
    try {
      const { error } = await supabase
        .from("customer_points_qr_campaigns")
        .delete()
        .eq("id", campaignId);
      if (error) throw error;
      toast.success("Campanha excluída");
      fetchData();
    } catch (error) {
      console.error("Error deleting campaign:", error);
      toast.error("Erro ao excluir campanha");
    }
  };

  const showQRCode = async (campaign: Campaign) => {
    setSelectedCampaign(campaign);
    const formUrl = `${window.location.origin}/pontuacao-form/${campaign.access_token}`;
    
    try {
      const qrDataUrl = await QRCode.toDataURL(formUrl, {
        width: 300,
        margin: 2,
        color: { dark: "#000000", light: "#ffffff" },
      });
      setQrCodeUrl(qrDataUrl);
      setQrDialogOpen(true);
    } catch (error) {
      console.error("Error generating QR:", error);
      toast.error("Erro ao gerar QR Code");
    }
  };

  const downloadQR = () => {
    if (!qrCodeUrl || !selectedCampaign) return;
    const link = document.createElement("a");
    link.download = `qrcode-${selectedCampaign.name.toLowerCase().replace(/\s+/g, "-")}.png`;
    link.href = qrCodeUrl;
    link.click();
  };

  const copyLink = async (campaign: Campaign) => {
    const formUrl = `${window.location.origin}/pontuacao-form/${campaign.access_token}`;
    await navigator.clipboard.writeText(formUrl);
    toast.success("Link copiado!");
  };

  const addFormField = () => {
    const newField: FormField = {
      id: crypto.randomUUID(),
      label: "",
      type: "text",
      required: false,
    };
    setFormData({ ...formData, form_fields: [...formData.form_fields, newField] });
  };

  const updateFormField = (index: number, updates: Partial<FormField>) => {
    const fields = [...formData.form_fields];
    fields[index] = { ...fields[index], ...updates };
    setFormData({ ...formData, form_fields: fields });
  };

  const removeFormField = (index: number) => {
    const fields = formData.form_fields.filter((_, i) => i !== index);
    setFormData({ ...formData, form_fields: fields });
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">QR Code & Formulários</h1>
          <p className="text-muted-foreground">Crie campanhas de check-in e participação via QR Code</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Nova Campanha
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingCampaign ? "Editar Campanha" : "Nova Campanha"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <Label>Nome da campanha *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: Check-in Loja, Evento X..."
                />
              </div>
              <div>
                <Label>Descrição</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Descrição da campanha..."
                  rows={2}
                />
              </div>
              <div>
                <Label>Regra de pontuação *</Label>
                <Select
                  value={formData.rule_id}
                  onValueChange={(v) => setFormData({ ...formData, rule_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {rules.map((rule) => (
                      <SelectItem key={rule.id} value={rule.id}>
                        {rule.name} (+{rule.points_value} pts)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Anti-fraud limits */}
              <div className="p-4 bg-muted/50 rounded-lg space-y-4">
                <p className="text-sm font-medium">Limites anti-fraude</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Por CPF/dia</Label>
                    <Input
                      type="number"
                      min={1}
                      value={formData.limit_per_cpf_per_day}
                      onChange={(e) => setFormData({ ...formData, limit_per_cpf_per_day: e.target.value })}
                      placeholder="1"
                    />
                  </div>
                  <div>
                    <Label>Total por CPF</Label>
                    <Input
                      type="number"
                      value={formData.limit_per_cpf_total}
                      onChange={(e) => setFormData({ ...formData, limit_per_cpf_total: e.target.value })}
                      placeholder="Sem limite"
                    />
                  </div>
                </div>
                <div>
                  <Label>Intervalo mínimo (horas)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={formData.min_hours_between}
                    onChange={(e) => setFormData({ ...formData, min_hours_between: e.target.value })}
                  />
                </div>
              </div>

              {/* Date range */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Data início</Label>
                  <Input
                    type="date"
                    value={formData.starts_at}
                    onChange={(e) => setFormData({ ...formData, starts_at: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Data fim</Label>
                  <Input
                    type="date"
                    value={formData.ends_at}
                    onChange={(e) => setFormData({ ...formData, ends_at: e.target.value })}
                  />
                </div>
              </div>

              {/* Custom form fields */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Perguntas customizadas</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addFormField}>
                    <Plus className="h-3 w-3 mr-1" /> Adicionar
                  </Button>
                </div>
                {formData.form_fields.map((field, index) => (
                  <div key={field.id} className="flex gap-2 items-start p-2 bg-muted/50 rounded">
                    <div className="flex-1 space-y-2">
                      <Input
                        placeholder="Pergunta..."
                        value={field.label}
                        onChange={(e) => updateFormField(index, { label: e.target.value })}
                      />
                      <div className="flex gap-2">
                        <Select
                          value={field.type}
                          onValueChange={(v: "text" | "number" | "select") => updateFormField(index, { type: v })}
                        >
                          <SelectTrigger className="w-28">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="text">Texto</SelectItem>
                            <SelectItem value="number">Número</SelectItem>
                            <SelectItem value="select">Seleção</SelectItem>
                          </SelectContent>
                        </Select>
                        <label className="flex items-center gap-1 text-sm">
                          <input
                            type="checkbox"
                            checked={field.required}
                            onChange={(e) => updateFormField(index, { required: e.target.checked })}
                          />
                          Obrigatório
                        </label>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeFormField(index)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>

              <Button onClick={handleSave} disabled={saving} className="w-full">
                {saving ? "Salvando..." : editingCampaign ? "Salvar alterações" : "Criar campanha"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* QR Code Dialog */}
      <Dialog open={qrDialogOpen} onOpenChange={setQrDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-center">{selectedCampaign?.name}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-4">
            {qrCodeUrl && (
              <img src={qrCodeUrl} alt="QR Code" className="w-64 h-64 rounded-lg border" />
            )}
            <p className="text-sm text-muted-foreground text-center">
              Escaneie para registrar {pointsName.toLowerCase()}
            </p>
            <div className="flex gap-2">
              <Button onClick={downloadQR} className="gap-2">
                <Download className="h-4 w-4" />
                Baixar PNG
              </Button>
              <Button variant="outline" onClick={() => selectedCampaign && copyLink(selectedCampaign)}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Campaigns List */}
      {campaigns.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <QrCode className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nenhuma campanha criada ainda.</p>
            <p className="text-sm">Crie sua primeira campanha de QR Code!</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {campaigns.map((campaign) => (
            <Card key={campaign.id} className={!campaign.is_active ? "opacity-60" : ""}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-base truncate">{campaign.name}</CardTitle>
                    {campaign.description && (
                      <CardDescription className="line-clamp-1">{campaign.description}</CardDescription>
                    )}
                  </div>
                  <Badge variant={campaign.is_active ? "default" : "secondary"}>
                    {campaign.is_active ? "Ativo" : "Inativo"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Regra:</span>
                  <span className="font-medium">
                    {campaign.rule?.name} (+{campaign.rule?.points_value} pts)
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Scans:</span>
                  <span className="font-bold">{campaign.total_scans}</span>
                </div>
                {campaign.ends_at && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Válido até:</span>
                    <span>{format(new Date(campaign.ends_at), "dd/MM/yyyy", { locale: ptBR })}</span>
                  </div>
                )}

                <div className="flex items-center gap-2 pt-2">
                  <Button size="sm" className="flex-1 gap-1" onClick={() => showQRCode(campaign)}>
                    <QrCode className="h-4 w-4" />
                    Ver QR
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => copyLink(campaign)}>
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => openEditDialog(campaign)}>
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => toggleStatus(campaign)}
                  >
                    {campaign.is_active ? "Desativar" : "Ativar"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
