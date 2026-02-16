import { useState, useEffect, useMemo } from "react";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { ChartContainer } from "@/components/dashboard/ChartContainer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, CheckCircle, Loader, RefreshCw } from "lucide-react";
import { predictRisk, getCustomerList, getCustomerData, CUSTOMER_SAMPLE_LIMIT, type PredictionResponse, type CustomerData } from "@/lib/backendApi";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function PredictionPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [prediction, setPrediction] = useState<PredictionResponse | null>(null);
  const [customers, setCustomers] = useState<string[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<string>("");
  const [customerSearch, setCustomerSearch] = useState<string>("");
  const [customerData, setCustomerData] = useState<CustomerData | null>(null);
  const [customersLoading, setCustomersLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);

  // Load customer list on mount
  useEffect(() => {
    loadCustomers();
  }, []);

  // Load customer data when customer changes
  useEffect(() => {
    if (selectedCustomer) {
      loadCustomerData(selectedCustomer);
    }
  }, [selectedCustomer]);

  const loadCustomers = async () => {
    setCustomersLoading(true);
    try {
      const customerList = await getCustomerList(CUSTOMER_SAMPLE_LIMIT);
      setCustomers(customerList);
      if (customerList.length > 0) {
        setSelectedCustomer(customerList[0]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load customers");
    } finally {
      setCustomersLoading(false);
    }
  };

  const loadCustomerData = async (customerId: string) => {
    setDataLoading(true);
    try {
      const data = await getCustomerData(customerId);
      setCustomerData(data);
      setPrediction(null); // Clear previous prediction
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load customer data");
    } finally {
      setDataLoading(false);
    }
  };

  const handlePredict = async () => {
    if (!selectedCustomer) {
      setError("Please select a customer");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const result = await predictRisk(selectedCustomer);
      setPrediction(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Prediction failed");
    } finally {
      setLoading(false);
    }
  };

  const getRiskColor = (category: string) => {
    switch (category) {
      case "HIGH":
        return "bg-red-50 border-red-200 text-red-900";
      case "MEDIUM":
        return "bg-yellow-50 border-yellow-200 text-yellow-900";
      case "LOW":
        return "bg-green-50 border-green-200 text-green-900";
      default:
        return "bg-gray-50 border-gray-200 text-gray-900";
    }
  };

  const getRiskBadgeVariant = (category: string) => {
    switch (category) {
      case "HIGH":
        return "destructive";
      case "MEDIUM":
        return "secondary";
      case "LOW":
        return "outline";
      default:
        return "default";
    }
  };

  const riskDriversData = prediction
    ? Object.entries(prediction.top_risk_drivers).map(([feature, value]) => ({
        feature: feature.replace(/_/g, " ").substring(0, 20),
        value: parseFloat((value * 100).toFixed(2)),
      }))
    : [];

  const filteredCustomers = useMemo(() => {
    const search = customerSearch.trim().toLowerCase();
    const source = search
      ? customers.filter((cust) => cust.toLowerCase().includes(search))
      : customers;
    return source.slice(0, 200);
  }, [customers, customerSearch]);

  return (
    <>
      <DashboardHeader
        title="Risk Prediction Engine"
        subtitle="Automatic delinquency risk assessment using customer banking records"
      />
      <div className="flex-1 overflow-auto p-6 space-y-6">
        {/* Customer Selection */}
        <Card className="p-6 border">
          <h3 className="text-lg font-semibold mb-4">Select Customer for Risk Assessment</h3>
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <label className="text-sm mb-2 block font-medium">Customer ID (Retrieved from Banking Records)</label>
              <input
                type="text"
                value={customerSearch}
                onChange={(event) => setCustomerSearch(event.target.value)}
                placeholder="Search customer ID..."
                className="mb-2 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
              <Select value={selectedCustomer} onValueChange={setSelectedCustomer}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {filteredCustomers.map((cust) => (
                    <SelectItem key={cust} value={cust}>
                      {cust}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {customers.length > filteredCustomers.length && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Showing {filteredCustomers.length} of {customers.length} customers. Refine the search to narrow results.
                </p>
              )}
            </div>
            <Button
              onClick={handlePredict}
              disabled={loading || customersLoading || !selectedCustomer}
              size="lg"
            >
              {loading ? (
                <>
                  <Loader className="mr-2 h-4 w-4 animate-spin" />
                  Analyzing...
                </>
              ) : (
                "Predict Risk"
              )}
            </Button>
            <Button
              onClick={loadCustomers}
              disabled={customersLoading}
              variant="outline"
              size="lg"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            ✓ Data automatically retrieved from banking records
          </p>
        </Card>

        {/* Customer Behavioral Data Display */}
        {customerData && !dataLoading && (
          <Card className="p-6 border bg-blue-50 border-blue-200">
            <h3 className="text-lg font-semibold mb-4 text-blue-900">Customer Behavioral Data (Auto-Retrieved)</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              <div className="bg-white p-3 rounded border border-blue-100">
                <p className="text-xs text-gray-600">Avg Salary Day 6M</p>
                <p className="font-semibold text-sm">{customerData.avg_salary_day_6m.toFixed(1)}</p>
              </div>
              <div className="bg-white p-3 rounded border border-blue-100">
                <p className="text-xs text-gray-600">Current Salary Day</p>
                <p className="font-semibold text-sm">{customerData.current_salary_day.toFixed(1)}</p>
              </div>
              <div className="bg-white p-3 rounded border border-blue-100">
                <p className="text-xs text-gray-600">Salary Delay Days</p>
                <p className="font-semibold text-sm">{customerData.salary_delay_days.toFixed(1)}</p>
              </div>
              <div className="bg-white p-3 rounded border border-blue-100">
                <p className="text-xs text-gray-600">Savings 6M Avg</p>
                <p className="font-semibold text-sm">₹{customerData.savings_6m_avg.toLocaleString()}</p>
              </div>
              <div className="bg-white p-3 rounded border border-blue-100">
                <p className="text-xs text-gray-600">Current Savings</p>
                <p className="font-semibold text-sm">₹{customerData.current_savings.toLocaleString()}</p>
              </div>
              <div className="bg-white p-3 rounded border border-blue-100">
                <p className="text-xs text-gray-600">Savings Drop %</p>
                <p className="font-semibold text-sm text-red-600">{customerData.savings_drop_pct.toFixed(2)}%</p>
              </div>
              <div className="bg-white p-3 rounded border border-blue-100">
                <p className="text-xs text-gray-600">Discretionary Spend 6M</p>
                <p className="font-semibold text-sm">₹{customerData.discretionary_spend_6m_avg.toLocaleString()}</p>
              </div>
              <div className="bg-white p-3 rounded border border-blue-100">
                <p className="text-xs text-gray-600">Current Discretionary</p>
                <p className="font-semibold text-sm">₹{customerData.current_discretionary_spend.toLocaleString()}</p>
              </div>
              <div className="bg-white p-3 rounded border border-blue-100">
                <p className="text-xs text-gray-600">Discretionary Drop %</p>
                <p className="font-semibold text-sm text-red-600">{customerData.discretionary_drop_pct.toFixed(2)}%</p>
              </div>
              <div className="bg-white p-3 rounded border border-blue-100">
                <p className="text-xs text-gray-600">Utility Payment Shift</p>
                <p className="font-semibold text-sm">{customerData.utility_payment_shift_days.toFixed(1)} days</p>
              </div>
              <div className="bg-white p-3 rounded border border-blue-100">
                <p className="text-xs text-gray-600">ATM Withdrawal ↑</p>
                <p className="font-semibold text-sm text-red-600">{customerData.atm_withdrawal_increase_pct.toFixed(2)}%</p>
              </div>
              <div className="bg-white p-3 rounded border border-blue-100">
                <p className="text-xs text-gray-600">Credit Utilization %</p>
                <p className="font-semibold text-sm">{customerData.credit_utilization_pct.toFixed(2)}%</p>
              </div>
              <div className="bg-white p-3 rounded border border-blue-100">
                <p className="text-xs text-gray-600">Past EMI Delays 6M</p>
                <p className="font-semibold text-sm text-red-600">{customerData.past_emi_delays_6m.toFixed(0)}</p>
              </div>
              <div className="bg-white p-3 rounded border border-blue-100">
                <p className="text-xs text-gray-600">Historical Stability</p>
                <p className="font-semibold text-sm">{customerData.historical_stability_index.toFixed(3)}</p>
              </div>
            </div>
          </Card>
        )}

        {/* Error Alert */}
        {error && (
          <Alert className="border-red-200 bg-red-50">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-800">{error}</AlertDescription>
          </Alert>
        )}

        {/* Prediction Results */}
        {prediction && (
          <div className="space-y-6">
            {/* Risk Summary */}
            <Card className={`p-6 border-2 ${getRiskColor(prediction.risk_category)}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium opacity-75">Predicted Risk Category</p>
                  <p className="text-3xl font-bold mt-1">{prediction.risk_category} RISK</p>
                  <p className="text-sm mt-2 opacity-75">
                    Delinquency Probability: <span className="font-semibold">{(prediction.risk_probability * 100).toFixed(1)}%</span>
                  </p>
                </div>
                <div className="text-right">
                  <Badge variant={getRiskBadgeVariant(prediction.risk_category)} className="text-lg px-4 py-2">
                    {prediction.risk_category}
                  </Badge>
                  <p className="text-xs mt-2 opacity-75">Customer: {prediction.customer_id}</p>
                </div>
              </div>
            </Card>

            {/* Risk Drivers Chart */}
            {riskDriversData.length > 0 && (
              <ChartContainer title="Top Risk Contributing Factors" subtitle="Feature importance in prediction">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={riskDriversData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(214, 32%, 91%)" />
                    <XAxis dataKey="feature" tick={{ fontSize: 11 }} angle={-45} textAnchor="end" height={80} />
                    <YAxis tick={{ fontSize: 11 }} label={{ value: "Impact %", angle: -90, position: "insideLeft" }} />
                    <Tooltip
                      formatter={(value: any) => [`${value.toFixed(2)}%`, "Impact"]}
                      contentStyle={{ backgroundColor: "hsl(0, 0%, 100%)", border: "1px solid hsl(214, 32%, 91%)" }}
                    />
                    <Bar dataKey="value" fill="hsl(0, 72%, 51%)" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            )}

            {/* Risk Threshold Info */}
            <Card className="p-6 bg-blue-50 border-blue-200">
              <div className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-blue-600 mt-0.5" />
                <div className="text-sm text-blue-900">
                  <p className="font-semibold mb-1">Risk Classification Logic</p>
                  <ul className="space-y-1 text-xs">
                    <li>• <strong>LOW RISK:</strong> 0% - 39% probability</li>
                    <li>• <strong>MEDIUM RISK:</strong> 40% - 69% probability</li>
                    <li>• <strong>HIGH RISK:</strong> 70% - 100% probability</li>
                  </ul>
                  <p className="mt-3 text-xs italic opacity-75">
                    Model provides risk decision support. Final intervention decisions remain human-controlled.
                  </p>
                </div>
              </div>
            </Card>

            {/* Prediction Details */}
            <Card className="p-4 bg-gray-50 text-sm">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-gray-600">Customer ID</p>
                  <p className="font-mono text-xs">{prediction.customer_id}</p>
                </div>
                <div>
                  <p className="text-gray-600">Risk Probability</p>
                  <p className="font-mono text-xs">{(prediction.risk_probability * 100).toFixed(2)}%</p>
                </div>
                <div>
                  <p className="text-gray-600">Model Version</p>
                  <p className="font-mono text-xs">v{prediction.model_version}</p>
                </div>
                <div>
                  <p className="text-gray-600">Prediction Time</p>
                  <p className="font-mono text-xs">{new Date(prediction.prediction_timestamp).toLocaleTimeString()}</p>
                </div>
              </div>
            </Card>

            {/* Risk Drivers Table */}
            <Card className="p-6">
              <h3 className="text-sm font-semibold mb-4">Feature Contribution Scores (SHAP Explainability)</h3>
              <div className="space-y-2">
                {Object.entries(prediction.top_risk_drivers).map(([feature, score]) => (
                  <div key={feature} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="text-sm font-medium">{feature.replace(/_/g, " ")}</span>
                    <div className="flex items-center gap-3">
                      <div className="w-24 bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-red-500 h-2 rounded-full"
                          style={{ width: `${Math.min(score * 100, 100)}%` }}
                        />
                      </div>
                      <span className="font-mono text-sm font-semibold w-12 text-right">{(score * 100).toFixed(1)}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}

        {/* Empty State */}
        {!prediction && !error && !loading && customers.length > 0 && (
          <Card className="p-12 text-center border-dashed">
            <AlertCircle className="h-8 w-8 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600">Select a customer and click "Predict Risk" to analyze delinquency probability</p>
          </Card>
        )}

        {/* Loading Customers State */}
        {customersLoading && (
          <Card className="p-12 text-center border-dashed">
            <Loader className="h-8 w-8 text-gray-400 mx-auto mb-3 animate-spin" />
            <p className="text-gray-600">Loading customers from banking records...</p>
          </Card>
        )}

        {/* Loading Data State */}
        {dataLoading && (
          <Card className="p-12 text-center border-dashed">
            <Loader className="h-8 w-8 text-gray-400 mx-auto mb-3 animate-spin" />
            <p className="text-gray-600">Loading customer behavioral data...</p>
          </Card>
        )}

        {/* No Customers State */}
        {!customersLoading && customers.length === 0 && (
          <Card className="p-12 text-center border-dashed border-red-200 bg-red-50">
            <AlertCircle className="h-8 w-8 text-red-600 mx-auto mb-3" />
            <p className="text-red-600">No customer data available. Backend is not running or customer_data.csv is missing.</p>
          </Card>
        )}
      </div>
    </>
  );
}
