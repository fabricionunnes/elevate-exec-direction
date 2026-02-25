import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CreditCard, RefreshCw, Link2, History, Receipt } from "lucide-react";
import { CompanyChargeForm } from "./CompanyChargeForm";
import { CompanyRecurringCharges } from "./CompanyRecurringCharges";
import { CompanyPaymentLinks } from "./CompanyPaymentLinks";
import { CompanyPaymentHistory } from "./CompanyPaymentHistory";
import { CompanyInvoicesList } from "./CompanyInvoicesList";

interface Props {
  companyId: string;
  companyName: string;
  contractValue?: number;
  billingDay?: number;
  customerEmail?: string;
  customerPhone?: string;
}

export function CompanyFinancialPanel({
  companyId,
  companyName,
  contractValue,
  billingDay,
  customerEmail,
  customerPhone,
}: Props) {
  const [activeTab, setActiveTab] = useState("charge");

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="charge" className="gap-2 text-xs sm:text-sm">
            <CreditCard className="h-4 w-4" />
            <span className="hidden sm:inline">Cobrar</span>
          </TabsTrigger>
          <TabsTrigger value="recurring" className="gap-2 text-xs sm:text-sm">
            <RefreshCw className="h-4 w-4" />
            <span className="hidden sm:inline">Recorrências</span>
          </TabsTrigger>
          <TabsTrigger value="invoices" className="gap-2 text-xs sm:text-sm">
            <Receipt className="h-4 w-4" />
            <span className="hidden sm:inline">Faturas</span>
          </TabsTrigger>
          <TabsTrigger value="links" className="gap-2 text-xs sm:text-sm">
            <Link2 className="h-4 w-4" />
            <span className="hidden sm:inline">Links</span>
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2 text-xs sm:text-sm">
            <History className="h-4 w-4" />
            <span className="hidden sm:inline">Histórico</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="charge" className="mt-4">
          <CompanyChargeForm
            companyId={companyId}
            companyName={companyName}
            contractValue={contractValue}
            customerEmail={customerEmail}
            customerPhone={customerPhone}
          />
        </TabsContent>

        <TabsContent value="recurring" className="mt-4">
          <CompanyRecurringCharges
            companyId={companyId}
            companyName={companyName}
            contractValue={contractValue}
            billingDay={billingDay}
            customerEmail={customerEmail}
            customerPhone={customerPhone}
          />
        </TabsContent>

        <TabsContent value="invoices" className="mt-4">
          <CompanyInvoicesList companyId={companyId} />
        </TabsContent>

        <TabsContent value="links" className="mt-4">
          <CompanyPaymentLinks companyId={companyId} companyName={companyName} />
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <CompanyPaymentHistory companyId={companyId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
