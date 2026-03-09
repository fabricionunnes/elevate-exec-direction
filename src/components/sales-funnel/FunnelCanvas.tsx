import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, Plus, Trash2, Sparkles, ZoomIn, ZoomOut, AlertTriangle, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { FunnelBottleneckAnalysis } from "./FunnelBottleneckAnalysis";
import { FunnelAIOptimizer } from "./FunnelAIOptimizer";

interface Stage {
  id: string;
  name: string;
  description: string | null;
  stage_type: string;
  position_x: number;
  position_y: number;
  color: string;
  sort_order: number;
  expected_conversion_rate: number | null;
  expected_avg_time_days: number | null;
  responsible: string | null;
  required_tasks: string | null;
  indicators: string | null;
  crm_stage_id: string | null;
}

interface Connection {
  id: string;
  from_stage_id: string;
  to_stage_id: string;
  label: string | null;
  conversion_rate: number | null;
}

interface FunnelCanvasProps {
  funnelId: string;
  projectId: string;
  canEdit: boolean;
  onBack: () => void;
}

const STAGE_WIDTH = 180;
const STAGE_HEIGHT = 70;

const STAGE_TYPES = [
  { value: "entry", label: "Entrada de Lead", color: "#3b82f6" },
  { value: "qualification", label: "Qualificação", color: "#8b5cf6" },
  { value: "meeting", label: "Reunião", color: "#0ea5e9" },
  { value: "demo", label: "Demonstração", color: "#06b6d4" },
  { value: "proposal", label: "Proposta", color: "#f59e0b" },
  { value: "negotiation", label: "Negociação", color: "#ef4444" },
  { value: "followup", label: "Follow-up", color: "#f97316" },
  { value: "closing", label: "Fechamento", color: "#22c55e" },
  { value: "lost", label: "Perdido", color: "#6b7280" },
  { value: "post_sale", label: "Pós-venda", color: "#14b8a6" },
  { value: "custom", label: "Personalizado", color: "#a855f7" },
];

