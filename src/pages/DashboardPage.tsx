import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { ChartContainer } from "@/components/dashboard/ChartContainer";
import { portfolioMetrics, riskDistribution, weeklyRiskTrend, customers } from "@/lib/mockData";
import { Users, AlertTriangle, ShieldAlert, Activity } from "lucide-react";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Legend,
  BarChart, Bar,
} from "recharts";

const gaugeData = [
  { name: "Healthy", value: portfolioMetrics.lowRisk + portfolioMetrics.earlyStress },
  { name: "At Risk", value: portfolioMetrics.moderateRisk + portfolioMetrics.highRisk },
];

const heatmapData = (() => {
  const buckets = ["0-20", "20-40", "40-60", "60-80", "80-100"];
  const products = ["Personal Loan", "Mortgage", "Credit Card", "Auto Loan", "Overdraft"];
  return products.map(product => {
    const custs = customers.filter(c => c.accountType === product);
    const row: Record<string, string | number> = { product };
    buckets.forEach(bucket => {
      const [min, max] = bucket.split("-").map(Number);
      row[bucket] = custs.filter(c => c.riskScore >= min && c.riskScore < max).length;
    });
    return row;
  });
})();

export default function DashboardPage() {
  return (
    <>
      <DashboardHeader title="Executive Dashboard" subtitle="Pre-Delinquency Early Warning Overview" />
      <div className="flex-1 overflow-auto p-6 space-y-6">
        {/* Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="Total Monitored"
            value={portfolioMetrics.totalCustomers.toLocaleString()}
            icon={Users}
            subtitle="Active customer accounts"
            variant="primary"
          />
          <MetricCard
            title="High Risk"
            value={portfolioMetrics.highRisk}
            icon={ShieldAlert}
            variant="danger"
            trend={{ value: 8, label: "vs last week" }}
          />
          <MetricCard
            title="Moderate Risk"
            value={portfolioMetrics.moderateRisk}
            icon={AlertTriangle}
            variant="warning"
            trend={{ value: 3, label: "vs last week" }}
          />
          <MetricCard
            title="Early Stress Detected"
            value={portfolioMetrics.earlyStress}
            icon={Activity}
            variant="primary"
            trend={{ value: -5, label: "vs last week" }}
          />
        </div>

        {/* Charts Row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <ChartContainer title="Risk Distribution" subtitle="Current portfolio breakdown">
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
          </ChartContainer>

          <ChartContainer title="Weekly Risk Trend" subtitle="12-week rolling view" className="lg:col-span-2">
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={weeklyRiskTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(214, 32%, 91%)" />
                <XAxis dataKey="week" tick={{ fontSize: 11 }} stroke="hsl(215, 16%, 47%)" />
                <YAxis tick={{ fontSize: 11 }} stroke="hsl(215, 16%, 47%)" />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="high" stroke="hsl(0, 72%, 51%)" strokeWidth={2} dot={false} name="High" />
                <Line type="monotone" dataKey="moderate" stroke="hsl(38, 92%, 50%)" strokeWidth={2} dot={false} name="Moderate" />
                <Line type="monotone" dataKey="earlyStress" stroke="hsl(224, 76%, 48%)" strokeWidth={2} dot={false} name="Early Stress" />
                <Line type="monotone" dataKey="low" stroke="hsl(142, 72%, 37%)" strokeWidth={2} dot={false} name="Low" />
              </LineChart>
            </ResponsiveContainer>
          </ChartContainer>
        </div>

        {/* Charts Row 2 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ChartContainer title="Portfolio Health Gauge" subtitle="Healthy vs At-Risk ratio">
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
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-success" /> Healthy: {gaugeData[0].value}</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-destructive" /> At Risk: {gaugeData[1].value}</span>
            </div>
          </ChartContainer>

          <ChartContainer title="Risk Heatmap by Product" subtitle="Customer count per risk bucket">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={heatmapData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(214, 32%, 91%)" />
                <XAxis type="number" tick={{ fontSize: 11 }} stroke="hsl(215, 16%, 47%)" />
                <YAxis type="category" dataKey="product" tick={{ fontSize: 10 }} width={90} stroke="hsl(215, 16%, 47%)" />
                <Tooltip />
                <Bar dataKey="0-20" stackId="a" fill="hsl(142, 72%, 37%)" name="0-20" />
                <Bar dataKey="20-40" stackId="a" fill="hsl(199, 89%, 48%)" name="20-40" />
                <Bar dataKey="40-60" stackId="a" fill="hsl(38, 92%, 50%)" name="40-60" />
                <Bar dataKey="60-80" stackId="a" fill="hsl(20, 80%, 50%)" name="60-80" />
                <Bar dataKey="80-100" stackId="a" fill="hsl(0, 72%, 51%)" name="80-100" />
              </BarChart>
            </ResponsiveContainer>
          </ChartContainer>
        </div>
      </div>
    </>
  );
}
