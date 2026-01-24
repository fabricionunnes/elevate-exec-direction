import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { CurrencyInput } from "@/components/ui/currency-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, FileText, Building2, CreditCard, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { productDetails } from "@/data/productDetails";

export interface ContractFormData {
  // Cliente (Empresa)
  clientName: string; // Razão Social ou Nome
  clientDocument: string; // CNPJ ou CPF da empresa
  clientAddress: string;
  clientEmail: string;
  clientPhone: string;
  
  // Responsável Legal
  legalRepName: string;
  legalRepCpf: string;
  legalRepRg: string;
  legalRepMaritalStatus: string;
  legalRepNationality: string;
  legalRepProfession: string;
  
  // Contrato
  productId: string;
  contractValue: number;
  paymentMethod: "card" | "pix" | "boleto";
  installments: number;
  dueDate: Date | undefined;
  startDate: Date | undefined;
}

interface ContractFormProps {
  formData: ContractFormData;
  onChange: (data: ContractFormData) => void;
  onGenerate: () => void;
  isGenerating: boolean;
}

const products = Object.values(productDetails).map((p) => ({
  id: p.id,
  name: p.name,
  tagline: p.tagline,
}));

export default function ContractForm({
  formData,
  onChange,
  onGenerate,
  isGenerating,
}: ContractFormProps) {
  const [showDueDate, setShowDueDate] = useState(formData.paymentMethod !== "card");

  useEffect(() => {
    setShowDueDate(formData.paymentMethod !== "card");
  }, [formData.paymentMethod]);

  const updateField = <K extends keyof ContractFormData>(
    field: K,
    value: ContractFormData[K]
  ) => {
    onChange({ ...formData, [field]: value });
  };

  const formatDocument = (value: string) => {
    const numbers = value.replace(/\D/g, "");
    
    if (numbers.length <= 11) {
      // CPF: 000.000.000-00
      return numbers
        .replace(/(\d{3})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
    } else {
      // CNPJ: 00.000.000/0001-00
      return numbers
        .slice(0, 14)
        .replace(/(\d{2})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d)/, "$1/$2")
        .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
    }
  };

  const formatCpf = (value: string) => {
    const numbers = value.replace(/\D/g, "");
    return numbers
      .slice(0, 11)
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  };

  const isFormValid = () => {
    const requiredFields = [
      formData.clientName,
      formData.clientDocument,
      formData.clientAddress,
      formData.clientEmail,
      formData.legalRepName,
      formData.legalRepCpf,
      formData.legalRepRg,
      formData.legalRepMaritalStatus,
      formData.legalRepProfession,
      formData.productId,
      formData.contractValue > 0,
      formData.installments > 0,
      formData.startDate,
    ];
    
    if (formData.paymentMethod !== "card") {
      requiredFields.push(!!formData.dueDate);
    }
    
    return requiredFields.every(Boolean);
  };

  return (
    <div className="space-y-6">
      {/* Dados da Empresa/Cliente */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Building2 className="h-5 w-5" />
            Dados da Empresa / Cliente
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="clientName">Razão Social / Nome *</Label>
            <Input
              id="clientName"
              value={formData.clientName}
              onChange={(e) => updateField("clientName", e.target.value)}
              placeholder="Nome completo ou razão social"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="clientDocument">CNPJ / CPF *</Label>
            <Input
              id="clientDocument"
              value={formData.clientDocument}
              onChange={(e) => updateField("clientDocument", formatDocument(e.target.value))}
              placeholder="00.000.000/0001-00 ou 000.000.000-00"
              maxLength={18}
            />
          </div>
          
          <div className="md:col-span-2 space-y-2">
            <Label htmlFor="clientAddress">Endereço Completo *</Label>
            <Input
              id="clientAddress"
              value={formData.clientAddress}
              onChange={(e) => updateField("clientAddress", e.target.value)}
              placeholder="Rua, número, bairro, cidade - UF, CEP"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="clientEmail">E-mail *</Label>
            <Input
              id="clientEmail"
              type="email"
              value={formData.clientEmail}
              onChange={(e) => updateField("clientEmail", e.target.value)}
              placeholder="email@empresa.com"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="clientPhone">Telefone</Label>
            <Input
              id="clientPhone"
              value={formData.clientPhone}
              onChange={(e) => updateField("clientPhone", e.target.value)}
              placeholder="(00) 00000-0000"
            />
          </div>
        </CardContent>
      </Card>

      {/* Dados do Responsável Legal */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <User className="h-5 w-5" />
            Responsável Legal
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2 space-y-2">
            <Label htmlFor="legalRepName">Nome Completo *</Label>
            <Input
              id="legalRepName"
              value={formData.legalRepName}
              onChange={(e) => updateField("legalRepName", e.target.value)}
              placeholder="Nome completo do responsável legal"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="legalRepCpf">CPF *</Label>
            <Input
              id="legalRepCpf"
              value={formData.legalRepCpf}
              onChange={(e) => updateField("legalRepCpf", formatCpf(e.target.value))}
              placeholder="000.000.000-00"
              maxLength={14}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="legalRepRg">RG *</Label>
            <Input
              id="legalRepRg"
              value={formData.legalRepRg}
              onChange={(e) => updateField("legalRepRg", e.target.value)}
              placeholder="MG-00.000.000"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="legalRepMaritalStatus">Estado Civil *</Label>
            <Select
              value={formData.legalRepMaritalStatus}
              onValueChange={(value) => updateField("legalRepMaritalStatus", value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent className="bg-background border shadow-lg z-50">
                <SelectItem value="solteiro(a)">Solteiro(a)</SelectItem>
                <SelectItem value="casado(a)">Casado(a)</SelectItem>
                <SelectItem value="divorciado(a)">Divorciado(a)</SelectItem>
                <SelectItem value="viúvo(a)">Viúvo(a)</SelectItem>
                <SelectItem value="união estável">União Estável</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="legalRepNationality">Nacionalidade</Label>
            <Input
              id="legalRepNationality"
              value={formData.legalRepNationality}
              onChange={(e) => updateField("legalRepNationality", e.target.value)}
              placeholder="brasileiro(a)"
            />
          </div>
          
          <div className="md:col-span-2 space-y-2">
            <Label htmlFor="legalRepProfession">Profissão *</Label>
            <Input
              id="legalRepProfession"
              value={formData.legalRepProfession}
              onChange={(e) => updateField("legalRepProfession", e.target.value)}
              placeholder="Ex: Empresário, Médico, Advogado..."
            />
          </div>
        </CardContent>
      </Card>

      {/* Dados do Contrato */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileText className="h-5 w-5" />
            Dados do Contrato
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2 space-y-2">
            <Label htmlFor="product">Produto / Serviço *</Label>
            <Select
              value={formData.productId}
              onValueChange={(value) => updateField("productId", value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o produto" />
              </SelectTrigger>
              <SelectContent>
                {products.map((product) => (
                  <SelectItem key={product.id} value={product.id}>
                    {product.name} - {product.tagline}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="contractValue">Valor Total do Contrato *</Label>
            <CurrencyInput
              id="contractValue"
              value={formData.contractValue}
              onChange={(value) => updateField("contractValue", value)}
              placeholder="0,00"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="installments">Número de Parcelas *</Label>
            <Input
              id="installments"
              type="number"
              min={1}
              max={48}
              value={formData.installments}
              onChange={(e) => updateField("installments", parseInt(e.target.value) || 1)}
              placeholder="1"
            />
          </div>
        </CardContent>
      </Card>

      {/* Forma de Pagamento */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <CreditCard className="h-5 w-5" />
            Forma de Pagamento
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Método de Pagamento *</Label>
            <Select
              value={formData.paymentMethod}
              onValueChange={(value: "card" | "pix" | "boleto") => {
                if (value === "card") {
                  onChange({ ...formData, paymentMethod: value, dueDate: undefined });
                } else {
                  onChange({ ...formData, paymentMethod: value });
                }
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent className="bg-background border shadow-lg z-50">
                <SelectItem value="card">Cartão de Crédito</SelectItem>
                <SelectItem value="pix">PIX</SelectItem>
                <SelectItem value="boleto">Boleto Bancário</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label>Data de Início do Contrato *</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !formData.startDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {formData.startDate ? (
                    format(formData.startDate, "dd/MM/yyyy", { locale: ptBR })
                  ) : (
                    "Selecione a data"
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={formData.startDate}
                  onSelect={(date) => updateField("startDate", date)}
                  locale={ptBR}
                />
              </PopoverContent>
            </Popover>
          </div>
          
          {showDueDate && (
            <div className="space-y-2">
              <Label>Data de Vencimento *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !formData.dueDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formData.dueDate ? (
                      format(formData.dueDate, "dd/MM/yyyy", { locale: ptBR })
                    ) : (
                      "Selecione a data"
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={formData.dueDate}
                    onSelect={(date) => updateField("dueDate", date)}
                    locale={ptBR}
                  />
                </PopoverContent>
              </Popover>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Botão Gerar */}
      <Button
        onClick={onGenerate}
        disabled={!isFormValid() || isGenerating}
        className="w-full"
        size="lg"
      >
        {isGenerating ? "Gerando Contrato..." : "Gerar Contrato"}
      </Button>
    </div>
  );
}