export function FunnelCanvas({ funnelId, projectId, canEdit, onBack }: FunnelCanvasProps) {
  const [funnel, setFunnel] = useState<any>(null);
  const [stages, setStages] = useState<Stage[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [selectedStage, setSelectedStage] = useState<Stage | null>(null);
  const [showStageDialog, setShowStageDialog] = useState(false);
  const [showBottlenecks, setShowBottlenecks] = useState(false);
  const [showAIOptimizer, setShowAIOptimizer] = useState(false);
  const [dragging, setDragging] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [connecting, setConnecting] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const canvasRef = useRef<HTMLDivElement>(null);

  const [stageForm, setStageForm] = useState({
    name: "", description: "", stage_type: "custom", color: "#3b82f6",
    expected_conversion_rate: "", expected_avg_time_days: "",
    responsible: "", required_tasks: "", indicators: "",
  });

  const fetchData = useCallback(async () => {
    const [funnelRes, stagesRes, connsRes] = await Promise.all([
      supabase.from("sales_funnels").select("*").eq("id", funnelId).single(),
      supabase.from("sales_funnel_stages").select("*").eq("funnel_id", funnelId).order("sort_order"),
      supabase.from("sales_funnel_connections").select("*").eq("funnel_id", funnelId),
    ]);
    setFunnel(funnelRes.data);
    setStages(stagesRes.data || []);
    setConnections(connsRes.data || []);
  }, [funnelId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleAddStage = () => {
    setSelectedStage(null);
    setStageForm({
      name: "", description: "", stage_type: "custom", color: "#3b82f6",
      expected_conversion_rate: "", expected_avg_time_days: "",
      responsible: "", required_tasks: "", indicators: "",
    });
    setShowStageDialog(true);
  };

  const handleEditStage = (stage: Stage) => {
    setSelectedStage(stage);
    setStageForm({
      name: stage.name,
      description: stage.description || "",
      stage_type: stage.stage_type,
      color: stage.color || "#3b82f6",
      expected_conversion_rate: stage.expected_conversion_rate?.toString() || "",
      expected_avg_time_days: stage.expected_avg_time_days?.toString() || "",
      responsible: stage.responsible || "",
      required_tasks: stage.required_tasks || "",
      indicators: stage.indicators || "",
    });
    setShowStageDialog(true);
  };

  const handleSaveStage = async () => {
    if (!stageForm.name.trim()) { toast.error("Nome obrigatório"); return; }
    const payload = {
      funnel_id: funnelId,
      name: stageForm.name,
      description: stageForm.description || null,
      stage_type: stageForm.stage_type,
      color: stageForm.color,
      expected_conversion_rate: stageForm.expected_conversion_rate ? parseFloat(stageForm.expected_conversion_rate) : null,
      expected_avg_time_days: stageForm.expected_avg_time_days ? parseFloat(stageForm.expected_avg_time_days) : null,
      responsible: stageForm.responsible || null,
      required_tasks: stageForm.required_tasks || null,
      indicators: stageForm.indicators || null,
    };

    if (selectedStage) {
      await supabase.from("sales_funnel_stages").update(payload).eq("id", selectedStage.id);
      toast.success("Etapa atualizada");
    } else {
      const newY = stages.length * 100 + 50;
      await supabase.from("sales_funnel_stages").insert({ ...payload, position_x: 400, position_y: newY, sort_order: stages.length });
      toast.success("Etapa criada");
    }
    setShowStageDialog(false);
    fetchData();
  };

  const handleDeleteStage = async (stageId: string) => {
    if (!confirm("Excluir esta etapa?")) return;
    await supabase.from("sales_funnel_stages").delete().eq("id", stageId);
    toast.success("Etapa excluída");
    fetchData();
  };

  // Drag handling
  const handleMouseDown = (e: React.MouseEvent, stageId: string) => {
    if (!canEdit) return;
    if (connecting) {
      // Complete connection
      if (connecting !== stageId) {
        supabase.from("sales_funnel_connections").insert({
          funnel_id: funnelId,
          from_stage_id: connecting,
          to_stage_id: stageId,
        }).then(() => { fetchData(); toast.success("Conexão criada"); });
      }
      setConnecting(null);
      return;
    }
    e.stopPropagation();
    const stage = stages.find(s => s.id === stageId);
    if (!stage) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    setDragOffset({
      x: (e.clientX - rect.left) / zoom - pan.x - stage.position_x,
      y: (e.clientY - rect.top) / zoom - pan.y - stage.position_y,
    });
    setDragging(stageId);
  };

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / zoom - pan.x - dragOffset.x;
    const y = (e.clientY - rect.top) / zoom - pan.y - dragOffset.y;
    setStages(prev => prev.map(s => s.id === dragging ? { ...s, position_x: Math.max(0, x), position_y: Math.max(0, y) } : s));
  }, [dragging, dragOffset, zoom, pan]);

  const handleMouseUp = useCallback(async () => {
    if (dragging) {
      const stage = stages.find(s => s.id === dragging);
      if (stage) {
        await supabase.from("sales_funnel_stages").update({ position_x: stage.position_x, position_y: stage.position_y }).eq("id", dragging);
      }
      setDragging(null);
    }
  }, [dragging, stages]);

  const handleDeleteConnection = async (connId: string) => {
    await supabase.from("sales_funnel_connections").delete().eq("id", connId);
    toast.success("Conexão removida");
    fetchData();
  };

  const getBottleneckStatus = (stage: Stage): "critical" | "warning" | "healthy" => {
    if (!stage.expected_conversion_rate) return "healthy";
    if (stage.expected_conversion_rate < 20) return "critical";
    if (stage.expected_conversion_rate < 50) return "warning";
    return "healthy";
  };

  const statusIcon = (status: "critical" | "warning" | "healthy") => {
    if (status === "critical") return <AlertTriangle className="h-3 w-3 text-red-500" />;
    if (status === "warning") return <AlertCircle className="h-3 w-3 text-yellow-500" />;
    return <CheckCircle2 className="h-3 w-3 text-green-500" />;
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="h-4 w-4" /></Button>
          <div>
            <h3 className="font-semibold text-lg">{funnel?.name || "Carregando..."}</h3>
            {funnel?.description && <p className="text-xs text-muted-foreground">{funnel.description}</p>}
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          {canEdit && (
            <>
              <Button size="sm" onClick={handleAddStage}><Plus className="h-4 w-4 mr-1" /> Etapa</Button>
              <Button size="sm" variant="outline" onClick={() => setConnecting(connecting ? null : "start")}>
                {connecting ? "Cancelar" : "🔗 Conectar"}
              </Button>
            </>
          )}
          <Button size="sm" variant="outline" onClick={() => setShowBottlenecks(true)}>
            <AlertTriangle className="h-4 w-4 mr-1" /> Gargalos
          </Button>
          <Button size="sm" variant="outline" onClick={() => setShowAIOptimizer(true)}>
            <Sparkles className="h-4 w-4 mr-1" /> IA Otimização
          </Button>
          <div className="flex gap-1">
            <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => setZoom(z => Math.min(2, z + 0.1))}><ZoomIn className="h-3.5 w-3.5" /></Button>
            <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => setZoom(z => Math.max(0.3, z - 0.1))}><ZoomOut className="h-3.5 w-3.5" /></Button>
          </div>
        </div>
      </div>

      {connecting && connecting !== "start" && (
        <div className="bg-primary/10 text-primary rounded-md p-2 text-sm text-center">
          Clique na etapa de destino para criar a conexão
        </div>
      )}

      {/* Canvas */}
      <div
        ref={canvasRef}
        className="relative border rounded-xl bg-muted/30 overflow-hidden"
        style={{ height: "600px", cursor: dragging ? "grabbing" : "default" }}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          style={{ transform: `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)`, transformOrigin: "0 0" }}
        >
          <defs>
            <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
              <polygon points="0 0, 10 3.5, 0 7" fill="hsl(var(--primary))" />
            </marker>
          </defs>
          {connections.map((conn) => {
            const fromStage = stages.find(s => s.id === conn.from_stage_id);
            const toStage = stages.find(s => s.id === conn.to_stage_id);
            if (!fromStage || !toStage) return null;
            const x1 = fromStage.position_x + STAGE_WIDTH / 2;
            const y1 = fromStage.position_y + STAGE_HEIGHT;
            const x2 = toStage.position_x + STAGE_WIDTH / 2;
            const y2 = toStage.position_y;
            const midY = (y1 + y2) / 2;
            const midX = (x1 + x2) / 2;
            return (
              <g key={conn.id} className="group/conn">
                {/* Invisible wider path for easier clicking */}
                <path
                  d={`M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`}
                  stroke="transparent"
                  strokeWidth="16"
                  fill="none"
                  className="pointer-events-auto cursor-pointer"
                  onClick={() => canEdit && handleDeleteConnection(conn.id)}
                />
                {/* Visible path */}
                <path
                  d={`M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`}
                  stroke="hsl(var(--primary))"
                  strokeWidth="2"
                  fill="none"
                  markerEnd="url(#arrowhead)"
                  className="pointer-events-none"
                />
                {conn.label && (
                  <text x={midX} y={midY - 5} textAnchor="middle" className="fill-muted-foreground text-[10px] pointer-events-none">
                    {conn.label}
                  </text>
                )}
                {conn.conversion_rate && (
                  <text x={midX} y={midY + 12} textAnchor="middle" className="fill-primary text-[10px] font-medium pointer-events-none">
                    {conn.conversion_rate}%
                  </text>
                )}
                {/* Delete button on hover */}
                {canEdit && (
                  <g
                    className="pointer-events-auto cursor-pointer opacity-0 hover:opacity-100"
                    onClick={() => handleDeleteConnection(conn.id)}
                    style={{ transition: "opacity 0.15s" }}
                  >
                    <circle cx={midX} cy={midY} r="10" fill="hsl(var(--destructive))" opacity="0.9" />
                    <line x1={midX - 4} y1={midY - 4} x2={midX + 4} y2={midY + 4} stroke="white" strokeWidth="2" />
                    <line x1={midX + 4} y1={midY - 4} x2={midX - 4} y2={midY + 4} stroke="white" strokeWidth="2" />
                  </g>
                )}
              </g>
            );
          })}
        </svg>

        {/* Stage blocks */}
        <div style={{ transform: `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)`, transformOrigin: "0 0", position: "relative", height: "100%" }}>
          {stages.map((stage) => {
            const status = getBottleneckStatus(stage);
            return (
              <div
                key={stage.id}
                className={`absolute rounded-lg border-2 shadow-md cursor-grab active:cursor-grabbing select-none transition-shadow hover:shadow-lg ${
                  connecting && connecting !== "start" ? "ring-2 ring-primary ring-offset-2 cursor-crosshair" : ""
                } ${selectedStage?.id === stage.id ? "ring-2 ring-primary" : ""}`}
                style={{
                  left: stage.position_x,
                  top: stage.position_y,
                  width: STAGE_WIDTH,
                  minHeight: STAGE_HEIGHT,
                  borderColor: stage.color,
                  backgroundColor: `${stage.color}15`,
                }}
                onMouseDown={(e) => {
                  if (connecting === "start") {
                    setConnecting(stage.id);
                    return;
                  }
                  handleMouseDown(e, stage.id);
                }}
                onDoubleClick={() => canEdit && handleEditStage(stage)}
              >
                <div className="p-2.5">
                  <div className="flex items-center gap-1.5 mb-1">
                    {statusIcon(status)}
                    <span className="font-medium text-xs truncate flex-1">{stage.name}</span>
                    {canEdit && (
                      <button onClick={(e) => { e.stopPropagation(); handleDeleteStage(stage.id); }} className="opacity-0 hover:opacity-100 transition-opacity">
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </button>
                    )}
                  </div>
                  <div className="flex gap-1 flex-wrap">
                    {stage.expected_conversion_rate && (
                      <Badge variant="outline" className="text-[9px] px-1 py-0">{stage.expected_conversion_rate}%</Badge>
                    )}
                    {stage.expected_avg_time_days && (
                      <Badge variant="outline" className="text-[9px] px-1 py-0">{stage.expected_avg_time_days}d</Badge>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {stages.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <p className="font-medium">Canvas vazio</p>
              <p className="text-sm">Adicione etapas para desenhar seu funil</p>
            </div>
          </div>
        )}
      </div>

      {/* Stage Dialog */}
      <Dialog open={showStageDialog} onOpenChange={setShowStageDialog}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedStage ? "Editar Etapa" : "Nova Etapa"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome *</Label>
              <Input value={stageForm.name} onChange={(e) => setStageForm({ ...stageForm, name: e.target.value })} />
            </div>
            <div>
              <Label>Tipo</Label>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={stageForm.stage_type}
                onChange={(e) => {
                  const t = STAGE_TYPES.find(st => st.value === e.target.value);
                  setStageForm({ ...stageForm, stage_type: e.target.value, color: t?.color || stageForm.color, name: stageForm.name || t?.label || "" });
                }}>
                {STAGE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <Label>Cor</Label>
              <Input type="color" value={stageForm.color} onChange={(e) => setStageForm({ ...stageForm, color: e.target.value })} />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea value={stageForm.description} onChange={(e) => setStageForm({ ...stageForm, description: e.target.value })} rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Taxa Conversão (%)</Label>
                <Input type="number" value={stageForm.expected_conversion_rate} onChange={(e) => setStageForm({ ...stageForm, expected_conversion_rate: e.target.value })} />
              </div>
              <div>
                <Label>Tempo Médio (dias)</Label>
                <Input type="number" value={stageForm.expected_avg_time_days} onChange={(e) => setStageForm({ ...stageForm, expected_avg_time_days: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Responsável</Label>
              <Input value={stageForm.responsible} onChange={(e) => setStageForm({ ...stageForm, responsible: e.target.value })} />
            </div>
            <div>
              <Label>Tarefas Obrigatórias</Label>
              <Textarea value={stageForm.required_tasks} onChange={(e) => setStageForm({ ...stageForm, required_tasks: e.target.value })} rows={2} placeholder="Uma por linha" />
            </div>
            <div>
              <Label>Indicadores Esperados</Label>
              <Input value={stageForm.indicators} onChange={(e) => setStageForm({ ...stageForm, indicators: e.target.value })} />
            </div>
            <Button onClick={handleSaveStage} className="w-full">{selectedStage ? "Salvar" : "Criar Etapa"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bottleneck Analysis */}
      <FunnelBottleneckAnalysis
        open={showBottlenecks}
        onOpenChange={setShowBottlenecks}
        stages={stages}
        connections={connections}
      />

      {/* AI Optimizer */}
      <FunnelAIOptimizer
        open={showAIOptimizer}
        onOpenChange={setShowAIOptimizer}
        funnelId={funnelId}
        stages={stages}
        connections={connections}
      />
    </div>
  );
}
