import { useEffect, useMemo, useState } from "react";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { ChartContainer } from "@/components/dashboard/ChartContainer";
import { getPortfolioSummary, getPortfolioHeatmap, type HeatmapRow, type PortfolioSummary, type RiskTrendPoint } from "@/lib/backendApi";
import { mockRiskTrend } from "@/lib/mockData";
import { Users, AlertTriangle, ShieldAlert, Activity } from "lucide-react";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Legend,
  BarChart, Bar,
} from "recharts";

export default function DashboardPage() {
  const [summary, setSummary] = useState<PortfolioSummary | null>(null);
  const [trend, setTrend] = useState<RiskTrendPoint[]>([]);
  const [heatmap, setHeatmap] = useState<HeatmapRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);

    Promise.all([getPortfolioSummary(), getPortfolioHeatmap()])
      .then(([summaryResponse, heatmapResponse]) => {
        if (!isMounted) return;
        console.log("Portfolio summary", summaryResponse);
        console.log("Risk trend (mock)", mockRiskTrend);
        console.log("Portfolio heatmap", heatmapResponse);
        setSummary(summaryResponse);
        setTrend(mockRiskTrend);
        setHeatmap(heatmapResponse);
      })
      .catch((err) => {
        if (!isMounted) return;
        setError(err instanceof Error ? err.message : "Failed to load portfolio data");
      })
      .finally(() => {
        if (!isMounted) return;
        setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const riskDistribution = useMemo(() => {
    if (!summary) return [] as { name: string; value: number; fill: string }[];
    return [
      { name: "Low", value: summary.low_risk_count, fill: "hsl(142, 72%, 37%)" },
      { name: "Medium", value: summary.medium_risk_count, fill: "hsl(38, 92%, 50%)" },
      { name: "High", value: summary.high_risk_count, fill: "hsl(0, 72%, 51%)" },
    ];
  }, [summary]);

  const gaugeData = useMemo(() => {
    if (!summary) return [] as { name: string; value: number }[];
    return [
      { name: "Healthy", value: summary.low_risk_count + summary.medium_risk_count },
      { name: "At Risk", value: summary.high_risk_count },
    ];
  }, [summary]);

  // Transform trend data - use delinquency probability directly (already in 0-1 range)
  const trendWithPercentages = useMemo(() => {
    return trend.map(point => ({
      week: point.week,
      delinquency_probability_pct: Number((point.delinquency_probability * 100).toFixed(1)),
    }));
  }, [trend]);

  return (
    <>
      <DashboardHeader title="Executive Dashboard" subtitle="Pre-Delinquency Early Warning Overview" />
      <div className="flex-1 overflow-auto p-6 space-y-6">
        {/* Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="Total Monitored"
            value={summary ? summary.total_customers.toLocaleString() : "--"}
            icon={Users}
            subtitle="Active customer accounts"
            variant="primary"
          />
          <MetricCard
            title="High Risk"
            value={summary ? summary.high_risk_count : "--"}
            icon={ShieldAlert}
            variant="danger"
          />
          <MetricCard
            title="Medium Risk"
            value={summary ? summary.medium_risk_count : "--"}
            icon={AlertTriangle}
            variant="warning"
          />
          <MetricCard
            title="Low Risk"
            value={summary ? summary.low_risk_count : "--"}
            icon={Activity}
            variant="primary"
          />
        </div>

        {/* Charts Row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <ChartContainer title="Risk Distribution" subtitle="Current portfolio breakdown">
            {loading ? (
              <div className="text-sm text-muted-foreground">Loading risk distribution...</div>
            ) : error ? (
              <div className="text-sm text-destructive">{error}</div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie data={riskDistribution} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={2}>
                      {riskDistribution.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-wrap gap-3 mt-2 justify-center">
                  {riskDistribution.map(d => (
                    <div key={d.name} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: d.fill }} />
                      {d.name}: {d.value}
                    </div>
                  ))}
                </div>
              </>
            )}
          </ChartContainer>

          <ChartContainer title="Weekly Risk Trend" subtitle="12-point rolling view" className="lg:col-span-2">
            {loading ? (
              <div className="text-sm text-muted-foreground">Loading risk trend...</div>
            ) : error ? (
              <div className="text-sm text-destructive">{error}</div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={trendWithPercentages}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(214, 32%, 91%)" />
                  <XAxis dataKey="week" tick={{ fontSize: 11 }} stroke="hsl(215, 16%, 47%)" />
                  <YAxis yAxisId="left" tick={{ fontSize: 11 }} stroke="hsl(215, 16%, 47%)" domain={[20, 30]} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line yAxisId="left" type="monotone" dataKey="delinquency_probability_pct" stroke="hsl(224, 76%, 48%)" strokeWidth={2} dot={{ r: 4 }} name="Delinquency Prob (%)" />
                </LineChart>
              </ResponsiveContainer>
            )}
          </ChartContainer>
        </div>

        {/* Charts Row 2 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ChartContainer title="Portfolio Health Gauge" subtitle="Healthy vs At-Risk ratio">
            {loading ? (
              <div className="text-sm text-muted-foreground">Loading portfolio health...</div>
            ) : error ? (
              <div className="text-sm text-destructive">{error}</div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={gaugeData} dataKey="value" startAngle={180} endAngle={0} cx="50%" cy="85%" innerRadius={60} outerRadius={100}>
                      <Cell fill="hsl(142, 72%, 37%)" />
                      <Cell fill="hsl(0, 72%, 51%)" />
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex justify-center gap-6 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-success" /> Healthy: {gaugeData[0]?.value ?? 0}</span>
                  <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-destructive" /> At Risk: {gaugeData[1]?.value ?? 0}</span>
                </div>
              </>
            )}
          </ChartContainer>

          <ChartContainer title="Portfolio Heatmap" subtitle="Customer count per risk bucket">
            {loading ? (
              <div className="text-sm text-muted-foreground">Loading heatmap...</div>
            ) : error ? (
              <div className="text-sm text-destructive">{error}</div>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={heatmap} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(214, 32%, 91%)" />
                  <XAxis type="number" tick={{ fontSize: 11 }} stroke="hsl(215, 16%, 47%)" />
                  <YAxis type="category" dataKey="cohort" tick={{ fontSize: 10 }} width={90} stroke="hsl(215, 16%, 47%)" />
                  <Tooltip />
                  <Bar dataKey="bucket0_20" stackId="a" fill="hsl(142, 72%, 37%)" name="0-20" />
                  <Bar dataKey="bucket20_40" stackId="a" fill="hsl(199, 89%, 48%)" name="20-40" />
                  <Bar dataKey="bucket40_60" stackId="a" fill="hsl(38, 92%, 50%)" name="40-60" />
                  <Bar dataKey="bucket60_80" stackId="a" fill="hsl(20, 80%, 50%)" name="60-80" />
                  <Bar dataKey="bucket80_100" stackId="a" fill="hsl(0, 72%, 51%)" name="80-100" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartContainer>
        </div>
      </div>
    </>
  );
}
