// Certificado digital A1 da empresa: enviado e trocado aqui dentro, porque
// vence todo ano. O arquivo vai pro servidor e a senha é guardada cifrada —
// nenhuma das duas coisas aparece de volta na tela.
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  ShieldCheck, ShieldAlert, Upload, Loader2, PlugZap, Trash2, AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export function FiscalCertificateCard({ codigoMunicipio = "3144805", onStatus }: { codigoMunicipio?: string; onStatus?: (s: any) => void }) {
  const [status, setStatus] = useState<any>(null);
  const [carregando, setCarregando] = useState(true);
  const [aberto, setAberto] = useState(false);
  const [senha, setSenha] = useState("");
  const [apelido, setApelido] = useState("");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [testando, setTestando] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const chamar = async (body: any) => {
    const { data, error } = await supabase.functions.invoke("fiscal-certificate", { body });
    if (error) {
      // a função devolve o motivo no corpo; o SDK só entrega "non-2xx"
      const ctx: any = (error as any).context;
      const detalhe = await ctx?.json?.().catch(() => null);
      throw new Error(detalhe?.error || error.message);
    }
    if ((data as any)?.error) throw new Error((data as any).error);
    return data as any;
  };

  const carregar = useCallback(async () => {
    try {
      const s = await chamar({ action: "status" });
      setStatus(s); onStatus?.(s);
    } catch {
      setStatus(null);
    } finally { setCarregando(false); }
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  const enviar = async () => {
    if (!arquivo) { toast.error("Escolha o arquivo do certificado (.pfx ou .p12)"); return; }
    if (!senha) { toast.error("Digite a senha do certificado"); return; }
    setSalvando(true);
    try {
      const base64 = await new Promise<string>((res, rej) => {
        const fr = new FileReader();
        fr.onload = () => res(String(fr.result).split(",")[1]);
        fr.onerror = rej;
        fr.readAsDataURL(arquivo);
      });
      const r = await chamar({ action: "save", arquivo_base64: base64, senha, apelido });
      toast.success(`Certificado de ${r.titular} guardado — vence em ${format(new Date(r.valido_ate), "dd/MM/yyyy")}`);
      setAberto(false); setSenha(""); setArquivo(null); setApelido("");
      carregar();
    } catch (e: any) {
      toast.error(e?.message || "Não consegui guardar o certificado");
    } finally { setSalvando(false); }
  };

  const testar = async () => {
    setTestando(true);
    try {
      const r = await chamar({ action: "test", codigo_municipio: codigoMunicipio });
      r.ok ? toast.success(r.message) : toast.error(r.message);
      carregar();
    } catch (e: any) {
      toast.error(e?.message || "Falha no teste");
    } finally { setTestando(false); }
  };

  const remover = async () => {
    if (!confirm("Remover o certificado? A emissão automática para de funcionar até enviar outro.")) return;
    try { await chamar({ action: "delete" }); toast.success("Certificado removido"); carregar(); }
    catch (e: any) { toast.error(e?.message || "Não consegui remover"); }
  };

  if (carregando) return null;

  const dias = status?.dias_para_vencer;
  const vencendo = typeof dias === "number" && dias >= 0 && dias <= 30;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-base flex items-center gap-2">
            {status?.tem_certificado && !status?.vencido
              ? <ShieldCheck className="h-4 w-4 text-emerald-600" />
              : <ShieldAlert className="h-4 w-4 text-amber-600" />}
            Certificado digital (A1)
          </CardTitle>
          <div className="flex items-center gap-2">
            {status?.tem_certificado && (
              <Button variant="outline" size="sm" className="gap-1.5" onClick={testar} disabled={testando}>
                {testando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PlugZap className="h-3.5 w-3.5" />}
                Testar conexão
              </Button>
            )}
            <Button size="sm" className="gap-1.5" onClick={() => setAberto(true)}>
              <Upload className="h-3.5 w-3.5" /> {status?.tem_certificado ? "Trocar" : "Enviar certificado"}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {!status?.tem_certificado ? (
          <p className="text-sm text-muted-foreground">
            Envie o arquivo .pfx (ou .p12) e a senha. É com ele que o sistema assina a nota direto no
            Emissor Nacional, sem intermediário. A senha fica guardada cifrada e não aparece mais na tela.
          </p>
        ) : (
          <>
            <div className="text-sm">
              <span className="font-medium">{status.titular}</span>
              {status.cnpj && <span className="text-muted-foreground"> · CNPJ {status.cnpj}</span>}
            </div>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Badge variant="outline" className={
                status.vencido ? "border-destructive/40 text-destructive"
                  : vencendo ? "border-amber-500/40 text-amber-600"
                  : "border-emerald-500/40 text-emerald-600"}>
                {status.vencido
                  ? `Vencido em ${format(new Date(status.valido_ate), "dd/MM/yyyy", { locale: ptBR })}`
                  : `Vence em ${format(new Date(status.valido_ate), "dd/MM/yyyy", { locale: ptBR })} (${dias} dias)`}
              </Badge>
              {status.ultimo_teste_em && (
                <span className={`text-xs ${status.ultimo_teste_ok ? "text-emerald-600" : "text-destructive"}`}>
                  {status.ultimo_teste_ok ? "Conexão testada e funcionando" : "Último teste falhou"}
                </span>
              )}
              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive ml-auto" onClick={remover}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
            {status.ultimo_teste_msg && !status.ultimo_teste_ok && (
              <p className="text-xs text-muted-foreground">{status.ultimo_teste_msg}</p>
            )}
            {vencendo && (
              <p className="text-sm text-amber-700 flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4" /> Renove antes do vencimento — sem certificado válido a emissão para.
              </p>
            )}
          </>
        )}
      </CardContent>

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Enviar certificado digital</DialogTitle>
            <DialogDescription>
              Arquivo .pfx ou .p12 (tipo A1). Só master e admin conseguem ver ou trocar.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Arquivo do certificado</Label>
              <Input ref={inputRef} type="file" accept=".pfx,.p12"
                onChange={(e) => setArquivo(e.target.files?.[0] || null)} />
            </div>
            <div>
              <Label className="text-xs">Senha do certificado</Label>
              <Input type="password" value={senha} onChange={(e) => setSenha(e.target.value)}
                autoComplete="off" placeholder="a senha que veio com o arquivo" />
            </div>
            <div>
              <Label className="text-xs">Apelido (opcional)</Label>
              <Input value={apelido} onChange={(e) => setApelido(e.target.value)} placeholder="Ex: e-CNPJ UNV 2026" />
            </div>
            <p className="text-xs text-muted-foreground">
              O sistema confere a senha na hora e mostra o titular e a validade. Se a senha estiver errada, nada é guardado.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAberto(false)}>Cancelar</Button>
            <Button onClick={enviar} disabled={salvando} className="gap-1.5">
              {salvando && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Enviar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
