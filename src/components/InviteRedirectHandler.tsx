import { useEffect } from "react";

/**
 * Normaliza links de convite do UNV Office no formato antigo (sem hash):
 *   unvholdings.com.br/onboarding-tasks/unv-office?invite=TOKEN
 * O app usa HashRouter, então sem o # o visitante caía na home. Qualquer
 * ?invite= fora do hash é redirecionado pra rota correta do escritório.
 */
export function InviteRedirectHandler() {
  useEffect(() => {
    const search = window.location.search;
    if (!search) return;
    const invite = new URLSearchParams(search).get("invite");
    if (!invite) return;
    if (window.location.hash.includes("unv-office")) return;
    window.location.replace(
      `${window.location.origin}/#/onboarding-tasks/unv-office?invite=${encodeURIComponent(invite)}`
    );
  }, []);
  return null;
}
