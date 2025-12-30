import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ScrollToTop } from "./components/ScrollToTop";
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

const queryClient = new QueryClient();

const App = () => (
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
);

export default App;
