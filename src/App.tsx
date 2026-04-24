import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter, Routes, Route } from "react-router-dom";
import { ScrollToTop } from "./components/ScrollToTop";
import { OAuthRedirectHandler } from "./components/OAuthRedirectHandler";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeCustomizationProvider } from "@/contexts/ThemeCustomizationContext";
import { TenantProvider } from "@/contexts/TenantContext";

// Only HomePage is eager – everything else is lazy
import HomePage from "./pages/HomePage";

// Loading fallback component
const PageLoader = () => (
  <div className="min-h-screen bg-background flex items-center justify-center">
    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
  </div>
);

// ── Lazy page imports ──────────────────────────────────────────────
const HowItWorksPage = lazy(() => import("./pages/HowItWorksPage"));
const ProductsPage = lazy(() => import("./pages/ProductsPage"));
const SalesAccelerationPage = lazy(() => import("./pages/SalesAccelerationPage"));
const CorePage = lazy(() => import("./pages/CorePage"));
const ControlPage = lazy(() => import("./pages/ControlPage"));
const GrowthRoomPage = lazy(() => import("./pages/GrowthRoomPage"));
const PartnersPage = lazy(() => import("./pages/PartnersPage"));
const SalesOpsPage = lazy(() => import("./pages/SalesOpsPage"));
const AISalesSystemPage = lazy(() => import("./pages/AISalesSystemPage"));
const FractionalCROPage = lazy(() => import("./pages/FractionalCROPage"));
const ExecutionPartnershipPage = lazy(() => import("./pages/ExecutionPartnershipPage"));
const AdsPage = lazy(() => import("./pages/AdsPage"));
const SocialPage = lazy(() => import("./pages/SocialPage"));
const SalesForcePage = lazy(() => import("./pages/SalesForcePage"));
const MastermindPage = lazy(() => import("./pages/MastermindPage"));
const MastermindApplyPage = lazy(() => import("./pages/MastermindApplyPage"));
const MastermindApplicationsPage = lazy(() => import("./pages/MastermindApplicationsPage"));
const LeadershipPage = lazy(() => import("./pages/LeadershipPage"));
const LeDesirPage = lazy(() => import("./pages/LeDesirPage"));
const FinancePage = lazy(() => import("./pages/FinancePage"));
const PeoplePage = lazy(() => import("./pages/PeoplePage"));
const SafePage = lazy(() => import("./pages/SafePage"));
const ForClosersPage = lazy(() => import("./pages/ForClosersPage"));
const ClientDiagnosticPage = lazy(() => import("./pages/ClientDiagnosticPage"));
const ApplyPage = lazy(() => import("./pages/ApplyPage"));
const FAQPage = lazy(() => import("./pages/FAQPage"));
const DepoimentosPage = lazy(() => import("./pages/DepoimentosPage"));
const TermsPage = lazy(() => import("./pages/TermsPage"));
const PrivacyPage = lazy(() => import("./pages/PrivacyPage"));
const ComparePage = lazy(() => import("./pages/ComparePage"));
const PricingPage = lazy(() => import("./pages/PricingPage"));
const DiagnosticResponsesPage = lazy(() => import("./pages/DiagnosticResponsesPage"));
const AdminSetupPage = lazy(() => import("./pages/AdminSetupPage"));
const AdminPage = lazy(() => import("./pages/AdminPage"));
const NotFound = lazy(() => import("./pages/NotFound"));
const PaymentLinkPage = lazy(() => import("./pages/PaymentLinkPage"));
const RecebimentosPage = lazy(() => import("./pages/RecebimentosPage"));
const CheckoutPage = lazy(() => import("./pages/CheckoutPage"));
const PublicInvoicePage = lazy(() => import("./pages/PublicInvoicePage"));
const InstagramOAuthCallback = lazy(() => import("./pages/InstagramOAuthCallback"));
const SocialInstagramCallback = lazy(() => import("./pages/social/SocialInstagramCallback"));
const PublicInstagramReportPage = lazy(() => import("./pages/PublicInstagramReportPage"));
const MetaAdsCallbackPage = lazy(() => import("./pages/MetaAdsCallbackPage"));
const GoogleCalendarOAuthCallback = lazy(() => import("./pages/GoogleCalendarOAuthCallback"));
const SystemShowcasePage = lazy(() => import("./pages/SystemShowcasePage"));
const HotseatFormPage = lazy(() => import("./pages/HotseatFormPage"));
const StaffRegistrationPage = lazy(() => import("./pages/StaffRegistrationPage"));
const NPSSurveyPage = lazy(() => import("./pages/NPSSurveyPage"));
const CSATSurveyPage = lazy(() => import("./pages/CSATSurveyPage"));
const PublicPipelineForm = lazy(() => import("./pages/PublicPipelineForm"));
const SessaoEstrategicaPage = lazy(() => import("./pages/SessaoEstrategicaPage"));
const SessaoEstrategicaObrigadoPage = lazy(() => import("./pages/SessaoEstrategicaObrigadoPage"));
const TrafegoPagoPage = lazy(() => import("./pages/TrafegoPagoPage"));
const SocialMediaPage = lazy(() => import("./pages/SocialMediaPage"));
const ServiceSalesPage = lazy(() => import("./pages/ServiceSalesPage"));
const ServicesCatalogPage = lazy(() => import("./pages/ServicesCatalogPage"));
const ScannerVendasUNV = lazy(() => import("./pages/ScannerVendasUNV"));
const ScannerLeadConversao = lazy(() => import("./pages/ScannerLeadConversao"));
const ScannerDiagnosticoConversao = lazy(() => import("./pages/ScannerDiagnosticoConversao"));

