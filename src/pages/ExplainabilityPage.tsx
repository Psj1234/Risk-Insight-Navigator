import { useEffect, useState } from "react";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { ChartContainer } from "@/components/dashboard/ChartContainer";
import { CUSTOMER_SAMPLE_LIMIT, getCustomerDrilldown, getCustomerRiskList, getFeatureImportance, predictAndSendIntervention, type CustomerDrilldown, type CustomerRiskItem, type FeatureImportancePoint } from "@/lib/backendApi";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { AlertTriangle, Info, CheckCircle, Mail, Loader } from "lucide-react";
import {
  Tooltip as UITooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// Helper function to get delinquency risk level
const getDelinquencyRiskLevel = (probability: number): string => {
  const pct = probability * 100;
  if (pct >= 75) return "High Risk";
  if (pct >= 40) return "Medium Risk";
  return "Low Risk";
};

// Helper function to get behavioural risk level
const getBehaviouralRiskLevel = (score: number): string => {
  if (score >= 70) return "Strong";
  if (score >= 40) return "Moderate";
  return "Weak";
};

// Helper function to get liquidity stability level
const getLiquidityStabilityLevel = (score: number): string => {
  if (score >= 70) return "Strong Stability";
  if (score >= 40) return "Moderate Stability";
  return "Low Stability";
};

// Helper function to map backend feature names to business-friendly names
const mapFeatureName = (feature: string): string => {
  const featureMap: Record<string, string> = {
    "Salary_Delay_Days": "Frequent Salary Credit Delays",
    "Past_EMI_Delays_6M": "Multiple EMI Delays (Last 6 Months)",
    "Credit_Utilization_%": "High Credit Card Utilization",
    "Savings_Drop_%": "Declining Savings Balance",
    "Current_Salary_Day": "Irregular Salary Credit Pattern",
  };
  return featureMap[feature] || feature;
};

export default function ExplainabilityPage() {
  const [featureImportance, setFeatureImportance] = useState<FeatureImportancePoint[]>([]);
  const [customers, setCustomers] = useState<CustomerRiskItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerRiskItem | null>(null);
  const [drilldown, setDrilldown] = useState<CustomerDrilldown | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [predictionLoading, setPredictionLoading] = useState(false);
  const [interventionResult, setInterventionResult] = useState<any>(null);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);

    Promise.all([getFeatureImportance(), getCustomerRiskList(CUSTOMER_SAMPLE_LIMIT)])
      .then(([featureResponse, customerResponse]) => {
        if (!isMounted) return;
        console.log("Feature importance", featureResponse);
        console.log("Customer risk list", customerResponse);
        setFeatureImportance(featureResponse);
        setCustomers(customerResponse);
      })
      .catch((err) => {
        if (!isMounted) return;
        setError(err instanceof Error ? err.message : "Failed to load explainability data");
      })
      .finally(() => {
        if (!isMounted) return;
        setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const openPrediction = (customerId: string) => {
    setSelectedId(customerId);
    setModalOpen(true);
    setInterventionResult(null);
  };

  const handlePredictAndIntervene = async () => {
    if (!selectedId) return;
    
    setPredictionLoading(true);
    try {
      const result = await predictAndSendIntervention(selectedId);
      setInterventionResult(result);
      console.log("Prediction and intervention result:", result);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Prediction and intervention failed";
      setError(message);
      console.error("Prediction and intervention error:", err);
    } finally {
      setPredictionLoading(false);
    }
  };

  useEffect(() => {
    if (!selectedId) return;
    const customer = customers.find((c) => c.customer_id === selectedId) || null;
    setSelectedCustomer(customer);
    getCustomerDrilldown(selectedId)
      .then((drilldownResponse) => {
        console.log("Customer drilldown", drilldownResponse);
        setDrilldown(drilldownResponse);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load customer drilldown");
      });
  }, [selectedId, customers]);

  const topFlagged = customers
    .filter((c) => c.risk_probability >= 0.5)
    .sort((a, b) => b.risk_probability - a.risk_probability)
    .slice(0, 20);

  return (
    <>
      <DashboardHeader title="Model Explainability" subtitle="Transparency into model decisions and feature importance" />
      <div className="flex-1 overflow-auto p-6 space-y-6">
        {/* Compliance Banner */}
        <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-foreground">Human-in-the-Loop Governance</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              All interventions require human approval. The system provides decision support only.
              Model outputs are advisory — final decisions always remain with the assigned risk officer.
            </p>
          </div>
        </div>

        {/* Feature Importance */}
        <ChartContainer title="Global Feature Importance" subtitle="Contribution of each feature to risk predictions across the portfolio">
          {loading ? (
            <div className="text-sm text-muted-foreground">Loading feature importance...</div>
          ) : error ? (
            <div className="text-sm text-destructive">{error}</div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={featureImportance} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(214, 32%, 91%)" />
                <XAxis type="number" tick={{ fontSize: 11 }} stroke="hsl(215, 16%, 47%)" />
                <YAxis type="category" dataKey="feature_name" width={160} tick={{ fontSize: 11 }} stroke="hsl(215, 16%, 47%)" />
                <Tooltip formatter={(val: number) => `${(val * 100).toFixed(0)}%`} />
                <Bar dataKey="importance_score" name="Importance" radius={[0, 4, 4, 0]}>
                  {featureImportance.map((_, i) => (
                    <Cell key={i} fill={`hsl(224, ${76 - i * 6}%, ${48 + i * 4}%)`} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartContainer>

        {/* Individual Prediction */}
        <ChartContainer title="Individual Prediction Explorer" subtitle="Select a customer to see their prediction breakdown">
          <div className="flex items-center gap-4 mb-4">
            <Select onValueChange={(v) => { setSelectedId(v); setModalOpen(true); }}>
              <SelectTrigger className="w-72">
                <SelectValue placeholder="Select a customer..." />
              </SelectTrigger>
              <SelectContent>
                {topFlagged.map((c) => (
                  <SelectItem key={c.customer_id} value={c.customer_id}>
                    {c.customer_id} — {(c.risk_probability * 100).toFixed(1)}%
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {topFlagged.slice(0, 8).map((c) => (
              <button
                key={c.customer_id}
                onClick={() => openPrediction(c.customer_id)}
                className="bg-muted/50 border border-border rounded-lg p-3 text-left hover:bg-muted transition-colors"
              >
                <p className="text-xs font-mono text-muted-foreground">{c.customer_id}</p>
                <p className="text-sm font-medium text-foreground mt-0.5">Risk {(c.risk_probability * 100).toFixed(1)}%</p>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-lg font-bold text-foreground">{(c.risk_probability * 100).toFixed(0)}</span>
                  <Badge variant={c.risk_category === "HIGH" ? "destructive" : "secondary"} className="text-[10px]">
                    {c.risk_category}
                  </Badge>
                </div>
              </button>
            ))}
          </div>
        </ChartContainer>

        {/* Prediction Modal */}
        <Dialog open={modalOpen} onOpenChange={setModalOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader className="flex flex-row items-center justify-between gap-4">
              <div className="flex-1">
                <DialogTitle>Customer Risk Breakdown — {selectedCustomer?.customer_id}</DialogTitle>
                <DialogDescription>Detailed risk assessment and contributing factors</DialogDescription>
              </div>
              <Button
                onClick={handlePredictAndIntervene}
                disabled={predictionLoading || !selectedId}
                className="gap-2 whitespace-nowrap"
                size="sm"
              >
                {predictionLoading ? (
                  <>
                    <Loader className="h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Mail className="h-4 w-4" />
                    Predict & Send
                  </>
                )}
              </Button>
            </DialogHeader>
            {selectedCustomer && drilldown && (
              <TooltipProvider>
                <div className="space-y-4">
                  {/* Intervention Result Messages */}
                  {interventionResult && (
                    <div className={`rounded-md p-3 flex items-start gap-2 border ${
                      interventionResult.intervention?.email_sent 
                        ? "bg-green-50 border-green-200" 
                        : "bg-blue-50 border-blue-200"
                    }`}>
                      <CheckCircle className={`h-4 w-4 shrink-0 mt-0.5 ${
                        interventionResult.intervention?.email_sent 
                          ? "text-green-600" 
                          : "text-blue-600"
                      }`} />
                      <div>
                        <p className={`text-sm font-medium ${
                          interventionResult.intervention?.email_sent 
                            ? "text-green-900" 
                            : "text-blue-900"
                        }`}>
                          {interventionResult.intervention?.email_sent 
                            ? "✓ Intervention Email Sent" 
                            : "Prediction Complete"}
                        </p>
                        {interventionResult.intervention?.email_sent && (
                          <p className="text-xs text-green-800 mt-1">
                            {interventionResult.intervention.email_subject}
                          </p>
                        )}
                        {interventionResult.intervention?.threshold_exceeded === false && (
                          <p className="text-xs text-blue-800 mt-1">
                            Risk below intervention threshold (40%). No email sent.
                          </p>
                        )}
                        {interventionResult.intervention?.email_error && (
                          <p className="text-xs text-red-800 mt-1">
                            Error: {interventionResult.intervention.email_error}
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Error Messages */}
                  {error && (
                    <div className="rounded-md p-3 flex items-start gap-2 bg-red-50 border border-red-200">
                      <AlertTriangle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                      <p className="text-sm text-red-900">{error}</p>
                    </div>
                  )}
                  <div className="flex gap-4">
                    <div className="bg-muted rounded-md p-3 flex-1 text-center">
                      <p className="text-xs text-muted-foreground">Delinquency Probability</p>
                      <p className="text-2xl font-bold text-foreground">{(drilldown.delinquency_probability * 100).toFixed(1)}%</p>
                      <p className="text-sm font-medium text-foreground mt-1">{getDelinquencyRiskLevel(drilldown.delinquency_probability)}</p>
                    </div>
                    <div className="bg-muted rounded-md p-3 flex-1 text-center">
                      <div className="flex items-center justify-center gap-1 mb-1">
                        <p className="text-xs text-muted-foreground">Behavioural Score</p>
                        <UITooltip>
                          <TooltipTrigger asChild>
                            <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            Measures repayment discipline based on EMI delays and behavioural patterns.
                          </TooltipContent>
                        </UITooltip>
                      </div>
                      <p className="text-2xl font-bold text-foreground">{(drilldown.behavioural_score * 100).toFixed(1)}</p>
                      <p className="text-sm font-medium text-foreground mt-1">{getBehaviouralRiskLevel(drilldown.behavioural_score * 100)}</p>
                    </div>
                    <div className="bg-muted rounded-md p-3 flex-1 text-center">
                      <div className="flex items-center justify-center gap-1 mb-1">
                        <p className="text-xs text-muted-foreground">Liquidity Score</p>
                        <UITooltip>
                          <TooltipTrigger asChild>
                            <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            Measures financial stability based on balance trends and savings.
                          </TooltipContent>
                        </UITooltip>
                      </div>
                      <p className="text-2xl font-bold text-foreground">{(drilldown.liquidity_score * 100).toFixed(1)}</p>
                      <p className="text-sm font-medium text-foreground mt-1">{getLiquidityStabilityLevel(drilldown.liquidity_score * 100)}</p>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-semibold text-foreground mb-2">Key Risk Drivers</h4>
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart
                        data={Object.entries(drilldown.contributing_features)
                          .map(([feature, value]) => ({ feature: mapFeatureName(feature), value }))
                          .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))}
                        layout="vertical"
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(214, 32%, 91%)" />
                        <XAxis type="number" tick={{ fontSize: 10 }} stroke="hsl(215, 16%, 47%)" />
                        <YAxis type="category" dataKey="feature" width={200} tick={{ fontSize: 10 }} stroke="hsl(215, 16%, 47%)" />
                        <Tooltip />
                        <Bar dataKey="value" name="Impact">
                          {Object.entries(drilldown.contributing_features)
                            .map(([feature, value]) => ({ feature: mapFeatureName(feature), value }))
                            .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
                            .map((entry, i) => (
                              <Cell key={i} fill={entry.value >= 0 ? "hsl(0, 72%, 51%)" : "hsl(224, 76%, 48%)"} />
                            ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  <div>
                    <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      Recommended Actions
                    </h4>
                    <ul className="space-y-2">
                      <li className="flex items-start gap-2 text-sm text-foreground">
                        <span className="text-primary font-bold">•</span>
                        <span>Send early payment reminder</span>
                      </li>
                      <li className="flex items-start gap-2 text-sm text-foreground">
                        <span className="text-primary font-bold">•</span>
                        <span>Offer EMI restructuring option</span>
                      </li>
                      <li className="flex items-start gap-2 text-sm text-foreground">
                        <span className="text-primary font-bold">•</span>
                        <span>Monitor account closely</span>
                      </li>
                    </ul>
                  </div>

                  <div className="bg-muted/50 border border-border rounded-md p-3 flex items-start gap-2">
                    <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                    <p className="text-xs text-muted-foreground">
                      This risk assessment helps relationship managers take proactive steps to prevent customer delinquency.
                      All intervention decisions require human approval by the assigned risk officer.
                    </p>
                  </div>
                </div>
              </TooltipProvider>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
}
