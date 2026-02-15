import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { ChartContainer } from "@/components/dashboard/ChartContainer";
import { customers, cohortHeatmapData } from "@/lib/mockData";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ScatterChart, Scatter, BarChart, Bar, Legend,
} from "recharts";

const creditUtilTrend = (() => {
  const weeks: { week: string; avg: number; p90: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i * 7);
    const subset = customers.slice(0, 40);
    const avg = subset.reduce((s, c) => s + c.creditUtilization, 0) / subset.length * 100;
    weeks.push({
      week: `W${12 - i}`,
      avg: parseFloat(avg.toFixed(1)),
      p90: parseFloat((avg + 15 + Math.random() * 10).toFixed(1)),
    });
  }
  return weeks;
})();

const liquidityStressIndex = (() => {
  const weeks: { week: string; index: number }[] = [];
  let val = 0.35;
  for (let i = 0; i < 12; i++) {
    val += (Math.random() - 0.45) * 0.05;
    val = Math.max(0, Math.min(1, val));
    weeks.push({ week: `W${i + 1}`, index: parseFloat(val.toFixed(3)) });
  }
  return weeks;
})();

const scatterData = customers.map(c => ({
  originationScore: c.originationScore,
  riskScore: c.riskScore,
  name: c.name,
}));

const signalBreakdown = [
  { signal: "Salary Delay", high: 28, moderate: 15, low: 8 },
  { signal: "Savings Decline", high: 22, moderate: 18, low: 12 },
  { signal: "Credit Util", high: 18, moderate: 20, low: 15 },
  { signal: "ATM Spike", high: 12, moderate: 10, low: 8 },
  { signal: "Payment Irreg", high: 15, moderate: 12, low: 6 },
  { signal: "Overdraft Use", high: 10, moderate: 14, low: 10 },
];

export default function PortfolioDriftPage() {
  return (
    <>
      <DashboardHeader title="Portfolio Drift Analytics" subtitle="Aggregate portfolio risk metrics" />
      <div className="flex-1 overflow-auto p-6 space-y-6">
        {/* Cohort Heatmap */}
        <ChartContainer title="Cohort Risk Heatmap" subtitle="Customer distribution by risk bucket per origination cohort">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-3 text-muted-foreground font-medium">Cohort</th>
                  <th className="text-center py-2 px-3 text-muted-foreground font-medium">0–30</th>
                  <th className="text-center py-2 px-3 text-muted-foreground font-medium">30–50</th>
                  <th className="text-center py-2 px-3 text-muted-foreground font-medium">50–75</th>
                  <th className="text-center py-2 px-3 text-muted-foreground font-medium">75–100</th>
                </tr>
              </thead>
              <tbody>
                {cohortHeatmapData.map(row => (
                  <tr key={row.cohort} className="border-b border-border">
                    <td className="py-2 px-3 font-medium text-foreground">{row.cohort}</td>
                    {[row.bucket0_30, row.bucket30_50, row.bucket50_75, row.bucket75_100].map((val, i) => {
                      const intensity = val / 100;
                      const bg = i === 0 ? `hsla(142, 72%, 37%, ${Math.max(0.1, intensity)})` :
                                 i === 1 ? `hsla(224, 76%, 48%, ${Math.max(0.1, intensity)})` :
                                 i === 2 ? `hsla(38, 92%, 50%, ${Math.max(0.1, intensity)})` :
                                           `hsla(0, 72%, 51%, ${Math.max(0.1, intensity)})`;
                      return (
                        <td key={i} className="py-2 px-3 text-center font-medium" style={{ backgroundColor: bg }}>
                          {val}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ChartContainer>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ChartContainer title="Credit Utilization Trend" subtitle="Portfolio average & P90">
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={creditUtilTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(214, 32%, 91%)" />
                <XAxis dataKey="week" tick={{ fontSize: 11 }} stroke="hsl(215, 16%, 47%)" />
                <YAxis tick={{ fontSize: 11 }} stroke="hsl(215, 16%, 47%)" />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="avg" stroke="hsl(224, 76%, 48%)" strokeWidth={2} dot={false} name="Average %" />
                <Line type="monotone" dataKey="p90" stroke="hsl(0, 72%, 51%)" strokeWidth={2} dot={false} strokeDasharray="5 5" name="P90 %" />
              </LineChart>
            </ResponsiveContainer>
          </ChartContainer>

          <ChartContainer title="Liquidity Stress Index" subtitle="Portfolio-wide stress indicator (0=low, 1=high)">
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={liquidityStressIndex}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(214, 32%, 91%)" />
                <XAxis dataKey="week" tick={{ fontSize: 11 }} stroke="hsl(215, 16%, 47%)" />
                <YAxis domain={[0, 1]} tick={{ fontSize: 11 }} stroke="hsl(215, 16%, 47%)" />
                <Tooltip />
                <Line type="monotone" dataKey="index" stroke="hsl(38, 92%, 50%)" strokeWidth={2} dot={false} name="Stress Index" />
              </LineChart>
            </ResponsiveContainer>
          </ChartContainer>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ChartContainer title="Origination Score vs Current Risk" subtitle="Scatter: each dot is a customer">
            <ResponsiveContainer width="100%" height={280}>
              <ScatterChart>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(214, 32%, 91%)" />
                <XAxis type="number" dataKey="originationScore" name="Origination" tick={{ fontSize: 10 }} stroke="hsl(215, 16%, 47%)" label={{ value: "Origination Score", position: "bottom", fontSize: 10, fill: "hsl(215, 16%, 47%)" }} />
                <YAxis type="number" dataKey="riskScore" name="Risk Score" tick={{ fontSize: 10 }} stroke="hsl(215, 16%, 47%)" label={{ value: "Risk Score", angle: -90, position: "insideLeft", fontSize: 10, fill: "hsl(215, 16%, 47%)" }} />
                <Tooltip cursor={{ strokeDasharray: "3 3" }} />
                <Scatter data={scatterData} fill="hsl(224, 76%, 48%)" fillOpacity={0.5} />
              </ScatterChart>
            </ResponsiveContainer>
          </ChartContainer>

          <ChartContainer title="Signal Intensity Breakdown" subtitle="By risk category">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={signalBreakdown}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(214, 32%, 91%)" />
                <XAxis dataKey="signal" tick={{ fontSize: 9 }} stroke="hsl(215, 16%, 47%)" />
                <YAxis tick={{ fontSize: 10 }} stroke="hsl(215, 16%, 47%)" />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="high" stackId="a" fill="hsl(0, 72%, 51%)" name="High" />
                <Bar dataKey="moderate" stackId="a" fill="hsl(38, 92%, 50%)" name="Moderate" />
                <Bar dataKey="low" stackId="a" fill="hsl(142, 72%, 37%)" name="Low" />
              </BarChart>
            </ResponsiveContainer>
          </ChartContainer>
        </div>
      </div>
    </>
  );
}