// Portal
const PortalLandingPage = lazy(() => import("./pages/portal/PortalLandingPage"));
const PortalLoginPage = lazy(() => import("./pages/portal/PortalLoginPage"));
const PortalSignupPage = lazy(() => import("./pages/portal/PortalSignupPage"));
const PortalAppLayout = lazy(() => import("./pages/portal/PortalAppLayout"));
const PortalHomePage = lazy(() => import("./pages/portal/PortalHomePage"));
const PortalPlanningWizard = lazy(() => import("./pages/portal/PortalPlanningWizard"));
const PortalDashboardPage = lazy(() => import("./pages/portal/PortalDashboardPage"));
const PortalConfigPage = lazy(() => import("./pages/portal/PortalConfigPage"));
const PortalCoachPage = lazy(() => import("./pages/portal/PortalCoachPage"));
const PortalExecutionPage = lazy(() => import("./pages/portal/PortalExecutionPage"));
const PortalAdminPage = lazy(() => import("./pages/portal/PortalAdminPage"));
const PortalPlanVersionPage = lazy(() => import("./pages/portal/PortalPlanVersionPage"));
const PortalStrategiesPage = lazy(() => import("./pages/portal/PortalStrategiesPage"));

// Circle
const CircleLayout = lazy(() => import("./pages/circle/CircleLayout"));
const CircleFeedPage = lazy(() => import("./pages/circle/CircleFeedPage"));
const CircleStoriesPage = lazy(() => import("./pages/circle/CircleStoriesPage"));
const CircleCommunitiesPage = lazy(() => import("./pages/circle/CircleCommunitiesPage"));
const CircleMarketplacePage = lazy(() => import("./pages/circle/CircleMarketplacePage"));
const CircleRankingPage = lazy(() => import("./pages/circle/CircleRankingPage"));
const CircleProfilePage = lazy(() => import("./pages/circle/CircleProfilePage"));
const CircleNotificationsPage = lazy(() => import("./pages/circle/CircleNotificationsPage"));
const CircleCommunityDetailPage = lazy(() => import("./pages/circle/CircleCommunityDetailPage"));
const CircleSettingsPage = lazy(() => import("./pages/circle/CircleSettingsPage"));
const CircleMessagesPage = lazy(() => import("./components/circle/CircleMessagesPage"));
const CircleMentorPage = lazy(() => import("./pages/circle/CircleMentorPage"));
const CircleSavedPostsPage = lazy(() => import("./pages/circle/CircleSavedPostsPage"));
const CircleAdsPage = lazy(() => import("./pages/circle/CircleAdsPage"));
const CircleAuthPage = lazy(() => import("./pages/circle/CircleAuthPage"));

