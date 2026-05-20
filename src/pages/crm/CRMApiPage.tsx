import { ClientCRMApiDocs } from "@/components/client-crm/ClientCRMApiDocs";
import { WhatsAppSendApiDocs } from "@/components/financial-api/WhatsAppSendApiDocs";
import { JobOpeningApiDocs } from "@/components/people-api/JobOpeningApiDocs";
import { useCRMContext } from "./CRMLayout";
import { Navigate } from "react-router-dom";

const CRMApiPage = () => {
  const { isMaster } = useCRMContext();

  if (!isMaster) return <Navigate to="/crm" replace />;

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-12">
      <ClientCRMApiDocs />
      <WhatsAppSendApiDocs />
      <JobOpeningApiDocs />
    </div>
  );
};

export default CRMApiPage;
