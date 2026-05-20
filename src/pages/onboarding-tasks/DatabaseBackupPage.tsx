import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  ArrowLeft,
  Download,
  Upload,
  Database,
  Shield,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Clock,
  FileJson,
  RotateCcw,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface BackupMeta {
  exported_at: string;
  exported_by: string;
  tables: string[];
  meta: Record<string, { count: number; error?: string }>;
}

interface RestoreResult {
  success: boolean;
  restored_from: string;
  tables_restored: number;
  total_rows_upserted: number;
  errors: number;
  results: Record<string, { upserted: number; skipped: number; error?: string }>;
}

export default function DatabaseBackupPage() {
  const navigate = useNavigate();

  // Backup state
  const [backingUp, setBackingUp] = useState(false);
  const [lastBackupMeta, setLastBackupMeta] = useState<BackupMeta | null>(null);

  // Restore state
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [restorePreview, setRestorePreview] = useState<BackupMeta | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [restoreProgress, setRestoreProgress] = useState(0);
  const [restoreResult, setRestoreResult] = useState<RestoreResult | null>(null);
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── BACKUP ──────────────────────────────────────────────────────────────────

  const handleBackup = async () => {
    setBackingUp(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error("Sessão expirada. Faça login novamente."); return; }

      const res = await supabase.functions.invoke("database-backup", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (res.error) throw new Error(res.error.message);
      const payload = res.data as BackupMeta & { data: unknown };

      // Build downloadable JSON
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `backup-unv-nexus-${format(new Date(), "yyyy-MM-dd_HH-mm")}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setLastBackupMeta(payload);
      const totalRows = Object.values(payload.meta || {}).reduce((s, t) => s + t.count, 0);
      toast.success(`Backup concluído! ${payload.tables?.length} tabelas, ${totalRows.toLocaleString("pt-BR")} registros.`);
    } catch (err: any) {
      console.error(err);
      toast.error("Erro ao gerar backup: " + (err.message || "Tente novamente"));
    } finally {
      setBackingUp(false);
    }
  };

  // ── RESTORE ─────────────────────────────────────────────────────────────────

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".json")) {
      toast.error("Selecione um arquivo .json gerado pelo sistema de backup.");
      return;
    }

    setRestoreFile(file);
    setRestoreResult(null);

    // Read preview
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string);
        if (!parsed.version || !parsed.data || !parsed.tables) {
          toast.error("Arquivo inválido. Certifique-se de usar um backup gerado pelo Nexus.");
          setRestoreFile(null);
          return;
        }
        setRestorePreview(parsed);
      } catch {
        toast.error("Não foi possível ler o arquivo. Verifique se é um JSON válido.");
        setRestoreFile(null);
      }
    };
    reader.readAsText(file);
  };

  const handleRestoreConfirm = () => {
    setShowRestoreConfirm(true);
  };

  const handleRestore = async () => {
    if (!restoreFile) return;
    setShowRestoreConfirm(false);
    setRestoring(true);
    setRestoreProgress(10);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error("Sessão expirada."); return; }

      // Read file content
      const text = await restoreFile.text();
      const payload = JSON.parse(text);
      setRestoreProgress(30);

      const res = await supabase.functions.invoke("database-restore", {
        body: payload,
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      setRestoreProgress(90);

      if (res.error) throw new Error(res.error.message);

      const result = res.data as RestoreResult;
      setRestoreResult(result);
      setRestoreProgress(100);

      if (result.errors === 0) {
        toast.success(`Restauração concluída! ${result.total_rows_upserted.toLocaleString("pt-BR")} registros restaurados.`);
      } else {
        toast.warning(`Restaurado com ${result.errors} tabela(s) com erro. Verifique os detalhes.`);
      }
    } catch (err: any) {
      console.error(err);
      toast.error("Erro na restauração: " + (err.message || "Tente novamente"));
    } finally {
      setRestoring(false);
    }
  };

  const totalBackupRows = lastBackupMeta
    ? Object.values(lastBackupMeta.meta || {}).reduce((s, t) => s + t.count, 0)
    : 0;

  const previewRows = restorePreview
    ? Object.values(restorePreview.meta || {}).reduce((s, t) => s + t.count, 0)
    : 0;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate("/onboarding-tasks")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Nexus
          </Button>
          <div className="h-6 w-px bg-border" />
          <h1 className="text-lg font-semibold flex items-center gap-2">
            <Database className="h-5 w-5 text-primary" />
            Backup & Restauração do Banco de Dados
          </h1>
          <Badge variant="outline" className="ml-auto text-xs gap-1">
            <Shield className="h-3 w-3" />
            Master / Admin
          </Badge>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-4xl space-y-6">
        {/* Info alert */}
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Sobre este módulo</AlertTitle>
          <AlertDescription>
            O backup exporta as principais tabelas de dados do Nexus em formato JSON. A restauração realiza
            upsert (insert ou update) dos registros — dados existentes são atualizados, não apagados.
          </AlertDescription>
        </Alert>

        {/* ── BACKUP SECTION ── */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5 text-primary" />
              Gerar Backup
            </CardTitle>
            <CardDescription>
              Exporta todos os dados críticos do sistema em um arquivo JSON criptografável e rastreável.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div className="bg-muted/50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-primary">~50</p>
                <p className="text-muted-foreground text-xs mt-1">Tabelas exportadas</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-primary">JSON</p>
                <p className="text-muted-foreground text-xs mt-1">Formato portátil</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-primary">100%</p>
                <p className="text-muted-foreground text-xs mt-1">Service Role</p>
              </div>
            </div>

            {lastBackupMeta && (
              <div className="border rounded-lg p-4 bg-green-50 dark:bg-green-950/20 space-y-2">
                <div className="flex items-center gap-2 text-green-700 dark:text-green-400 font-medium text-sm">
                  <CheckCircle2 className="h-4 w-4" />
                  Último backup desta sessão
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {format(new Date(lastBackupMeta.exported_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                  </span>
                  <span className="flex items-center gap-1">
                    <Database className="h-3 w-3" />
                    {lastBackupMeta.tables?.length} tabelas · {totalBackupRows.toLocaleString("pt-BR")} registros
                  </span>
                </div>
              </div>
            )}

            <Button
              onClick={handleBackup}
              disabled={backingUp}
              className="w-full gap-2"
              size="lg"
            >
              {backingUp ? (
                <><Loader2 className="h-4 w-4 animate-spin" />Gerando backup...</>
              ) : (
                <><Download className="h-4 w-4" />Baixar Backup Agora</>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* ── RESTORE SECTION ── */}
        <Card className="border-orange-200 dark:border-orange-900">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RotateCcw className="h-5 w-5 text-orange-500" />
              Restaurar Backup
              <Badge variant="destructive" className="text-xs ml-1">Somente Master</Badge>
            </CardTitle>
            <CardDescription>
              Importa um arquivo de backup gerado pelo Nexus. Os dados existentes são atualizados (upsert) —
              nenhum registro é apagado.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Atenção</AlertTitle>
              <AlertDescription>
                A restauração sobrescreve registros existentes com os dados do backup. Use apenas em caso de
                perda de dados ou recuperação de desastre. Faça um backup atual antes de restaurar.
              </AlertDescription>
            </Alert>

            {/* File picker */}
            <div
              className="border-2 border-dashed border-muted-foreground/30 rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <FileJson className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
              {restoreFile ? (
                <div>
                  <p className="font-medium text-sm">{restoreFile.name}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {(restoreFile.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              ) : (
                <div>
                  <p className="font-medium text-sm">Clique para selecionar o arquivo de backup</p>
                  <p className="text-xs text-muted-foreground mt-1">Formato: backup-unv-nexus-*.json</p>
                </div>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={handleFileSelect}
            />

            {/* Restore preview */}
            {restorePreview && (
              <div className="border rounded-lg p-4 bg-muted/30 space-y-3">
                <p className="text-sm font-medium">Informações do backup selecionado:</p>
                <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Exportado em: {format(new Date(restorePreview.exported_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                  </span>
                  <span className="flex items-center gap-1">
                    <Shield className="h-3 w-3" />
                    Por: {restorePreview.exported_by}
                  </span>
                  <span className="flex items-center gap-1">
                    <Database className="h-3 w-3" />
                    {restorePreview.tables?.length} tabelas
                  </span>
                  <span className="flex items-center gap-1">
                    <FileJson className="h-3 w-3" />
                    {previewRows.toLocaleString("pt-BR")} registros
                  </span>
                </div>
              </div>
            )}

            {/* Restore progress */}
            {restoring && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  Restaurando dados...
                </div>
                <Progress value={restoreProgress} className="h-2" />
              </div>
            )}

            {/* Restore result */}
            {restoreResult && (
              <div className={`border rounded-lg p-4 space-y-3 ${restoreResult.errors === 0 ? "bg-green-50 dark:bg-green-950/20 border-green-200" : "bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200"}`}>
                <div className={`flex items-center gap-2 font-medium text-sm ${restoreResult.errors === 0 ? "text-green-700 dark:text-green-400" : "text-yellow-700 dark:text-yellow-400"}`}>
                  {restoreResult.errors === 0 ? (
                    <><CheckCircle2 className="h-4 w-4" /> Restauração concluída com sucesso</>
                  ) : (
                    <><AlertTriangle className="h-4 w-4" /> Restauração concluída com alertas</>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                  <span>{restoreResult.tables_restored} tabelas</span>
                  <span>{restoreResult.total_rows_upserted.toLocaleString("pt-BR")} registros</span>
                  <span>{restoreResult.errors} erros</span>
                </div>
                {restoreResult.errors > 0 && (
                  <details className="text-xs">
                    <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                      Ver detalhes dos erros
                    </summary>
                    <div className="mt-2 space-y-1 max-h-40 overflow-y-auto">
                      {Object.entries(restoreResult.results)
                        .filter(([, r]) => r.error)
                        .map(([table, r]) => (
                          <div key={table} className="bg-muted rounded px-2 py-1">
                            <span className="font-mono font-medium">{table}</span>: {r.error}
                          </div>
                        ))}
                    </div>
                  </details>
                )}
              </div>
            )}

            <Button
              onClick={handleRestoreConfirm}
              disabled={!restoreFile || !restorePreview || restoring}
              variant="outline"
              className="w-full gap-2 border-orange-300 text-orange-700 hover:bg-orange-50 dark:border-orange-800 dark:text-orange-400 dark:hover:bg-orange-950/30"
              size="lg"
            >
              {restoring ? (
                <><Loader2 className="h-4 w-4 animate-spin" />Restaurando...</>
              ) : (
                <><Upload className="h-4 w-4" />Restaurar Banco de Dados</>
              )}
            </Button>
          </CardContent>
        </Card>
      </main>

      {/* Confirm dialog */}
      <Dialog open={showRestoreConfirm} onOpenChange={setShowRestoreConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Confirmar Restauração
            </DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-3 text-sm text-foreground pt-2">
                <p>Você está prestes a restaurar o banco de dados com o backup de:</p>
                {restorePreview && (
                  <div className="bg-muted rounded-lg p-3 space-y-1 text-xs">
                    <p><strong>Data:</strong> {format(new Date(restorePreview.exported_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
                    <p><strong>Por:</strong> {restorePreview.exported_by}</p>
                    <p><strong>Registros:</strong> {previewRows.toLocaleString("pt-BR")}</p>
                  </div>
                )}
                <p className="text-destructive font-medium">
                  Esta operação sobrescreve os dados atuais. Certifique-se de ter feito um backup recente antes de prosseguir.
                </p>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowRestoreConfirm(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleRestore}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Confirmar Restauração
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
