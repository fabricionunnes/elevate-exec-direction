import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ScrollToTop } from "./components/ScrollToTop";
import ErrorBoundary from "./components/ErrorBoundary";
import HomePage from "./pages/HomePage";
import HowItWorksPage from "./pages/HowItWorksPage";
import ProductsPage from "./pages/ProductsPage";
import SalesAccelerationPage from "./pages/SalesAccelerationPage";
import CorePage from "./pages/CorePage";
import ControlPage from "./pages/ControlPage";
import GrowthRoomPage from "./pages/GrowthRoomPage";
import PartnersPage from "./pages/PartnersPage";
import SalesOpsPage from "./pages/SalesOpsPage";
import AISalesSystemPage from "./pages/AISalesSystemPage";
import FractionalCROPage from "./pages/FractionalCROPage";
import ExecutionPartnershipPage from "./pages/ExecutionPartnershipPage";
import AdsPage from "./pages/AdsPage";
import SocialPage from "./pages/SocialPage";
import SalesForcePage from "./pages/SalesForcePage";
import MastermindPage from "./pages/MastermindPage";
import MastermindApplyPage from "./pages/MastermindApplyPage";
import MastermindApplicationsPage from "./pages/MastermindApplicationsPage";
import LeadershipPage from "./pages/LeadershipPage";
import LeDesirPage from "./pages/LeDesirPage";
import FinancePage from "./pages/FinancePage";
import PeoplePage from "./pages/PeoplePage";
import SafePage from "./pages/SafePage";
import ForClosersPage from "./pages/ForClosersPage";
import ClientDiagnosticPage from "./pages/ClientDiagnosticPage";
import ApplyPage from "./pages/ApplyPage";
import FAQPage from "./pages/FAQPage";
import TermsPage from "./pages/TermsPage";
import ComparePage from "./pages/ComparePage";
import PricingPage from "./pages/PricingPage";
import DiagnosticResponsesPage from "./pages/DiagnosticResponsesPage";
import AdminSetupPage from "./pages/AdminSetupPage";
import AdminPage from "./pages/AdminPage";
import NotFound from "./pages/NotFound";

// Portal pages
import PortalLandingPage from "./pages/portal/PortalLandingPage";
import PortalLoginPage from "./pages/portal/PortalLoginPage";
import PortalSignupPage from "./pages/portal/PortalSignupPage";
import PortalAppLayout from "./pages/portal/PortalAppLayout";
import PortalHomePage from "./pages/portal/PortalHomePage";
import PortalPlanningWizard from "./pages/portal/PortalPlanningWizard";
import PortalDashboardPage from "./pages/portal/PortalDashboardPage";
import PortalConfigPage from "./pages/portal/PortalConfigPage";
import PortalCoachPage from "./pages/portal/PortalCoachPage";
import PortalExecutionPage from "./pages/portal/PortalExecutionPage";
import PortalAdminPage from "./pages/portal/PortalAdminPage";
import PortalPlanVersionPage from "./pages/portal/PortalPlanVersionPage";

// Onboarding pages
import OnboardingPage from "./pages/OnboardingPage";
import OnboardingProductPage from "./pages/OnboardingProductPage";
import OnboardingTasksPage from "./pages/onboarding-tasks/OnboardingTasksPage";
import OnboardingProjectPage from "./pages/onboarding-tasks/OnboardingProjectPage";
import OnboardingCompaniesPage from "./pages/onboarding-tasks/OnboardingCompaniesPage";
import OnboardingCompanyDetailPage from "./pages/onboarding-tasks/OnboardingCompanyDetailPage";
import OnboardingStaffPage from "./pages/onboarding-tasks/OnboardingStaffPage";
import ClientOnboardingPage from "./pages/onboarding-tasks/ClientOnboardingPage";
import OnboardingLoginPage from "./pages/onboarding-tasks/OnboardingLoginPage";
import OnboardingNewCompanyPage from "./pages/onboarding-tasks/OnboardingNewCompanyPage";
import OnboardingServicesPage from "./pages/onboarding-tasks/OnboardingServicesPage";
import OnboardingServiceTemplatesPage from "./pages/onboarding-tasks/OnboardingServiceTemplatesPage";
import OnboardingBulkTemplatesPage from "./pages/onboarding-tasks/OnboardingBulkTemplatesPage";
import OnboardingImportPage from "./pages/onboarding-tasks/OnboardingImportPage";
import VirtualOfficePage from "./pages/onboarding-tasks/VirtualOfficePage";
import CACFormPage from "./pages/onboarding-tasks/CACFormPage";
import RescheduleTasks from "./pages/onboarding-tasks/RescheduleTasks";
import KickoffFormPage from "./pages/onboarding-tasks/KickoffFormPage";
import OnboardingRenewalsPage from "./pages/onboarding-tasks/OnboardingRenewalsPage";
import OnboardingActivityHistoryPage from "./pages/onboarding-tasks/OnboardingActivityHistoryPage";
import KPIEntryPage from "./pages/onboarding-tasks/KPIEntryPage";
import NPSSurveyPage from "./pages/NPSSurveyPage";
import DISCAssessmentPage from "./pages/assessments/DISCAssessmentPage";
import Assessment360Page from "./pages/assessments/Assessment360Page";
import AssessmentReportsPage from "./pages/assessments/AssessmentReportsPage";
import UnifiedAssessmentPage from "./pages/assessments/UnifiedAssessmentPage";
import { OnboardingStaffLayout } from "./components/onboarding-tasks/OnboardingStaffLayout";

