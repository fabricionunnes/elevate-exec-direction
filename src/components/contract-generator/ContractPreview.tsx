import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CheckCircle2, Package } from "lucide-react";
import { productDetails } from "@/data/productDetails";
import { formatCurrencyWithWords, formatCurrencyBR } from "@/lib/numberToWords";
import type { ContractFormData } from "./ContractForm";

interface ContractPreviewProps {
  formData: ContractFormData;
}

export default function ContractPreview({ formData }: ContractPreviewProps) {
  const selectedProduct = formData.productId
    ? productDetails[formData.productId]
    : null;

  const installmentValue =
    formData.contractValue > 0 && formData.installments > 0
      ? formData.contractValue / formData.installments
      : 0;

  const paymentMethodLabels = {
    card: "Cartão de Crédito",
    pix: "PIX",
    boleto: "Boleto Bancário",
  };

  if (!selectedProduct) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Package className="h-5 w-5" />
            Preview do Contrato
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Package className="h-12 w-12 mb-4 opacity-50" />
            <p className="text-center">
              Selecione um produto para visualizar os entregáveis
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Package className="h-5 w-5" />
          Preview do Contrato
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Produto Selecionado */}
        <div>
          <h3 className="font-semibold text-primary mb-2">{selectedProduct.name}</h3>
          <p className="text-sm text-muted-foreground">{selectedProduct.tagline}</p>
        </div>

        <Separator />

        {/* Entregáveis */}
        <div>
          <h4 className="font-medium mb-3">Entregáveis Inclusos</h4>
          <ul className="space-y-2">
            {selectedProduct.deliverables.map((item, index) => (
              <li key={index} className="flex items-start gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <Separator />

        {/* Condições Comerciais */}
        <div>
          <h4 className="font-medium mb-3">Condições Comerciais</h4>
          <div className="space-y-3 text-sm">
            {formData.contractValue > 0 && (
              <div className="p-3 bg-muted rounded-lg">
                <p className="font-medium text-foreground mb-1">Valor Total</p>
                <p className="text-muted-foreground">
                  {formatCurrencyWithWords(formData.contractValue)}
                </p>
              </div>
            )}

            {formData.installments > 1 && installmentValue > 0 && (
              <div className="p-3 bg-muted rounded-lg">
                <p className="font-medium text-foreground mb-1">
                  {formData.installments}x sem juros
                </p>
                <p className="text-muted-foreground">
                  {formatCurrencyWithWords(installmentValue)}
                </p>
              </div>
            )}

            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Forma de Pagamento:</span>
              <Badge variant="secondary">
                {paymentMethodLabels[formData.paymentMethod]}
              </Badge>
            </div>
          </div>
        </div>

        {/* Cliente */}
        {formData.clientName && (
          <>
            <Separator />
            <div>
              <h4 className="font-medium mb-3">Contratante</h4>
              <div className="text-sm space-y-1 text-muted-foreground">
                <p className="font-medium text-foreground">{formData.clientName}</p>
                {formData.clientDocument && <p>Doc: {formData.clientDocument}</p>}
                {formData.clientStreet && (
                  <p>{formData.clientStreet}{formData.clientNumber ? `, nº ${formData.clientNumber}` : ""}, {formData.clientNeighborhood}, {formData.clientCity} - {formData.clientState}, CEP {formData.clientCep}</p>
                )}
                {formData.clientEmail && <p>{formData.clientEmail}</p>}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
