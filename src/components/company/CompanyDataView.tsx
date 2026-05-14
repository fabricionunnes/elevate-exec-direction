import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Building2,
  Phone,
  Mail,
  Globe,
  MapPin,
  CreditCard,
  User,
  Users,
  Copy,
  ExternalLink,
  Hash,
  Calendar,
  Briefcase,
} from "lucide-react";
import { toast } from "sonner";

interface Stakeholder {
  name: string;
  role: string;
  email: string;
  phone: string;
}

interface CompanyDataViewProps {
  form: {
    name: string;
    cnpj: string;
    segment: string;
    website: string;
    phone: string;
    email: string;
    address: string;
    address_number: string;
    address_complement: string;
    address_neighborhood: string;
    address_zipcode: string;
    address_city: string;
    address_state: string;
    company_description: string;
    stakeholders: Stakeholder[];
    owner_name: string;
    owner_phone: string;
    owner_cpf: string;
    owner_rg: string;
    owner_marital_status: string;
    kickoff_date: string;
    contract_start_date: string;
    contract_end_date: string;
    contract_value: string;
    billing_day: string;
    status: string;
  };
  staffList: { id: string; name: string; role: string }[];
  csId: string;
  consultantId: string;
}

function Field({ label, value, icon: Icon, copyable, href }: {
  label: string;
  value?: string | null;
  icon?: React.ComponentType<{ className?: string }>;
  copyable?: boolean;
  href?: string;
}) {
  if (!value) return null;

  const copy = () => {
    navigator.clipboard.writeText(value);
    toast.success("Copiado!");
  };

  return (
    <div className="flex items-start gap-3 py-2.5">
      {Icon && (
        <div className="mt-0.5 shrink-0 w-7 h-7 rounded-md bg-muted flex items-center justify-center">
          <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-0.5">{label}</p>
        <div className="flex items-center gap-1.5">
          {href ? (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-primary hover:underline flex items-center gap-1 truncate"
            >
              {value}
              <ExternalLink className="h-3 w-3 shrink-0" />
            </a>
          ) : (
            <p className="text-sm font-medium truncate">{value}</p>
          )}
          {copyable && (
            <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0" onClick={copy}>
              <Copy className="h-3 w-3 text-muted-foreground" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({ title, icon: Icon, children }: {
  title: string;
  icon?: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <Card className="border-border/50">
      <CardHeader className="pb-2 pt-4 px-5">
        <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
          {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-5 pb-4 divide-y divide-border/40">
        {children}
      </CardContent>
    </Card>
  );
}

function formatCurrency(val: string) {
  const n = parseFloat(val);
  if (isNaN(n)) return val;
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);
}

function formatDate(val: string) {
  if (!val) return "";
  const [y, m, d] = val.split("-");
  if (!y || !m || !d) return val;
  return `${d}/${m}/${y}`;
}

const MARITAL_MAP: Record<string, string> = {
  solteiro: "Solteiro(a)",
  casado: "Casado(a)",
  divorciado: "Divorciado(a)",
  viuvo: "Viúvo(a)",
  uniao_estavel: "União Estável",
};

export function CompanyDataView({ form, staffList, csId, consultantId }: CompanyDataViewProps) {
  const cs = staffList.find(s => s.id === csId);
  const consultant = staffList.find(s => s.id === consultantId);

  const fullAddress = [
    form.address,
    form.address_number,
    form.address_complement,
    form.address_neighborhood,
    form.address_city,
    form.address_state,
    form.address_zipcode,
  ]
    .filter(Boolean)
    .join(", ");

  const cnpjRaw = form.cnpj.replace(/\D/g, "");
  const cnpjLink = cnpjRaw.length === 14
    ? `https://www.gov.br/receitafederal/pt-br/assuntos/orientacao-tributaria/cadastros/consultas/dados-publicos-cnpj`
    : undefined;

  return (
    <div className="space-y-4">
      {/* Header badge */}
      {form.status && (
        <div className="flex items-center gap-2">
          <Badge variant={form.status === "active" ? "default" : "secondary"}>
            {form.status === "active" ? "Ativa" : form.status === "inactive" ? "Inativa" : form.status}
          </Badge>
          {form.segment && (
            <Badge variant="outline" className="text-xs">
              {form.segment}
            </Badge>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Identificação */}
        <Section title="Identificação" icon={Building2}>
          <Field label="Razão Social / Nome" value={form.name} icon={Building2} copyable />
          <Field label="CNPJ" value={form.cnpj} icon={Hash} copyable href={cnpjLink} />
          <Field label="Segmento" value={form.segment} icon={Briefcase} />
          {form.company_description && (
            <div className="py-2.5">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1">Descrição</p>
              <p className="text-sm text-muted-foreground leading-relaxed">{form.company_description}</p>
            </div>
          )}
        </Section>

        {/* Contato */}
        <Section title="Contato" icon={Phone}>
          <Field label="Telefone" value={form.phone} icon={Phone} copyable
            href={form.phone ? `tel:${form.phone.replace(/\D/g, "")}` : undefined} />
          <Field label="E-mail" value={form.email} icon={Mail} copyable
            href={form.email ? `mailto:${form.email}` : undefined} />
          <Field label="Website" value={form.website} icon={Globe} copyable
            href={form.website ? (form.website.startsWith("http") ? form.website : `https://${form.website}`) : undefined} />
        </Section>

        {/* Endereço */}
        {fullAddress && (
          <Section title="Endereço" icon={MapPin}>
            {form.address && <Field label="Logradouro" value={`${form.address}${form.address_number ? ", " + form.address_number : ""}${form.address_complement ? " - " + form.address_complement : ""}`} icon={MapPin} />}
            {form.address_neighborhood && <Field label="Bairro" value={form.address_neighborhood} icon={MapPin} />}
            {(form.address_city || form.address_state) && (
              <Field label="Cidade / Estado" value={[form.address_city, form.address_state].filter(Boolean).join(" — ")} icon={MapPin} />
            )}
            {form.address_zipcode && <Field label="CEP" value={form.address_zipcode} icon={MapPin} copyable />}
            {fullAddress && (
              <div className="pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs h-7"
                  onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`, "_blank")}
                >
                  <MapPin className="h-3.5 w-3.5" />
                  Ver no Google Maps
                  <ExternalLink className="h-3 w-3" />
                </Button>
              </div>
            )}
          </Section>
        )}

        {/* Sócio / Proprietário */}
        {form.owner_name && (
          <Section title="Proprietário / Sócio" icon={User}>
            <Field label="Nome" value={form.owner_name} icon={User} copyable />
            <Field label="Telefone" value={form.owner_phone} icon={Phone} copyable
              href={form.owner_phone ? `tel:${form.owner_phone.replace(/\D/g, "")}` : undefined} />
            <Field label="CPF" value={form.owner_cpf} icon={CreditCard} copyable />
            <Field label="RG" value={form.owner_rg} icon={CreditCard} />
            <Field label="Estado Civil" value={MARITAL_MAP[form.owner_marital_status] || form.owner_marital_status} />
          </Section>
        )}

        {/* Equipe UNV */}
        {(cs || consultant) && (
          <Section title="Equipe UNV Responsável" icon={Users}>
            {consultant && <Field label="Consultor" value={consultant.name} icon={User} />}
            {cs && <Field label="Customer Success" value={cs.name} icon={User} />}
          </Section>
        )}

        {/* Contrato */}
        {(form.kickoff_date || form.contract_start_date || form.contract_value) && (
          <Section title="Contrato" icon={Calendar}>
            <Field label="Data de Kickoff" value={form.kickoff_date ? formatDate(form.kickoff_date) : ""} icon={Calendar} />
            <Field label="Início do Contrato" value={form.contract_start_date ? formatDate(form.contract_start_date) : ""} icon={Calendar} />
            <Field label="Término do Contrato" value={form.contract_end_date ? formatDate(form.contract_end_date) : ""} icon={Calendar} />
            <Field label="Valor do Contrato" value={form.contract_value ? formatCurrency(form.contract_value) : ""} icon={CreditCard} />
            <Field label="Dia de Faturamento" value={form.billing_day ? `Todo dia ${form.billing_day}` : ""} icon={Calendar} />
          </Section>
        )}
      </div>

      {/* Stakeholders */}
      {form.stakeholders && form.stakeholders.length > 0 && (
        <Card className="border-border/50">
          <CardHeader className="pb-2 pt-4 px-5">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              Stakeholders ({form.stakeholders.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {form.stakeholders.map((s, i) => (
                <div key={i} className="rounded-lg border border-border/50 p-3 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium text-sm truncate">{s.name}</p>
                    {s.role && <Badge variant="outline" className="text-[10px] shrink-0">{s.role}</Badge>}
                  </div>
                  {s.phone && (
                    <a href={`tel:${s.phone.replace(/\D/g, "")}`} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                      <Phone className="h-3 w-3" /> {s.phone}
                    </a>
                  )}
                  {s.email && (
                    <a href={`mailto:${s.email}`} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                      <Mail className="h-3 w-3" /> {s.email}
                    </a>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
