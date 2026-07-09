import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { CheckCircle2, Loader2, PartyPopper, Upload, FileCheck } from "lucide-react";
import confetti from "canvas-confetti";

export default function ProfileHireRegistrationPage() {
  const [searchParams] = useSearchParams();
  const candidateId = searchParams.get("candidate");

  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const [f, setF] = useState({ cpf: "", cnpj: "", address: "", neighborhood: "", city: "", state: "", bank_info: "", pix_key: "" });
  const [photo, setPhoto] = useState<File | null>(null);

  useEffect(() => {
    if (!candidateId) { setNotFound(true); setLoading(false); return; }
    (async () => {
      const { data, error } = await supabase.functions.invoke("profile-candidate-public-info", { body: { candidateId } });
      const c = (data as any)?.candidate;
      if (error || !c) setNotFound(true);
      else setName(c.full_name || "");
      setLoading(false);
    })();
  }, [candidateId]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!f.cpf.trim() || !f.address.trim() || !f.city.trim() || !f.state.trim()) {
      toast.error("Preencha pelo menos CPF, endereço, cidade e estado");
      return;
    }
    setSubmitting(true);
    try {
      let photo_url: string | null = null;
      if (photo) {
        const ext = photo.name.split(".").pop();
        const path = `hire-photos/${candidateId}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("resumes").upload(path, photo, { upsert: true });
        if (upErr) throw upErr;
        photo_url = supabase.storage.from("resumes").getPublicUrl(path).data.publicUrl;
      }
      const { data, error } = await supabase.functions.invoke("profile-hire-candidate", {
        body: { candidateId, data: { ...f, photo_url } },
      });
      if (error || (data as any)?.error) throw new Error((data as any)?.error || error?.message);
      setDone(true);
      confetti({ particleCount: 140, spread: 80, origin: { y: 0.6 } });
    } catch (err: any) {
      toast.error("Erro ao enviar: " + (err?.message || err));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }
  if (notFound) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center"><CardContent className="p-8"><h2 className="text-xl font-semibold mb-2">Cadastro não encontrado</h2><p className="text-muted-foreground">Este link não é válido ou expirou.</p></CardContent></Card>
      </div>
    );
  }
  if (done) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center"><CardContent className="p-8">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4"><PartyPopper className="h-8 w-8 text-green-600" /></div>
          <h2 className="text-2xl font-bold mb-2">Cadastro concluído!</h2>
          <p className="text-muted-foreground">Bem-vindo(a) ao time, {name.split(" ")[0]}! Recebemos seus dados. Em breve a equipe entra em contato com os próximos passos.</p>
        </CardContent></Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader className="text-center">
            <div className="w-14 h-14 rounded-full bg-green-500/15 flex items-center justify-center mx-auto mb-2"><PartyPopper className="h-7 w-7 text-green-600" /></div>
            <CardTitle className="text-2xl">Parabéns, {name.split(" ")[0]}!</CardTitle>
            <CardDescription>Você foi aprovado(a). Preencha seu cadastro de contratação pra darmos início.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-1"><Label>CPF *</Label><Input value={f.cpf} onChange={e => setF({ ...f, cpf: e.target.value })} placeholder="000.000.000-00" required /></div>
                <div className="space-y-1"><Label>CNPJ (PJ)</Label><Input value={f.cnpj} onChange={e => setF({ ...f, cnpj: e.target.value })} placeholder="00.000.000/0001-00" /></div>
              </div>
              <div className="space-y-1"><Label>Endereço (rua e número) *</Label><Input value={f.address} onChange={e => setF({ ...f, address: e.target.value })} placeholder="Rua, número, complemento" required /></div>
              <div className="grid md:grid-cols-3 gap-4">
                <div className="space-y-1"><Label>Bairro</Label><Input value={f.neighborhood} onChange={e => setF({ ...f, neighborhood: e.target.value })} /></div>
                <div className="space-y-1"><Label>Cidade *</Label><Input value={f.city} onChange={e => setF({ ...f, city: e.target.value })} required /></div>
                <div className="space-y-1"><Label>Estado (UF) *</Label><Input value={f.state} onChange={e => setF({ ...f, state: e.target.value })} required /></div>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-1"><Label>Conta PJ (banco / agência / conta)</Label><Input value={f.bank_info} onChange={e => setF({ ...f, bank_info: e.target.value })} placeholder="Banco, agência, conta" /></div>
                <div className="space-y-1"><Label>Chave PIX</Label><Input value={f.pix_key} onChange={e => setF({ ...f, pix_key: e.target.value })} placeholder="CPF, e-mail, telefone ou aleatória" /></div>
              </div>
              <div className="space-y-1">
                <Label>Foto profissional</Label>
                <div className="border-2 border-dashed rounded-lg p-4 text-center hover:border-primary/50 transition-colors">
                  <input id="photo" type="file" accept="image/*" onChange={e => setPhoto(e.target.files?.[0] || null)} className="hidden" />
                  <label htmlFor="photo" className="cursor-pointer">
                    {photo ? (
                      <div className="flex items-center justify-center gap-2 text-primary"><FileCheck className="h-5 w-5" /><span>{photo.name}</span></div>
                    ) : (
                      <div className="text-muted-foreground"><Upload className="h-7 w-7 mx-auto mb-1" /><p className="text-sm">Clique para enviar sua foto</p></div>
                    )}
                  </label>
                </div>
              </div>
              <Button type="submit" size="lg" className="w-full gap-2" disabled={submitting}>
                {submitting ? <><Loader2 className="h-4 w-4 animate-spin" />Enviando...</> : <><CheckCircle2 className="h-4 w-4" />Concluir cadastro</>}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
