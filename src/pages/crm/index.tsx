import { CRMLayout, useCRMContext } from "./CRMLayout";
import { CRMDashboardPage } from "./CRMDashboardPage";
import { CRMPipelinePage } from "./CRMPipelinePage";
import { CRMLeadsPage } from "./CRMLeadsPage";
import { CRMLeadDetailPage } from "./CRMLeadDetailPage";
import { CRMActivitiesPage } from "./CRMActivitiesPage";
import { CRMIndicatorsPage } from "./CRMIndicatorsPage";
import { CRMSettingsPage } from "./CRMSettingsPage";
import { CRMInboxPage } from "./CRMInboxPage";
import { CRMTranscriptionsPage } from "./CRMTranscriptionsPage";

// Keep old name for backward compatibility
export const CRMReportsPage = CRMIndicatorsPage;

export {
  CRMLayout,
  useCRMContext,
  CRMDashboardPage,
  CRMPipelinePage,
  CRMLeadsPage,
  CRMLeadDetailPage,
  CRMActivitiesPage,
  CRMIndicatorsPage,
  CRMSettingsPage,
  CRMInboxPage,
  CRMTranscriptionsPage,
};
