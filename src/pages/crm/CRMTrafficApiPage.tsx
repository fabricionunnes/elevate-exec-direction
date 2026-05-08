import { CRMTrafficApiDocs } from "@/components/crm/traffic/CRMTrafficApiDocs";
import { useCRMContext } from "./CRMLayout";
import { Navigate } from "react-router-dom";

const CRMTrafficApiPage = () => {
  const { isMaster } = useCRMContext();
  if (!isMaster) return <Navigate to="/crm" replace />;
  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <CRMTrafficApiDocs />
    </div>
  );
};

export default CRMTrafficApiPage;