// Onboarding
const OnboardingPage = lazy(() => import("./pages/OnboardingPage"));
const OnboardingProductPage = lazy(() => import("./pages/OnboardingProductPage"));
const OnboardingTasksPage = lazy(() => import("./pages/onboarding-tasks/OnboardingTasksPage"));
const OnboardingProjectPage = lazy(() => import("./pages/onboarding-tasks/OnboardingProjectPage"));
const CommercialActionsDashboardPage = lazy(() => import("./pages/onboarding-tasks/CommercialActionsDashboardPage"));
const OnboardingCompaniesPage = lazy(() => import("./pages/onboarding-tasks/OnboardingCompaniesPage"));
const OnboardingCompanyDetailPage = lazy(() => import("./pages/onboarding-tasks/OnboardingCompanyDetailPage"));
const OnboardingStaffPage = lazy(() => import("./pages/onboarding-tasks/OnboardingStaffPage"));
const ClientOnboardingPage = lazy(() => import("./pages/onboarding-tasks/ClientOnboardingPage"));
const OnboardingLoginPage = lazy(() => import("./pages/onboarding-tasks/OnboardingLoginPage"));
const OnboardingNewCompanyPage = lazy(() => import("./pages/onboarding-tasks/OnboardingNewCompanyPage"));
const OnboardingServicesPage = lazy(() => import("./pages/onboarding-tasks/OnboardingServicesPage"));
const OnboardingServiceTemplatesPage = lazy(() => import("./pages/onboarding-tasks/OnboardingServiceTemplatesPage"));
const OnboardingBulkTemplatesPage = lazy(() => import("./pages/onboarding-tasks/OnboardingBulkTemplatesPage"));
const OnboardingImportPage = lazy(() => import("./pages/onboarding-tasks/OnboardingImportPage"));
const PaymentNotificationsPage = lazy(() => import("./pages/onboarding-tasks/PaymentNotificationsPage"));
const VirtualOfficePage = lazy(() => import("./pages/onboarding-tasks/VirtualOfficePage"));
const UNVOfficePage = lazy(() => import("./pages/onboarding-tasks/UNVOfficePage"));
const CACFormPage = lazy(() => import("./pages/onboarding-tasks/CACFormPage"));
const RescheduleTasks = lazy(() => import("./pages/onboarding-tasks/RescheduleTasks"));
const KickoffFormPage = lazy(() => import("./pages/onboarding-tasks/KickoffFormPage"));
const OnboardingRenewalsPage = lazy(() => import("./pages/onboarding-tasks/OnboardingRenewalsPage"));
const OnboardingCancellationsPage = lazy(() => import("./pages/onboarding-tasks/OnboardingCancellationsPage"));
const CancellationsRetentionModulePage = lazy(() => import("./pages/onboarding-tasks/CancellationsRetentionModulePage"));
const OnboardingActivityHistoryPage = lazy(() => import("./pages/onboarding-tasks/OnboardingActivityHistoryPage"));
const OnboardingCompaniesReportPage = lazy(() => import("./pages/onboarding-tasks/OnboardingCompaniesReportPage"));
const SalesReportPage = lazy(() => import("./pages/onboarding-tasks/SalesReportPage"));
const OnboardingResultsPage = lazy(() => import("./pages/onboarding-tasks/OnboardingResultsPage"));
const KPIEntryPage = lazy(() => import("./pages/onboarding-tasks/KPIEntryPage"));
const HealthScorePage = lazy(() => import("./pages/onboarding-tasks/HealthScorePage"));
const FinancialModulePage = lazy(() => import("./pages/onboarding-tasks/FinancialModulePage"));
const ApiDocsPage = lazy(() => import("./pages/onboarding-tasks/ApiDocsPage"));
const AllRecurringChargesPage = lazy(() => import("./pages/onboarding-tasks/AllRecurringChargesPage"));
const WhatsAppAdminPage = lazy(() => import("./pages/onboarding-tasks/WhatsAppAdminPage"));
const WhatsAppHubPage = lazy(() => import("./pages/onboarding-tasks/WhatsAppHubPage"));
const ClientDisparadorPage = lazy(() => import("./pages/disparador/ClientDisparadorPage"));
const ChurnPredictionPage = lazy(() => import("./pages/onboarding-tasks/ChurnPredictionPage"));
const CohortRetentionPage = lazy(() => import("./pages/onboarding-tasks/CohortRetentionPage"));
const ConsultantEngagementPage = lazy(() => import("./pages/onboarding-tasks/ConsultantEngagementPage"));
const ExecutiveDashboardPage = lazy(() => import("./pages/onboarding-tasks/ExecutiveDashboardPage"));
const CEODashboardPage = lazy(() => import("./pages/onboarding-tasks/CEODashboardPage"));
const LeaderDashboardPage = lazy(() => import("./pages/onboarding-tasks/LeaderDashboardPage"));
const GlobalJobOpeningsPage = lazy(() => import("./pages/onboarding-tasks/GlobalJobOpeningsPage"));
const GlobalTalentPoolResumesPage = lazy(() => import("./pages/onboarding-tasks/GlobalTalentPoolResumesPage"));
const HotseatAdminPage = lazy(() => import("./pages/onboarding-tasks/HotseatAdminPage"));
const ClientAccessReportPage = lazy(() => import("./pages/onboarding-tasks/ClientAccessReportPage"));
const BillingRulesPage = lazy(() => import("./pages/onboarding-tasks/BillingRulesPage"));
const SurveySendConfigPage = lazy(() => import("./pages/onboarding-tasks/SurveySendConfigPage"));
const ContractGeneratorPage = lazy(() => import("./pages/onboarding-tasks/ContractGeneratorPage"));
const EmployeeContractPage = lazy(() => import("./pages/onboarding-tasks/EmployeeContractPage"));
const DistratoPage = lazy(() => import("./pages/onboarding-tasks/DistratoPage"));
const DistratoHistoryPage = lazy(() => import("./pages/onboarding-tasks/DistratoHistoryPage"));
const SegmentsAnalysisPage = lazy(() => import("./pages/onboarding-tasks/SegmentsAnalysisPage"));
const StaffInvoicePage = lazy(() => import("./pages/onboarding-tasks/StaffInvoicePage"));
const GlobalGamificationPage = lazy(() => import("./pages/onboarding-tasks/GlobalGamificationPage"));
const SlideGeneratorPage = lazy(() => import("./pages/onboarding-tasks/SlideGeneratorPage"));
const TaskManagerPage = lazy(() => import("./pages/onboarding-tasks/TaskManagerPage"));
const AutomationsPage = lazy(() => import("./pages/onboarding-tasks/AutomationsPage"));
const B2BProspectionPage = lazy(() => import("./pages/onboarding-tasks/B2BProspectionPage"));
const ConsultoriasAdminPage = lazy(() => import("./pages/onboarding-tasks/ConsultoriasAdminPage"));
const MasterAIConsultPage = lazy(() => import("./pages/onboarding-tasks/MasterAIConsultPage"));

// Assessments
const LegacyDiscRedirect = lazy(() => import("./pages/assessments/LegacyDiscRedirect"));
const Assessment360Page = lazy(() => import("./pages/assessments/Assessment360Page"));
const AssessmentReportsPage = lazy(() => import("./pages/assessments/AssessmentReportsPage"));
const UnifiedAssessmentPage = lazy(() => import("./pages/assessments/UnifiedAssessmentPage"));

// HR
const HrCandidateDiscPage = lazy(() => import("./pages/hr-recruitment/HrCandidateDiscPage"));
const PublicJobApplicationPage = lazy(() => import("./pages/hr-recruitment/PublicJobApplicationPage"));
const PublicTalentPoolPage = lazy(() => import("./pages/hr-recruitment/PublicTalentPoolPage"));
const CultureFormPage = lazy(() => import("./pages/hr-recruitment/CultureFormPage"));
const PublicCareerPlanFormPage = lazy(() => import("./pages/hr-recruitment/PublicCareerPlanFormPage"));
const SocialBriefingPublicPage = lazy(() => import("./pages/public/SocialBriefingPublicPage"));
const PublicRoutineFormPage = lazy(() => import("./pages/routine-contract/PublicRoutineFormPage"));
const TrafficAnalysisPublicPage = lazy(() => import("./pages/public/TrafficAnalysisPublicPage"));
const MarketingConsultationPublicPage = lazy(() => import("./pages/public/MarketingConsultationPublicPage"));
const FinancialConsultationPublicPage = lazy(() => import("./pages/public/FinancialConsultationPublicPage"));
const PublicContractDataPage = lazy(() => import("./pages/public/PublicContractDataPage"));
const PublicAdsBriefingPage = lazy(() => import("./pages/public/PublicAdsBriefingPage"));
const PublicPresentationPage = lazy(() => import("./pages/public/PublicPresentationPage"));
const SlideRemoteControlPage = lazy(() => import("./pages/public/SlideRemoteControlPage"));

