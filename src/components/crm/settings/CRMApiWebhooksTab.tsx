// Aba "API e Webhooks" das Configurações do CRM (só master/admin da UNV).
// Entrada: chaves de API pras functions receive-external-lead e update-lead-status.
import { CRMApiKeysCard } from "./CRMApiKeysCard";

interface Props {
  pipelines: { id: string; name: string; is_active?: boolean }[];
  isMaster: boolean;
}

export function CRMApiWebhooksTab({ pipelines, isMaster }: Props) {
  const ativos = pipelines.filter((p) => p.is_active !== false);
  return (
    <div className="space-y-6">
      {/* a documentação (/crm/api) só abre pra master */}
      <CRMApiKeysCard pipelines={ativos} showDocsLink={isMaster} />
    </div>
  );
}
