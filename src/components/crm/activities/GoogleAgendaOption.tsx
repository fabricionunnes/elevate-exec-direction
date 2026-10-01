import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { CalendarCheck } from "lucide-react";
import { GOOGLE_CONNECT_PATH, isGoogleConnected } from "@/lib/crm/activityGoogleSync";

interface GoogleAgendaOptionProps {
  id: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  /** só faz sentido com data e hora */
  hasDateTime: boolean;
  /** o evento já existe e está na agenda de outra pessoa (reunião agendada pro closer, por exemplo) */
  onOtherCalendar?: boolean;
  /** já existe evento ligado: dá pra manter ou tirar mesmo sem o Google de quem está logado */
  hasEvent?: boolean;
  disabled?: boolean;
}

/**
 * Opção "Enviar pra minha agenda Google" das atividades com horário. Se a pessoa não
 * conectou o Google, mostra o aviso com o link de onde conecta em vez da caixinha.
 */
export function GoogleAgendaOption({
  id, checked, onCheckedChange, hasDateTime, onOtherCalendar = false, hasEvent = false, disabled = false,
}: GoogleAgendaOptionProps) {
  const [connected, setConnected] = useState<boolean | null>(null);

  useEffect(() => {
    let vivo = true;
    isGoogleConnected().then((c) => { if (vivo) setConnected(c); });
    return () => { vivo = false; };
  }, []);

  if (connected === null) return null;

  if (!connected && !hasEvent) {
    return (
      <p className="text-xs text-muted-foreground flex items-start gap-1.5">
        <CalendarCheck className="h-3.5 w-3.5 mt-0.5 shrink-0" />
        <span>
          Pra mandar a atividade pra sua agenda Google, conecte a conta em{" "}
          <Link to={GOOGLE_CONNECT_PATH} className="underline text-foreground">CRM, Escritório</Link>.
        </span>
      </p>
    );
  }

  return (
    <div className="flex items-start gap-2">
      <Checkbox
        id={id}
        className="mt-0.5"
        checked={checked && hasDateTime}
        disabled={disabled || !hasDateTime}
        onCheckedChange={(c) => onCheckedChange(!!c)}
      />
      <Label htmlFor={id} className="text-sm font-normal cursor-pointer leading-snug">
        {hasEvent
          ? (onOtherCalendar ? "Manter na agenda Google de quem recebeu o evento" : "Manter na minha agenda Google")
          : "Enviar pra minha agenda Google"}
        <span className="block text-[11px] text-muted-foreground">
          {!hasDateTime
            ? "Coloque data e hora pra poder enviar."
            : hasEvent
              ? "Mudou o horário aqui, muda lá. Desmarque pra tirar o evento da agenda."
              : "Cria um evento de 30 minutos no horário da atividade."}
        </span>
      </Label>
    </div>
  );
}