// UNV Profile
const UNVProfileLayout = lazy(() => import("./pages/unv-profile/UNVProfileLayout"));
const UNVProfileHomePage = lazy(() => import("./pages/unv-profile/UNVProfileHomePage"));
const UNVProfileDashboardPage = lazy(() => import("./pages/unv-profile/UNVProfileDashboardPage"));
const UNVProfileEmployeesPage = lazy(() => import("./pages/unv-profile/UNVProfileEmployeesPage"));
const UNVProfileRecruitmentPage = lazy(() => import("./pages/unv-profile/UNVProfileRecruitmentPage"));
const UNVProfileRecruitmentPipelinePage = lazy(() => import("./pages/unv-profile/UNVProfileRecruitmentPipelinePage"));
const UNVProfileTalentPoolPage = lazy(() => import("./pages/unv-profile/UNVProfileTalentPoolPage"));
const UNVProfileDISCPage = lazy(() => import("./pages/unv-profile/UNVProfileDISCPage"));
const UNVProfileOnboardingPage = lazy(() => import("./pages/unv-profile/UNVProfileOnboardingPage"));
const UNVProfilePDIPage = lazy(() => import("./pages/unv-profile/UNVProfilePDIPage"));
const UNVProfileCareerPage = lazy(() => import("./pages/unv-profile/UNVProfileCareerPage"));
const UNVProfileTrainingsPage = lazy(() => import("./pages/unv-profile/UNVProfileTrainingsPage"));
const UNVProfileEvaluationsPage = lazy(() => import("./pages/unv-profile/UNVProfileEvaluationsPage"));
const UNVProfileFeedbacksPage = lazy(() => import("./pages/unv-profile/UNVProfileFeedbacksPage"));
const UNVProfilePositionsPage = lazy(() => import("./pages/unv-profile/UNVProfilePositionsPage"));
const UNVProfileOrgChartPage = lazy(() => import("./pages/unv-profile/UNVProfileOrgChartPage"));
const UNVProfileClimatePage = lazy(() => import("./pages/unv-profile/UNVProfileClimatePage"));
const UNVProfileAIPage = lazy(() => import("./pages/unv-profile/UNVProfileAIPage"));
const UNVProfileReportsPage = lazy(() => import("./pages/unv-profile/UNVProfileReportsPage"));
const UNVProfileMePage = lazy(() => import("./pages/unv-profile/UNVProfileMePage"));
const UNVProfileAdminPage = lazy(() => import("./pages/unv-profile/UNVProfileAdminPage"));
const UNVProfileIntegrationsPage = lazy(() => import("./pages/unv-profile/UNVProfileIntegrationsPage"));
const UNVProfilePermissionsPage = lazy(() => import("./pages/unv-profile/UNVProfilePermissionsPage"));

// PDI
const PDILayout = lazy(() => import("./pages/pdi/PDILayout"));
const PDIDashboardPage = lazy(() => import("./pages/pdi/PDIDashboardPage"));
const PDICohortsPage = lazy(() => import("./pages/pdi/PDICohortsPage"));
const PDIApplicationsPage = lazy(() => import("./pages/pdi/PDIApplicationsPage"));
const PDIParticipantsPage = lazy(() => import("./pages/pdi/PDIParticipantsPage"));
const PDITracksPage = lazy(() => import("./pages/pdi/PDITracksPage"));
const PDIEnrollmentPage = lazy(() => import("./pages/pdi/PDIEnrollmentPage"));
const PDITasksPage = lazy(() => import("./pages/pdi/PDITasksPage"));
const PDILibraryPage = lazy(() => import("./pages/pdi/PDILibraryPage"));
const PDIAssessmentsPage = lazy(() => import("./pages/pdi/PDIAssessmentsPage"));
const PDIReportsPage = lazy(() => import("./pages/pdi/PDIReportsPage"));
const PDICertificatesPage = lazy(() => import("./pages/pdi/PDICertificatesPage"));
const PDIRankingPage = lazy(() => import("./pages/pdi/PDIRankingPage"));
const PDICommunityPage = lazy(() => import("./pages/pdi/PDICommunityPage"));
const PDIAttendancePage = lazy(() => import("./pages/pdi/PDIAttendancePage"));
const PDISettingsPage = lazy(() => import("./pages/pdi/PDISettingsPage"));
const PDIParticipantPortalPage = lazy(() => import("./pages/pdi/PDIParticipantPortalPage"));

// Academy
const AcademyLayout = lazy(() => import("./pages/academy/AcademyLayout"));
const AcademyHomePage = lazy(() => import("./pages/academy/AcademyHomePage"));
const AcademyTracksPage = lazy(() => import("./pages/academy/AcademyTracksPage"));
const AcademyTrackDetailPage = lazy(() => import("./pages/academy/AcademyTrackDetailPage"));
const AcademyLessonPage = lazy(() => import("./pages/academy/AcademyLessonPage"));
const AcademyProgressPage = lazy(() => import("./pages/academy/AcademyProgressPage"));
const AcademyRankingPage = lazy(() => import("./pages/academy/AcademyRankingPage"));
const AcademyQuizPage = lazy(() => import("./pages/academy/AcademyQuizPage"));
const AcademyQuizzesListPage = lazy(() => import("./pages/academy/AcademyQuizzesListPage"));
const AcademyTeamPage = lazy(() => import("./pages/academy/AcademyTeamPage"));
const AcademyAdminContentPage = lazy(() => import("./pages/academy/admin/AcademyAdminContentPage"));
const AcademyAdminQuizzesPage = lazy(() => import("./pages/academy/admin/AcademyAdminQuizzesPage"));
const AcademyAdminGamificationPage = lazy(() => import("./pages/academy/admin/AcademyAdminGamificationPage"));
const AcademyAdminAccessPage = lazy(() => import("./pages/academy/admin/AcademyAdminAccessPage"));
const AcademyAdminReportsPage = lazy(() => import("./pages/academy/admin/AcademyAdminReportsPage"));
const AcademyReportsPage = lazy(() => import("./pages/academy/AcademyReportsPage"));
const AcademySettingsPage = lazy(() => import("./pages/academy/AcademySettingsPage"));

