import { useEffect, useMemo, useState } from "react";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { ChartContainer } from "@/components/dashboard/ChartContainer";
import { CUSTOMER_SAMPLE_LIMIT, getCustomerDrilldown, getCustomerRiskList, type CustomerDrilldown, type CustomerRiskItem } from "@/lib/backendApi";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

const riskBadge = (cat: string) => {
  const v = cat === "HIGH" ? "destructive" : cat === "MEDIUM" ? "secondary" : "outline";
  return <Badge variant={v as any}>{cat}</Badge>;
};

export default function RiskExplorerPage() {
  const [customers, setCustomers] = useState<CustomerRiskItem[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [drilldown, setDrilldown] = useState<CustomerDrilldown | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);

    getCustomerRiskList(CUSTOMER_SAMPLE_LIMIT)
      .then((response) => {
        if (!isMounted) return;
        console.log("Risk explorer customer list", response);
        setCustomers(response);
        if (response.length > 0) {
          setSelectedId(response[0].customer_id);
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        setError(err instanceof Error ? err.message : "Failed to load customers");
      })
      .finally(() => {
        if (!isMounted) return;
        setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    getCustomerDrilldown(selectedId)
      .then((response) => {
        console.log("Risk explorer drilldown", response);
        setDrilldown(response);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load customer drilldown");
      });
  }, [selectedId]);

  const selectedCustomer = useMemo(
    () => customers.find((c) => c.customer_id === selectedId) || null,
    [customers, selectedId]
  );

  const contributingSeries = useMemo(() => {
    if (!drilldown) return [] as { feature: string; value: number }[];
    return Object.entries(drilldown.contributing_features)
      .map(([feature, value]) => ({ feature, value }))
      .sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
  }, [drilldown]);

  return (
    <>
      <DashboardHeader title="Behavioural Risk Explorer" subtitle="Customer-level deep dive analysis" />
      <div className="flex-1 overflow-auto p-6 space-y-6">
        {/* Customer Selector */}
        <div className="bg-card rounded-lg p-4 card-shadow border border-border flex items-center gap-4 flex-wrap">
          <label className="text-sm font-medium text-foreground">Select Customer:</label>
          <Select value={selectedId} onValueChange={setSelectedId}>
            <SelectTrigger className="w-72">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {customers.map((c) => (
                <SelectItem key={c.customer_id} value={c.customer_id}>
                  {c.customer_id} — {(c.risk_probability * 100).toFixed(1)}%
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-3 ml-auto">
            {selectedCustomer ? riskBadge(selectedCustomer.risk_category) : null}
            <span className="text-sm text-muted-foreground">Probability: <strong className="text-foreground">{selectedCustomer ? (selectedCustomer.risk_probability * 100).toFixed(1) : "--"}%</strong></span>
          </div>
        </div>

        {/* Trend Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ChartContainer title="Customer Risk Summary" subtitle="Behavioural, liquidity, and delinquency scores">
            {loading ? (
              <div className="text-sm text-muted-foreground">Loading customer data...</div>
            ) : error ? (
              <div className="text-sm text-destructive">{error}</div>
            ) : drilldown ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={[
                  { metric: "Behavioural", value: drilldown.behavioural_score * 100 },
                  { metric: "Liquidity", value: drilldown.liquidity_score * 100 },
                  { metric: "Delinquency", value: drilldown.delinquency_probability * 100 },
                ]}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(214, 32%, 91%)" />
                  <XAxis dataKey="metric" tick={{ fontSize: 10 }} stroke="hsl(215, 16%, 47%)" />
                  <YAxis tick={{ fontSize: 10 }} stroke="hsl(215, 16%, 47%)" />
                  <Tooltip />
                  <Bar dataKey="value" fill="hsl(0, 72%, 51%)" name="Score" />
                </BarChart>
              </ResponsiveContainer>
            ) : null}
          </ChartContainer>

          <ChartContainer title="Contributing Features" subtitle="Top drivers for this customer">
            {loading ? (
              <div className="text-sm text-muted-foreground">Loading contributions...</div>
            ) : error ? (
              <div className="text-sm text-destructive">{error}</div>
            ) : drilldown ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={contributingSeries} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(214, 32%, 91%)" />
                  <XAxis type="number" tick={{ fontSize: 10 }} stroke="hsl(215, 16%, 47%)" />
                  <YAxis type="category" dataKey="feature" width={140} tick={{ fontSize: 10 }} stroke="hsl(215, 16%, 47%)" />
                  <Tooltip />
                  <Bar dataKey="value" name="Impact">
                    {contributingSeries.map((entry, i) => (
                      <Cell key={i} fill={entry.value >= 0 ? "hsl(0, 72%, 51%)" : "hsl(224, 76%, 48%)"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : null}
          </ChartContainer>
        </div>
      </div>
    </>
  );
}
