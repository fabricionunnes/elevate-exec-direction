import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Key, Plus, Copy, Trash2, Power, PowerOff, Eye, EyeOff, ShieldCheck } from "lucide-react";

interface ApiKey {
  id: string;
  name: string;
  key: string;
  is_active: boolean;
  tenant_id: string | null;
  created_at: string;
  last_used_at: string | null;
  created_by: string | null;
}

function generateApiKey(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function maskKey(key: string): string {
  return key.slice(0, 8) + "••••••••••••••••••••••••••••••••••••••••••••••••" + key.slice(-6);
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export function ApiKeysManager() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newKeyPreview, setNewKeyPreview] = useState("");
  const [keyMode, setKeyMode] = useState<"generate" | "import">("generate");
  const [creating, setCreating] = useState(false);
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<ApiKey | null>(null);
  const [justCreated, setJustCreated] = useState<string | null>(null);

  const fetchKeys = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("api_keys")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      toast.error("Erro ao carregar chaves");
    } else {
      setKeys(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchKeys();
  }, []);

  const handleOpenCreate = () => {
    setNewName("");
    setNewKeyPreview(generateApiKey());
    setKeyMode("generate");
    setShowCreate(true);
  };

  const handleRegenerateKey = () => {
    setNewKeyPreview(generateApiKey());
  };

  const handleCreate = async () => {
    if (!newName.trim()) {
      toast.error("Informe um nome para a chave");
      return;
    }
    if (!newKeyPreview.trim()) {
      toast.error("A chave não pode estar vazia");
      return;
    }
    setCreating(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("api_keys").insert({
      name: newName.trim(),
      key: newKeyPreview,
      is_active: true,
      tenant_id: null,
      created_by: user?.id ?? null,
    });
    if (error) {
      toast.error("Erro ao criar chave: " + error.message);
    } else {
      toast.success("Chave criada com sucesso");
      setJustCreated(newKeyPreview);
      setShowCreate(false);
      await fetchKeys();
    }
    setCreating(false);
  };

  const handleToggle = async (key: ApiKey) => {
    const { error } = await supabase
      .from("api_keys")
      .update({ is_active: !key.is_active, updated_at: new Date().toISOString() } as any)
      .eq("id", key.id);
    if (error) {
      toast.error("Erro ao atualizar status");
    } else {
      toast.success(key.is_active ? "Chave desativada" : "Chave ativada");
      setKeys((prev) =>
        prev.map((k) => (k.id === key.id ? { ...k, is_active: !k.is_active } : k))
      );
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase.from("api_keys").delete().eq("id", deleteTarget.id);
    if (error) {
      toast.error("Erro ao excluir chave");
    } else {
      toast.success("Chave excluída");
      setKeys((prev) => prev.filter((k) => k.id !== deleteTarget.id));
    }
    setDeleteTarget(null);
  };

  const handleCopy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success("Chave copiada");
    } catch {
      toast.error("Não foi possível copiar");
    }
  };

  const toggleVisibility = (id: string) => {
    setVisibleKeys((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Key className="h-6 w-6 text-primary" />
          <div>
            <h2 className="text-xl font-bold">Chaves de API</h2>
            <p className="text-sm text-muted-foreground">
              Gerencie as chaves de autenticação para integrar sistemas externos à API do Nexus.
            </p>
          </div>
        </div>
        <Button onClick={handleOpenCreate} className="gap-2">
          <Plus className="h-4 w-4" />
          Nova Chave
        </Button>
      </div>

      {/* Aviso de segurança */}
      <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 flex items-start gap-2">
        <ShieldCheck className="h-4 w-4 mt-0.5 shrink-0" />
        <span>
          Trate as chaves como senhas. Não as compartilhe em logs, repositórios ou mensagens.
          A chave completa só é exibida uma vez logo após a criação.
        </span>
      </div>

      {/* Chave recém-criada */}
      {justCreated && (
        <Card className="border-green-200 bg-green-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-green-800 flex items-center gap-2">
              <Key className="h-4 w-4" /> Chave criada — copie agora, não será exibida novamente
            </CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-2">
            <code className="flex-1 text-xs font-mono bg-white border rounded px-3 py-2 break-all text-green-900">
              {justCreated}
            </code>
            <Button size="sm" variant="outline" onClick={() => handleCopy(justCreated)}>
              <Copy className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setJustCreated(null)}>
              ✕
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Lista de chaves */}
      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : keys.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground text-sm">
            Nenhuma chave cadastrada. Clique em "Nova Chave" para criar.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {keys.map((k) => (
            <Card key={k.id} className={k.is_active ? "" : "opacity-60"}>
              <CardContent className="py-4 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm">{k.name}</span>
                    <Badge variant={k.is_active ? "default" : "secondary"} className="text-xs">
                      {k.is_active ? "Ativa" : "Inativa"}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="text-xs font-mono text-muted-foreground break-all">
                      {visibleKeys.has(k.id) ? k.key : maskKey(k.key)}
                    </code>
                    <button
                      onClick={() => toggleVisibility(k.id)}
                      className="text-muted-foreground hover:text-foreground shrink-0"
                    >
                      {visibleKeys.has(k.id) ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                    <button
                      onClick={() => handleCopy(k.key)}
                      className="text-muted-foreground hover:text-foreground shrink-0"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="text-xs text-muted-foreground flex gap-4 flex-wrap">
                    <span>Criada: {formatDate(k.created_at)}</span>
                    <span>Último uso: {formatDate(k.last_used_at)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleToggle(k)}
                    title={k.is_active ? "Desativar" : "Ativar"}
                  >
                    {k.is_active ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setDeleteTarget(k)}
                    title="Excluir"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog — criar chave */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="h-5 w-5 text-primary" /> Nova Chave de API
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nome da integração</Label>
              <Input
                placeholder="Ex: CRM Integration, N8N, Make..."
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <Label>Chave</Label>
                <div className="flex gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => { setKeyMode("generate"); setNewKeyPreview(generateApiKey()); }}
                    className={`px-2 py-0.5 rounded border transition-colors ${keyMode === "generate" ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:text-foreground"}`}
                  >
                    Gerar automaticamente
                  </button>
                  <button
                    type="button"
                    onClick={() => { setKeyMode("import"); setNewKeyPreview(""); }}
                    className={`px-2 py-0.5 rounded border transition-colors ${keyMode === "import" ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:text-foreground"}`}
                  >
                    Importar chave existente
                  </button>
                </div>
              </div>

              {keyMode === "generate" ? (
                <div className="flex gap-2">
                  <code className="flex-1 text-xs font-mono bg-muted rounded px-3 py-2 break-all">
                    {newKeyPreview}
                  </code>
                  <Button size="sm" variant="outline" onClick={handleRegenerateKey} title="Gerar nova">
                    ↻
                  </Button>
                </div>
              ) : (
                <Input
                  placeholder="Cole aqui a chave existente (ex: 6575da9b...)"
                  value={newKeyPreview}
                  onChange={(e) => setNewKeyPreview(e.target.value.trim())}
                  className="font-mono text-xs"
                />
              )}
              <p className="text-xs text-muted-foreground">
                {keyMode === "generate"
                  ? "Guarde a chave agora — ela não será exibida novamente após salvar."
                  : "Cole a chave que foi gerada externamente para registrá-la no sistema."}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreate} disabled={creating}>
              {creating ? "Criando..." : "Criar Chave"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AlertDialog — confirmar exclusão */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir chave?</AlertDialogTitle>
            <AlertDialogDescription>
              A chave <strong>{deleteTarget?.name}</strong> será removida permanentemente.
              Qualquer integração usando ela vai parar de funcionar imediatamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
