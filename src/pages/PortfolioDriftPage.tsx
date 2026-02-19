import { useEffect, useState } from "react";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { ChartContainer } from "@/components/dashboard/ChartContainer";
import {
  getPortfolioHeatmap,
  getPortfolioSummary,
  getRiskTrend,
  type HeatmapRow,
  type PortfolioSummary,
  type RiskTrendPoint,
} from "@/lib/backendApi";
import { Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartTooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
} from "recharts";

export default function PortfolioDriftPage() {
  const [heatmap, setHeatmap] = useState<HeatmapRow[]>([]);
  const [trend, setTrend] = useState<RiskTrendPoint[]>([]);
  const [summary, setSummary] = useState<PortfolioSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);

    Promise.all([getPortfolioHeatmap(), getRiskTrend(), getPortfolioSummary()])
      .then(([heatmapResponse, trendResponse, summaryResponse]) => {
        if (!isMounted) return;
        console.log("Portfolio drift heatmap", heatmapResponse);
        console.log("Portfolio drift trend", trendResponse);
        setHeatmap(heatmapResponse);
        setTrend(trendResponse);
        setSummary(summaryResponse);
      })
      .catch((err) => {
        if (!isMounted) return;
        setError(err instanceof Error ? err.message : "Failed to load portfolio drift data");
      })
      .finally(() => {
        if (!isMounted) return;
        setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <>
      <DashboardHeader title="Portfolio Drift Analytics" subtitle="Aggregate portfolio risk metrics" />
      <div className="flex-1 overflow-auto p-6 space-y-6">
        <TooltipProvider>
          <div className="bg-card rounded-lg p-5 card-shadow border border-border">
            <div className="mb-4">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-foreground">Cohort Risk Heatmap</h3>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    Shows how many customers fall into each delinquency probability range across different customer cohorts.
                  </TooltipContent>
                </Tooltip>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">Customer distribution by delinquency risk level per cohort</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-3 text-muted-foreground font-medium">Cohort</th>
                    <th className="text-center py-2 px-3 text-muted-foreground font-medium">Very Low Risk (0–20%)</th>
                    <th className="text-center py-2 px-3 text-muted-foreground font-medium">Low Risk (20–40%)</th>
                    <th className="text-center py-2 px-3 text-muted-foreground font-medium">Moderate Risk (40–60%)</th>
                    <th className="text-center py-2 px-3 text-muted-foreground font-medium">High Risk (60–80%)</th>
                    <th className="text-center py-2 px-3 text-muted-foreground font-medium">Critical Risk (80–100%)</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="py-4 px-3 text-muted-foreground">Loading heatmap...</td>
                    </tr>
                  ) : error ? (
                    <tr>
                      <td colSpan={6} className="py-4 px-3 text-destructive">{error}</td>
                    </tr>
                  ) : (
                    heatmap.map((row) => (
                      <tr key={row.cohort} className="border-b border-border">
                        <td className="py-2 px-3 font-medium text-foreground">{row.cohort}</td>
                        {[row.bucket0_20, row.bucket20_40, row.bucket40_60, row.bucket60_80, row.bucket80_100].map((val, i) => {
                          const intensity = val / Math.max(1, summary?.total_customers || 1);
                          const bg = i === 0 ? `hsla(142, 72%, 37%, ${Math.max(0.1, intensity)})` :
                            i === 1 ? `hsla(224, 76%, 48%, ${Math.max(0.1, intensity)})` :
                            i === 2 ? `hsla(38, 92%, 50%, ${Math.max(0.1, intensity)})` :
                            i === 3 ? `hsla(20, 80%, 50%, ${Math.max(0.1, intensity)})` :
                              `hsla(0, 72%, 51%, ${Math.max(0.1, intensity)})`;
                          return (
                            <td key={i} className="py-2 px-3 text-center font-medium" style={{ backgroundColor: bg }}>
                              {val}
                            </td>
                          );
                        })}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TooltipProvider>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ChartContainer title="Portfolio Risk Trend" subtitle="Model-driven risk progression">
            {loading ? (
              <div className="text-sm text-muted-foreground">Loading trend...</div>
            ) : error ? (
              <div className="text-sm text-destructive">{error}</div>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={trend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(214, 32%, 91%)" />
                  <XAxis dataKey="week" tick={{ fontSize: 11 }} stroke="hsl(215, 16%, 47%)" />
                  <YAxis tick={{ fontSize: 11 }} stroke="hsl(215, 16%, 47%)" />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line type="monotone" dataKey="avg_risk_score" stroke="hsl(0, 72%, 51%)" strokeWidth={2} dot={false} name="Avg Risk Score" />
                  <Line type="monotone" dataKey="delinquency_probability" stroke="hsl(224, 76%, 48%)" strokeWidth={2} dot={false} name="Delinquency Prob" />
                </LineChart>
              </ResponsiveContainer>
            )}
          </ChartContainer>

          <ChartContainer title="Risk Distribution Summary" subtitle="Current portfolio counts">
            {loading ? (
              <div className="text-sm text-muted-foreground">Loading summary...</div>
            ) : error ? (
              <div className="text-sm text-destructive">{error}</div>
            ) : summary ? (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart
                  data={[
                    { category: "Low", count: summary.low_risk_count },
                    { category: "Medium", count: summary.medium_risk_count },
                    { category: "High", count: summary.high_risk_count },
                  ]}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(214, 32%, 91%)" />
                  <XAxis dataKey="category" tick={{ fontSize: 10 }} stroke="hsl(215, 16%, 47%)" />
                  <YAxis tick={{ fontSize: 10 }} stroke="hsl(215, 16%, 47%)" />
                  <Tooltip />
                  <Bar dataKey="count" fill="hsl(224, 76%, 48%)" name="Customers" />
                </BarChart>
              </ResponsiveContainer>
            ) : null}
          </ChartContainer>
        </div>
      </div>
    </>
  );
}