// CRM
const CRMLayout = lazy(() => import("./pages/crm").then(m => ({ default: m.CRMLayout })));
const CRMDashboardPage = lazy(() => import("./pages/crm").then(m => ({ default: m.CRMDashboardPage })));
const CRMPipelinePage = lazy(() => import("./pages/crm").then(m => ({ default: m.CRMPipelinePage })));
const CRMLeadsPage = lazy(() => import("./pages/crm").then(m => ({ default: m.CRMLeadsPage })));
const CRMLeadDetailPage = lazy(() => import("./pages/crm").then(m => ({ default: m.CRMLeadDetailPage })));
const CRMActivitiesPage = lazy(() => import("./pages/crm").then(m => ({ default: m.CRMActivitiesPage })));
const CRMReportsPage = lazy(() => import("./pages/crm").then(m => ({ default: m.CRMReportsPage })));
const CRMSettingsPage = lazy(() => import("./pages/crm").then(m => ({ default: m.CRMSettingsPage })));
const CRMInboxPage = lazy(() => import("./pages/crm").then(m => ({ default: m.CRMInboxPage })));
const CRMTranscriptionsPage = lazy(() => import("./pages/crm").then(m => ({ default: m.CRMTranscriptionsPage })));
const CRMOfficePage = lazy(() => import("./pages/crm").then(m => ({ default: m.CRMOfficePage })));
const CRMHeadComercialPage = lazy(() => import("./pages/crm").then(m => ({ default: m.CRMHeadComercialPage })));
const CRMCallSummaryPage = lazy(() => import("./pages/crm").then(m => ({ default: m.CRMCallSummaryPage })));
const CRMMeetingsPage = lazy(() => import("./pages/crm/CRMMeetingsPage"));
const CRMApiPage = lazy(() => import("./pages/crm/CRMApiPage"));
const CRMForecastPage = lazy(() => import("./pages/crm/CRMForecastPage"));
const CRMCadencesPage = lazy(() => import("./pages/crm/CRMCadencesPage"));

// Social Pipeline
const SocialLayoutPage = lazy(() => import("./pages/social").then(m => ({ default: m.SocialLayout })));
const SocialPipelinePageComponent = lazy(() => import("./pages/social").then(m => ({ default: m.SocialPipelinePage })));
const SocialSettingsPageComponent = lazy(() => import("./pages/social").then(m => ({ default: m.SocialSettingsPage })));
const SocialApprovalPageComponent = lazy(() => import("./pages/social").then(m => ({ default: m.SocialApprovalPage })));
const SocialStrategyPageComponent = lazy(() => import("./pages/social").then(m => ({ default: m.SocialStrategyPage })));

// Customer Points
const CustomerPointsLayout = lazy(() => import("./pages/customer-points/CustomerPointsLayout"));
const CustomerPointsDashboard = lazy(() => import("./pages/customer-points/CustomerPointsDashboard"));
const CustomerPointsClients = lazy(() => import("./pages/customer-points/CustomerPointsClients"));
const CustomerPointsRules = lazy(() => import("./pages/customer-points/CustomerPointsRules"));
const CustomerPointsTransactions = lazy(() => import("./pages/customer-points/CustomerPointsTransactions"));
const CustomerPointsQRCodes = lazy(() => import("./pages/customer-points/CustomerPointsQRCodes"));
const CustomerPointsPublicForm = lazy(() => import("./pages/customer-points/CustomerPointsPublicForm"));
const CustomerPointsSalespersonForm = lazy(() => import("./pages/customer-points/CustomerPointsSalespersonForm"));
const CustomerPointsSalespersonTokens = lazy(() => import("./pages/customer-points/CustomerPointsSalespersonTokens"));

// White-Label Admin
const WhitelabelAdminPage = lazy(() => import("./pages/whitelabel/WhitelabelAdminPage"));
const WhitelabelUNVAdminPage = lazy(() => import("./pages/whitelabel/WhitelabelUNVAdminPage"));
const WhitelabelSignupPage = lazy(() => import("./pages/whitelabel/WhitelabelSignupPage"));

import { ModuleGuard } from "./components/whitelabel/ModuleGuard";

// OnboardingStaffLayout needs to be lazy too
const OnboardingStaffLayout = lazy(() => import("./components/onboarding-tasks/OnboardingStaffLayout").then(m => ({ default: m.OnboardingStaffLayout })));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
    },
  },
});

