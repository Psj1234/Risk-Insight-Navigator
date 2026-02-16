import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import DashboardPage from "./pages/DashboardPage";
import RiskExplorerPage from "./pages/RiskExplorerPage";
import PortfolioDriftPage from "./pages/PortfolioDriftPage";
import AlertsPage from "./pages/AlertsPage";
import ExplainabilityPage from "./pages/ExplainabilityPage";
import PredictionPage from "./pages/PredictionPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route element={<DashboardLayout />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/risk-explorer" element={<RiskExplorerPage />} />
            <Route path="/portfolio-drift" element={<PortfolioDriftPage />} />
            <Route path="/alerts" element={<AlertsPage />} />
            <Route path="/explainability" element={<ExplainabilityPage />} />
            <Route path="/prediction" element={<PredictionPage />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
