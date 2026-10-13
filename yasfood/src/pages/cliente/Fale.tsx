// Sugestão, reclamação ou elogio. Com nome e WhatsApp, ou anônimo.
import { useState } from "react";
import { Link } from "react-router-dom";
import { MessageSquareHeart, Send, CheckCircle2 } from "lucide-react";
import { clsx } from "clsx";
import { supabase, friendlyError } from "@/lib/supabase";
import { formatPhone, onlyDigits } from "@/lib/format";
import { Button, Input, Textarea, useToast } from "@/components/ui";

type Kind = "sugestao" | "reclamacao" | "elogio";
const KINDS: { k: Kind; label: string; hint: string }[] = [
  { k: "sugestao", label: "Sugestão", hint: "um sabor novo, um horário, uma ideia" },
  { k: "reclamacao", label: "Reclamação", hint: "algo que não foi bem, me conta" },
  { k: "elogio", label: "Elogio", hint: "o que você gostou" },
];

export default function Fale() {
  const toast = useToast();
  const [kind, setKind] = useState<Kind>("sugestao");
  const [message, setMessage] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async () => {
    if (message.trim().length < 5) return toast("Escreva a mensagem.", "err");
    if (!anonymous && phone && onlyDigits(phone).length < 10) return toast("WhatsApp incompleto: DDD + número, ou deixe em branco.", "err");
    setBusy(true);
    const { error } = await supabase.rpc("send_feedback", { p: { kind, message: message.trim(), anonymous, name: anonymous ? "" : name.trim(), phone: anonymous ? "" : onlyDigits(phone) } });
    setBusy(false);
    if (error) return toast(friendlyError(error), "err");
    setSent(true);
  };

  if (sent) {
    return (
      <div className="mx-auto max-w-md rounded-3xl border border-choco-100 bg-white p-6 text-center shadow-card">
        <CheckCircle2 className="mx-auto text-emerald-600" size={44} />
        <h1 className="mt-3 text-xl font-black text-choco-900">Recebido, obrigada!</h1>
        <p className="mt-2 text-sm text-choco-600">
          {kind === "reclamacao" ? "Sinto muito pelo que aconteceu. Vou ler com atenção e, se você deixou o WhatsApp, te respondo pessoalmente." : "A Yas lê tudo. Se você deixou o WhatsApp, pode ser que ela te responda."}
        </p>
        <div className="mt-4 flex flex-col gap-2">
          <Button onClick={() => { setSent(false); setMessage(""); }}>Mandar outra</Button>
          <Link to="/" className="text-sm font-semibold text-vinho-600 underline">Voltar pro cardápio</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-4">
      <div className="text-center">
        <MessageSquareHeart className="mx-auto text-vinho-600" size={36} />
        <h1 className="mt-2 text-2xl font-black text-choco-900">Fale com a Yas</h1>
        <p className="text-sm text-choco-600">Sugestão, reclamação ou elogio. Pode se identificar ou mandar anônimo, do jeito que preferir.</p>
      </div>

      <section className="space-y-3 rounded-2xl border border-choco-100 bg-white p-4 shadow-card">
        <div className="grid grid-cols-3 gap-2">
          {KINDS.map((o) => (
            <button key={o.k} type="button" onClick={() => setKind(o.k)} className={clsx("rounded-2xl border p-3 text-sm font-semibold", kind === o.k ? "border-vinho-600 bg-vinho-50 ring-2 ring-vinho-300" : "border-choco-100")}>
              {o.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-choco-500">{KINDS.find((o) => o.k === kind)?.hint}</p>
        <Textarea label="Sua mensagem" value={message} onChange={(e) => setMessage(e.target.value)} placeholder={kind === "reclamacao" ? "Conta o que aconteceu: qual pedido, qual dia, o que deu errado." : "Escreve aqui."} rows={5} maxLength={2000} />

        <label className="flex items-center gap-2 rounded-xl bg-choco-50 p-3 text-sm">
          <input type="checkbox" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} />
          <span><b>Mandar anônimo</b> <span className="text-choco-500">(sem nome nem telefone)</span></span>
        </label>

        {!anonymous && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Input label="Seu nome (opcional)" value={name} onChange={(e) => setName(e.target.value)} />
            <Input label="WhatsApp (opcional, pra te responder)" inputMode="tel" value={phone ? formatPhone(phone) : ""} onChange={(e) => setPhone(e.target.value)} placeholder="(31) 9xxxx-xxxx" />
          </div>
        )}

        <Button className="w-full" loading={busy} onClick={submit}><Send size={16} /> Enviar</Button>
      </section>
    </div>
  );
}