const AppShell = () => {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeCustomizationProvider>
        <TenantProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <HashRouter>
              <ScrollToTop />
              <OAuthRedirectHandler />
              <Suspense fallback={<PageLoader />}>
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
            <Route path="/depoimentos" element={<DepoimentosPage />} />
            <Route path="/terms" element={<TermsPage />} />
            <Route path="/privacidade" element={<PrivacyPage />} />
            <Route path="/privacy" element={<PrivacyPage />} />
            <Route path="/compare" element={<ComparePage />} />
            <Route path="/pricing" element={<PricingPage />} />
            <Route path="/diagnostic-responses" element={<DiagnosticResponsesPage />} />
            <Route path="/admin-setup" element={<AdminSetupPage />} />
            <Route path="/admin" element={<AdminPage />} />
            
            {/* OAuth Callbacks */}
            <Route path="/auth/instagram/callback" element={<InstagramOAuthCallback />} />
            <Route path="/social/instagram-callback" element={<SocialInstagramCallback />} />
            <Route path="/instagram-report/:shareToken" element={<PublicInstagramReportPage />} />
            <Route path="/meta-ads-callback" element={<MetaAdsCallbackPage />} />
            <Route path="/google-calendar-callback" element={<GoogleCalendarOAuthCallback />} />
            
            {/* Onboarding CS */}
            <Route path="/onboarding" element={<OnboardingPage />} />
            <Route path="/onboarding/:productId" element={<OnboardingProductPage />} />
            
            {/* Contract Generator - Public */}
            <Route path="/contratos" element={<ContractGeneratorPage />} />
            <Route path="/contratos/colaboradores" element={<EmployeeContractPage />} />
            <Route path="/distrato" element={<DistratoPage />} />
            <Route path="/distratos" element={<DistratoHistoryPage />} />
            
            {/* Sessão Estratégica */}
            <Route path="/sessao-estrategica" element={<SessaoEstrategicaPage />} />
            <Route path="/sessao-estrategica/obrigado" element={<SessaoEstrategicaObrigadoPage />} />
            <Route path="/trafego-pago" element={<TrafegoPagoPage />} />
            <Route path="/social-media" element={<SocialMediaPage />} />
            
            {/* Service Sales Pages - Public */}
            <Route path="/servicos" element={<ServicesCatalogPage />} />
            <Route path="/servico/:slug" element={<ServiceSalesPage />} />
            
            {/* Public Pipeline Form */}
            <Route path="/form/:token" element={<PublicPipelineForm />} />

            {/* Scanner de Vendas UNV */}
            <Route path="/scanner-vendas" element={<ScannerVendasUNV key="scanner-start" />} />
            <Route path="/scanner-vendas-continuar" element={<ScannerVendasUNV key="scanner-continue" />} />
            <Route path="/scanner-lead-conversao" element={<ScannerLeadConversao />} />
            <Route path="/scanner-diagnostico-conversao" element={<ScannerDiagnosticoConversao />} />
            
            {/* Staff Self-Registration */}
            <Route path="/staff-register/:token" element={<StaffRegistrationPage />} />
            
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
              <Route path="/onboarding-tasks/payment-notifications" element={<PaymentNotificationsPage />} />
              <Route path="/onboarding-tasks/office" element={<VirtualOfficePage />} />
              <Route path="/onboarding-tasks/unv-office" element={<UNVOfficePage />} />
              <Route path="/onboarding-tasks/reschedule" element={<RescheduleTasks />} />
              <Route path="/onboarding-tasks/renewals" element={<OnboardingRenewalsPage />} />
              <Route path="/onboarding-tasks/cancellations" element={<OnboardingCancellationsPage />} />
              <Route path="/onboarding-tasks/cancellations-retention" element={<CancellationsRetentionModulePage />} />
              <Route path="/onboarding-tasks/activity-history" element={<OnboardingActivityHistoryPage />} />
              <Route path="/onboarding-tasks/companies-report" element={<OnboardingCompaniesReportPage />} />
              <Route path="/sales-report" element={<SalesReportPage />} />
              <Route path="/onboarding-tasks/results" element={<OnboardingResultsPage />} />
              <Route path="/onboarding-tasks/financeiro" element={<ModuleGuard module="financial" label="Financeiro"><FinancialModulePage /></ModuleGuard>} />
              <Route path="/onboarding-tasks/api-docs" element={<ApiDocsPage />} />
              <Route path="/onboarding-tasks/financeiro/recorrencias" element={<ModuleGuard module="financial" label="Financeiro"><AllRecurringChargesPage /></ModuleGuard>} />
              <Route path="/onboarding-tasks/whatsapp" element={<WhatsAppAdminPage />} />
              <Route path="/onboarding-tasks/whatsapp-hub" element={<WhatsAppHubPage />} />
              <Route path="/onboarding-tasks/churn-prediction" element={<ChurnPredictionPage />} />
              <Route path="/onboarding-tasks/cohort-retention" element={<CohortRetentionPage />} />
              <Route path="/onboarding-tasks/engagement" element={<ConsultantEngagementPage />} />
              <Route path="/onboarding-tasks/executive" element={<ExecutiveDashboardPage />} />
              <Route path="/onboarding-tasks/vagas" element={<GlobalJobOpeningsPage />} />
              <Route path="/onboarding-tasks/banco-talentos" element={<GlobalTalentPoolResumesPage />} />
              <Route path="/onboarding-tasks/hotseat" element={<HotseatAdminPage />} />
              <Route path="/onboarding-tasks/consultorias" element={<ConsultoriasAdminPage />} />
              <Route path="/onboarding-tasks/client-access" element={<ClientAccessReportPage />} />
              <Route path="/onboarding-tasks/billing-rules" element={<ModuleGuard module="financial" label="Financeiro"><BillingRulesPage /></ModuleGuard>} />
              <Route path="/onboarding-tasks/survey-send-config" element={<SurveySendConfigPage />} />
              <Route path="/onboarding-tasks/segments" element={<SegmentsAnalysisPage />} />
              <Route path="/onboarding-tasks/nota-fiscal" element={<StaffInvoicePage />} />
              <Route path="/onboarding-tasks/gamificacao-geral" element={<GlobalGamificationPage />} />
              <Route path="/onboarding-tasks/slide-generator" element={<SlideGeneratorPage />} />
              <Route path="/onboarding-tasks/task-manager" element={<TaskManagerPage />} />
              <Route path="/onboarding-tasks/automations" element={<AutomationsPage />} />
              <Route path="/onboarding-tasks/b2b-prospection" element={<B2BProspectionPage />} />
              <Route path="/onboarding-tasks/master-ai" element={<MasterAIConsultPage />} />
              <Route path="/onboarding-tasks/:projectId" element={<OnboardingProjectPage />} />
              <Route path="/onboarding-tasks/commercial-actions" element={<CommercialActionsDashboardPage />} />
              <Route path="/onboarding-tasks/:projectId/health-score" element={<HealthScorePage />} />
            </Route>

            {/* UNV Profile - RH completo */}
            <Route path="/unv-profile" element={<UNVProfileLayout />}>
              <Route index element={<UNVProfileHomePage />} />
              <Route path="dashboard" element={<UNVProfileDashboardPage />} />
              <Route path="employees" element={<UNVProfileEmployeesPage />} />
              <Route path="org-chart" element={<UNVProfileOrgChartPage />} />
              <Route path="positions" element={<UNVProfilePositionsPage />} />
              <Route path="recruitment" element={<UNVProfileRecruitmentPage />} />
              <Route path="recruitment/:jobId" element={<UNVProfileRecruitmentPipelinePage />} />
              <Route path="talent-pool" element={<UNVProfileTalentPoolPage />} />
              <Route path="disc" element={<UNVProfileDISCPage />} />
              <Route path="onboarding" element={<UNVProfileOnboardingPage />} />
              <Route path="pdi" element={<UNVProfilePDIPage />} />
              <Route path="career" element={<UNVProfileCareerPage />} />
              <Route path="trainings" element={<UNVProfileTrainingsPage />} />
              <Route path="evaluations" element={<UNVProfileEvaluationsPage />} />
              <Route path="feedbacks" element={<UNVProfileFeedbacksPage />} />
              <Route path="climate" element={<UNVProfileClimatePage />} />
              <Route path="ai" element={<UNVProfileAIPage />} />
              <Route path="reports" element={<UNVProfileReportsPage />} />
              <Route path="me" element={<UNVProfileMePage />} />
              <Route path="admin" element={<UNVProfileAdminPage />} />
              <Route path="integrations" element={<UNVProfileIntegrationsPage />} />
              <Route path="permissions" element={<UNVProfilePermissionsPage />} />
            </Route>
            
            {/* Leader Dashboard */}
            <Route path="/onboarding-tasks/leader" element={<LeaderDashboardPage />} />
            <Route path="/onboarding-tasks/ceo" element={<CEODashboardPage />} />
            
            {/* Hotseat Public Form */}
            <Route path="/hotseat" element={<HotseatFormPage />} />
            
            <Route path="/onboarding-client/:projectId" element={<ClientOnboardingPage />} />
            <Route path="/disparador/:projectId" element={<ClientDisparadorPage />} />
            <Route path="/cac-form/:projectId" element={<CACFormPage />} />
            <Route path="/kickoff/:companyId" element={<KickoffFormPage />} />
            <Route path="/nps" element={<NPSSurveyPage />} />
            <Route path="/csat" element={<CSATSurveyPage />} />
            <Route path="/kpi-entry/:companyId" element={<KPIEntryPage />} />
            <Route path="/disc" element={<LegacyDiscRedirect />} />
            <Route path="/360" element={<Assessment360Page />} />
            <Route path="/avaliacao" element={<UnifiedAssessmentPage />} />
            <Route path="/hr-disc/:token" element={<HrCandidateDiscPage />} />
            <Route path="/job-application" element={<PublicJobApplicationPage />} />
            <Route path="/banco-talentos" element={<PublicTalentPoolPage />} />
            <Route path="/social-briefing/:token" element={<SocialBriefingPublicPage />} />
            <Route path="/traffic-analysis/:token" element={<TrafficAnalysisPublicPage />} />
            <Route path="/marketing-consultation/:token" element={<MarketingConsultationPublicPage />} />
            <Route path="/financial-consultation/:token" element={<FinancialConsultationPublicPage />} />
            <Route path="/cultura/:token" element={<CultureFormPage />} />
            <Route path="/career-plan" element={<PublicCareerPlanFormPage />} />
            <Route path="/contrato-rotina/:token" element={<PublicRoutineFormPage />} />
            <Route path="/dados-contratuais/:token" element={<PublicContractDataPage />} />
            <Route path="/ads-briefing/:token" element={<PublicAdsBriefingPage />} />
            <Route path="/slides/:token" element={<PublicPresentationPage />} />
            <Route path="/slide-remote/:code" element={<SlideRemoteControlPage />} />
            <Route path="/onboarding-tasks/:projectId/reports" element={<AssessmentReportsPage />} />
            
            {/* Customer Points - Public */}
            <Route path="/points" element={<CustomerPointsPublicForm />} />
            <Route path="/points-salesperson" element={<CustomerPointsSalespersonForm />} />
            
            {/* Customer Points - Client Area */}
            <Route path="/customer-points/:companyId" element={<CustomerPointsLayout />}>
              <Route index element={<CustomerPointsDashboard />} />
              <Route path="clients" element={<CustomerPointsClients />} />
              <Route path="rules" element={<CustomerPointsRules />} />
              <Route path="transactions" element={<CustomerPointsTransactions />} />
              <Route path="qr-codes" element={<CustomerPointsQRCodes />} />
              <Route path="salesperson-links" element={<CustomerPointsSalespersonTokens />} />
            </Route>
            
            {/* CRM Comercial */}
            <Route path="/crm" element={<CRMLayout />}>
              <Route index element={<CRMReportsPage />} />
              <Route path="pipeline" element={<CRMPipelinePage />} />
              <Route path="leads" element={<CRMLeadsPage />} />
              <Route path="leads/:id" element={<CRMLeadDetailPage />} />
              <Route path="activities" element={<CRMActivitiesPage />} />
              <Route path="inbox" element={<CRMInboxPage />} />
              <Route path="transcriptions" element={<CRMTranscriptionsPage />} />
              <Route path="reports" element={<CRMReportsPage />} />
              <Route path="settings" element={<CRMSettingsPage />} />
              <Route path="meetings" element={<CRMMeetingsPage />} />
              <Route path="office" element={<CRMOfficePage />} />
              <Route path="head" element={<CRMHeadComercialPage />} />
              <Route path="call-summary" element={<CRMCallSummaryPage />} />
              <Route path="api" element={<CRMApiPage />} />
              <Route path="forecast" element={<CRMForecastPage />} />
              <Route path="cadences" element={<CRMCadencesPage />} />
            </Route>
            
            {/* UNV Social - Content Pipeline */}
            <Route path="/social/:projectId" element={<SocialLayoutPage />}>
              <Route index element={<SocialPipelinePageComponent />} />
              <Route path="strategy" element={<SocialStrategyPageComponent />} />
              <Route path="settings" element={<SocialSettingsPageComponent />} />
            </Route>
            <Route path="/social/approval" element={<SocialApprovalPageComponent />} />
            
            {/* System Showcase */}
            <Route path="/sistema" element={<SystemShowcasePage />} />
            
            {/* UNV Circle */}
            <Route path="/circle/auth" element={<CircleAuthPage />} />
            <Route path="/circle" element={<CircleLayout />}>
              <Route index element={<CircleFeedPage />} />
              <Route path="stories" element={<CircleStoriesPage />} />
              <Route path="communities" element={<CircleCommunitiesPage />} />
              <Route path="community/:slug" element={<CircleCommunityDetailPage />} />
              <Route path="marketplace" element={<CircleMarketplacePage />} />
              <Route path="ranking" element={<CircleRankingPage />} />
              <Route path="profile" element={<CircleProfilePage />} />
              <Route path="profile/:profileId" element={<CircleProfilePage />} />
              <Route path="notifications" element={<CircleNotificationsPage />} />
              <Route path="settings" element={<CircleSettingsPage />} />
              <Route path="messages" element={<CircleMessagesPage />} />
              <Route path="saved" element={<CircleSavedPostsPage />} />
              <Route path="mentor" element={<CircleMentorPage />} />
              <Route path="ads" element={<CircleAdsPage />} />
            </Route>
            
            {/* Portal */}
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
              <Route path="estrategias/:planId" element={<PortalStrategiesPage />} />
            </Route>
            
            {/* PDI */}
            <Route path="/pdi" element={<PDILayout />}>
              <Route index element={<PDIDashboardPage />} />
              <Route path="cohorts" element={<PDICohortsPage />} />
              <Route path="applications" element={<PDIApplicationsPage />} />
              <Route path="participants" element={<PDIParticipantsPage />} />
              <Route path="tracks" element={<PDITracksPage />} />
              <Route path="tasks" element={<PDITasksPage />} />
              <Route path="attendance" element={<PDIAttendancePage />} />
              <Route path="library" element={<PDILibraryPage />} />
              <Route path="assessments" element={<PDIAssessmentsPage />} />
              <Route path="reports" element={<PDIReportsPage />} />
              <Route path="certificates" element={<PDICertificatesPage />} />
              <Route path="ranking" element={<PDIRankingPage />} />
              <Route path="community" element={<PDICommunityPage />} />
              <Route path="settings" element={<PDISettingsPage />} />
            </Route>
            
            
            {/* Academy */}
            <Route path="/academy" element={<AcademyLayout />}>
              <Route index element={<AcademyHomePage />} />
              <Route path="tracks" element={<AcademyTracksPage />} />
              <Route path="track/:trackId" element={<AcademyTrackDetailPage />} />
              <Route path="lesson/:lessonId" element={<AcademyLessonPage />} />
              <Route path="progress" element={<AcademyProgressPage />} />
              <Route path="ranking" element={<AcademyRankingPage />} />
              <Route path="quizzes" element={<AcademyQuizzesListPage />} />
              <Route path="quiz/:quizId" element={<AcademyQuizPage />} />
              <Route path="team" element={<AcademyTeamPage />} />
              <Route path="reports" element={<AcademyReportsPage />} />
              <Route path="admin/content" element={<AcademyAdminContentPage />} />
              <Route path="admin/quizzes" element={<AcademyAdminQuizzesPage />} />
              <Route path="admin/gamification" element={<AcademyAdminGamificationPage />} />
              <Route path="admin/access" element={<AcademyAdminAccessPage />} />
              <Route path="admin/reports" element={<AcademyAdminReportsPage />} />
              <Route path="settings" element={<AcademySettingsPage />} />
            </Route>
            
            {/* PDI Public Routes */}
            <Route path="/pdi/enroll/:token" element={<PDIEnrollmentPage />} />
            <Route path="/pdi/participant/:token" element={<PDIParticipantPortalPage />} />
            
            {/* Payment Links */}
            <Route path="/pagamento" element={<PaymentLinkPage />} />
            <Route path="/recebimento" element={<RecebimentosPage />} />
            <Route path="/checkout" element={<CheckoutPage />} />
            <Route path="/fatura" element={<PublicInvoicePage />} />
            
            {/* White-Label Admin */}
            <Route path="/whitelabel-admin" element={<WhitelabelAdminPage />} />
            <Route path="/whitelabel-gestao" element={<WhitelabelUNVAdminPage />} />
            <Route path="/assine" element={<WhitelabelSignupPage />} />
            
              <Route path="*" element={<NotFound />} />
            </Routes>
            </Suspense>
            </HashRouter>
          </TooltipProvider>
        </TenantProvider>
        </ThemeCustomizationProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default AppShell;
