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
import AdsPage from "./pages/AdsPage";
import SocialPage from "./pages/SocialPage";
import MastermindPage from "./pages/MastermindPage";
import MastermindApplyPage from "./pages/MastermindApplyPage";
import MastermindApplicationsPage from "./pages/MastermindApplicationsPage";
import LeadershipPage from "./pages/LeadershipPage";
import ForClosersPage from "./pages/ForClosersPage";
import ClientDiagnosticPage from "./pages/ClientDiagnosticPage";
import ApplyPage from "./pages/ApplyPage";
import FAQPage from "./pages/FAQPage";
import TermsPage from "./pages/TermsPage";
import ComparePage from "./pages/ComparePage";
import DiagnosticResponsesPage from "./pages/DiagnosticResponsesPage";
import AdminSetupPage from "./pages/AdminSetupPage";
import NotFound from "./pages/NotFound";

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
          <Route path="/ads" element={<AdsPage />} />
          <Route path="/social" element={<SocialPage />} />
          <Route path="/mastermind" element={<MastermindPage />} />
          <Route path="/mastermind/apply" element={<MastermindApplyPage />} />
          <Route path="/mastermind/applications" element={<MastermindApplicationsPage />} />
          <Route path="/leadership" element={<LeadershipPage />} />
          <Route path="/for-closers" element={<ForClosersPage />} />
          <Route path="/diagnostico" element={<ClientDiagnosticPage />} />
          <Route path="/apply" element={<ApplyPage />} />
          <Route path="/apply" element={<ApplyPage />} />
          <Route path="/faq" element={<FAQPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/compare" element={<ComparePage />} />
          <Route path="/diagnostic-responses" element={<DiagnosticResponsesPage />} />
          <Route path="/admin-setup" element={<AdminSetupPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