// Loading fallback component
const PageLoader = () => (
  <div className="min-h-screen bg-background flex items-center justify-center">
    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
  </div>
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
    },
  },
});

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <ScrollToTop />
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/how-it-works" element={<HowItWorksPage />} />
            <Route path="/products" element={<ProductsPage />} />
            <Route path="/sales-acceleration" element={<SalesAccelerationPage />} />
            <Route path="/core" element={<CorePage />} />
            <Route path="/control" element={<ControlPage />} />
            <Route path="/growth-room" element={<GrowthRoomPage />} />
            <Route path="/partners" element={<PartnersPage />} />
            <Route path="/sales-ops" element={<SalesOpsPage />} />
            <Route path="/ai-sales-system" element={<AISalesSystemPage />} />
            <Route path="/fractional-cro" element={<FractionalCROPage />} />
            <Route path="/execution-partnership" element={<ExecutionPartnershipPage />} />
            <Route path="/ads" element={<AdsPage />} />
            <Route path="/social" element={<SocialPage />} />
            <Route path="/sales-force" element={<SalesForcePage />} />
            <Route path="/mastermind" element={<MastermindPage />} />
            <Route path="/mastermind/apply" element={<MastermindApplyPage />} />
            <Route path="/mastermind/applications" element={<MastermindApplicationsPage />} />
            <Route path="/leadership" element={<LeadershipPage />} />
            <Route path="/le-desir" element={<LeDesirPage />} />
            <Route path="/finance" element={<FinancePage />} />
            <Route path="/people" element={<PeoplePage />} />
            <Route path="/safe" element={<SafePage />} />
            <Route path="/for-closers" element={<ForClosersPage />} />
            <Route path="/diagnostico" element={<ClientDiagnosticPage />} />
            <Route path="/apply" element={<ClientDiagnosticPage />} />
            <Route path="/faq" element={<FAQPage />} />
            <Route path="/terms" element={<TermsPage />} />
            <Route path="/compare" element={<ComparePage />} />
            <Route path="/pricing" element={<PricingPage />} />
            <Route path="/diagnostic-responses" element={<DiagnosticResponsesPage />} />
            <Route path="/admin-setup" element={<AdminSetupPage />} />
            <Route path="/admin" element={<AdminPage />} />
            
            {/* Onboarding CS */}
            <Route path="/onboarding" element={<OnboardingPage />} />
            <Route path="/onboarding/:productId" element={<OnboardingProductPage />} />
            
            {/* Staff pages with global notifications */}
            <Route element={<OnboardingStaffLayout />}>
              <Route path="/onboarding-tasks" element={<OnboardingTasksPage />} />
              <Route path="/onboarding-tasks/login" element={<OnboardingLoginPage />} />
              <Route path="/onboarding-tasks/companies" element={<OnboardingCompaniesPage />} />
              <Route path="/onboarding-tasks/companies/new" element={<OnboardingNewCompanyPage />} />
              <Route path="/onboarding-tasks/companies/:companyId" element={<OnboardingCompanyDetailPage />} />
              <Route path="/onboarding-tasks/staff" element={<OnboardingStaffPage />} />
              <Route path="/onboarding-tasks/services" element={<OnboardingServicesPage />} />
              <Route path="/onboarding-tasks/services/bulk" element={<OnboardingBulkTemplatesPage />} />
              <Route path="/onboarding-tasks/services/:serviceSlug/templates" element={<OnboardingServiceTemplatesPage />} />
              <Route path="/onboarding-tasks/import" element={<OnboardingImportPage />} />
              <Route path="/onboarding-tasks/office" element={<VirtualOfficePage />} />
              <Route path="/onboarding-tasks/reschedule" element={<RescheduleTasks />} />
              <Route path="/onboarding-tasks/renewals" element={<OnboardingRenewalsPage />} />
              <Route path="/onboarding-tasks/activity-history" element={<OnboardingActivityHistoryPage />} />
              <Route path="/onboarding-tasks/:projectId" element={<OnboardingProjectPage />} />
            </Route>
            
            <Route path="/onboarding-client/:projectId" element={<ClientOnboardingPage />} />
            <Route path="/cac-form/:projectId" element={<CACFormPage />} />
            <Route path="/kickoff/:companyId" element={<KickoffFormPage />} />
            <Route path="/nps" element={<NPSSurveyPage />} />
            <Route path="/kpi-entry/:companyId" element={<KPIEntryPage />} />
            <Route path="/disc" element={<DISCAssessmentPage />} />
            <Route path="/360" element={<Assessment360Page />} />
            <Route path="/avaliacao" element={<UnifiedAssessmentPage />} />
            <Route path="/onboarding-tasks/:projectId/reports" element={<AssessmentReportsPage />} />
            
            {/* Portal do Planejamento 2026 */}
            <Route path="/portal" element={<PortalLandingPage />} />
            <Route path="/portal/login" element={<PortalLoginPage />} />
            <Route path="/portal/signup" element={<PortalSignupPage />} />
            <Route path="/portal/app" element={<PortalAppLayout />}>
              <Route index element={<PortalHomePage />} />
              <Route path="planejamento" element={<PortalHomePage />} />
              <Route path="planejamento/:planId" element={<PortalPlanningWizard />} />
              <Route path="dashboard" element={<PortalDashboardPage />} />
              <Route path="execucao" element={<PortalExecutionPage />} />
              <Route path="config" element={<PortalConfigPage />} />
              <Route path="coach" element={<PortalCoachPage />} />
              <Route path="admin" element={<PortalAdminPage />} />
              <Route path="plano/:planId" element={<PortalPlanVersionPage />} />
            </Route>
            
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
