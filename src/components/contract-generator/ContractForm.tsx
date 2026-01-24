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
import { CalendarIcon, FileText, Building2, CreditCard } from "lucide-react";
import { cn } from "@/lib/utils";
import { productDetails } from "@/data/productDetails";

export interface ContractFormData {
  // Cliente
  clientName: string;
  clientDocument: string; // CPF ou CNPJ
  clientAddress: string;
  clientEmail: string;
  clientPhone: string;
  
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

  const isFormValid = () => {
    const requiredFields = [
      formData.clientName,
      formData.clientDocument,
      formData.clientAddress,
      formData.clientEmail,
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
      {/* Dados do Cliente */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Building2 className="h-5 w-5" />
            Dados do Cliente
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="clientName">Nome / Razão Social *</Label>
            <Input
              id="clientName"
              value={formData.clientName}
              onChange={(e) => updateField("clientName", e.target.value)}
              placeholder="Nome completo ou razão social"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="clientDocument">CPF / CNPJ *</Label>
            <Input
              id="clientDocument"
              value={formData.clientDocument}
              onChange={(e) => updateField("clientDocument", formatDocument(e.target.value))}
              placeholder="000.000.000-00 ou 00.000.000/0001-00"
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
            <Label htmlFor="clientEmail">E-mail</Label>
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
                updateField("paymentMethod", value);
                if (value === "card") {
                  updateField("dueDate", undefined);
                }
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
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
