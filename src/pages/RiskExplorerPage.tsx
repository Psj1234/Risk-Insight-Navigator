import { useState } from "react";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { ChartContainer } from "@/components/dashboard/ChartContainer";
import { customers, type Customer } from "@/lib/mockData";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell,
} from "recharts";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

const riskBadge = (cat: string) => {
  const v = cat === "High" ? "destructive" : cat === "Moderate" ? "secondary" : cat === "Early Stress" ? "outline" : "secondary";
  return <Badge variant={v as any} className={cat === "Moderate" ? "bg-warning/10 text-warning border-warning/30" : cat === "Early Stress" ? "border-primary/30 text-primary" : ""}>{cat}</Badge>;
};

const signalBadge = (strength: string) => {
  const cls = strength === "Strong" ? "bg-destructive/10 text-destructive" : strength === "Moderate" ? "bg-warning/10 text-warning" : "bg-muted text-muted-foreground";
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cls}`}>{strength}</span>;
};

export default function RiskExplorerPage() {
  const [selectedId, setSelectedId] = useState(customers.filter(c => c.riskScore >= 50)[0]?.id || customers[0].id);
  const customer = customers.find(c => c.id === selectedId) as Customer;

  const highRiskCustomers = customers.filter(c => c.riskScore >= 40).sort((a, b) => b.riskScore - a.riskScore).slice(0, 30);

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
              {highRiskCustomers.map(c => (
                <SelectItem key={c.id} value={c.id}>
                  {c.id} — {c.name} (Score: {c.riskScore})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-3 ml-auto">
            {riskBadge(customer.riskCategory)}
            <span className="text-sm text-muted-foreground">Score: <strong className="text-foreground">{customer.riskScore}</strong></span>
            <span className="text-sm text-muted-foreground">{customer.accountType}</span>
          </div>
        </div>

        {/* Trend Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ChartContainer title="Risk Score Trend" subtitle="60-day trailing view">
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={customer.riskScoreTrend.slice(-30)}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(214, 32%, 91%)" />
                <XAxis dataKey="date" tick={{ fontSize: 9 }} stroke="hsl(215, 16%, 47%)" />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} stroke="hsl(215, 16%, 47%)" />
                <Tooltip />
                <Line type="monotone" dataKey="value" stroke="hsl(0, 72%, 51%)" strokeWidth={2} dot={false} name="Risk Score" />
              </LineChart>
            </ResponsiveContainer>
          </ChartContainer>

          <ChartContainer title="Savings Balance Trend" subtitle="60-day trailing view">
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={customer.savingsBalanceTrend.slice(-30)}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(214, 32%, 91%)" />
                <XAxis dataKey="date" tick={{ fontSize: 9 }} stroke="hsl(215, 16%, 47%)" />
                <YAxis tick={{ fontSize: 10 }} stroke="hsl(215, 16%, 47%)" />
                <Tooltip />
                <Line type="monotone" dataKey="value" stroke="hsl(224, 76%, 48%)" strokeWidth={2} dot={false} name="Savings (£)" />
              </LineChart>
            </ResponsiveContainer>
          </ChartContainer>

          <ChartContainer title="Salary Credit Delay Shift" subtitle="Days delayed from expected date">
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={customer.salaryDelayTrend.slice(-30)}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(214, 32%, 91%)" />
                <XAxis dataKey="date" tick={{ fontSize: 9 }} stroke="hsl(215, 16%, 47%)" />
                <YAxis tick={{ fontSize: 10 }} stroke="hsl(215, 16%, 47%)" />
                <Tooltip />
                <Line type="monotone" dataKey="value" stroke="hsl(38, 92%, 50%)" strokeWidth={2} dot={false} name="Delay (days)" />
              </LineChart>
            </ResponsiveContainer>
          </ChartContainer>

          <ChartContainer title="Credit Utilization Trend" subtitle="Percentage over time">
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={customer.creditUtilizationTrend.slice(-30)}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(214, 32%, 91%)" />
                <XAxis dataKey="date" tick={{ fontSize: 9 }} stroke="hsl(215, 16%, 47%)" />
                <YAxis tick={{ fontSize: 10 }} stroke="hsl(215, 16%, 47%)" />
                <Tooltip />
                <Line type="monotone" dataKey="value" stroke="hsl(20, 80%, 50%)" strokeWidth={2} dot={false} name="Utilization (%)" />
              </LineChart>
            </ResponsiveContainer>
          </ChartContainer>
        </div>

        {/* Deviation Table */}
        <div className="bg-card rounded-lg p-5 card-shadow border border-border">
          <h3 className="text-sm font-semibold text-foreground mb-4">Behavioural Deviation Analysis</h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Feature</TableHead>
                <TableHead className="text-right">Current</TableHead>
                <TableHead className="text-right">Baseline</TableHead>
                <TableHead className="text-right">Deviation (%)</TableHead>
                <TableHead>Signal Strength</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customer.deviations.map(d => (
                <TableRow key={d.feature}>
                  <TableCell className="font-medium text-sm">{d.feature}</TableCell>
                  <TableCell className="text-right text-sm">{d.current.toLocaleString()}</TableCell>
                  <TableCell className="text-right text-sm">{d.baseline.toLocaleString()}</TableCell>
                  <TableCell className="text-right text-sm">{d.deviation > 0 ? "+" : ""}{d.deviation}%</TableCell>
                  <TableCell>{signalBadge(d.signalStrength)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* SHAP Chart */}
        <ChartContainer title="Why This Customer is Flagged" subtitle="Top contributing factors (SHAP-style analysis)">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={customer.shapValues.sort((a, b) => Math.abs(b.value) - Math.abs(a.value))} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(214, 32%, 91%)" />
              <XAxis type="number" tick={{ fontSize: 10 }} stroke="hsl(215, 16%, 47%)" />
              <YAxis type="category" dataKey="feature" width={140} tick={{ fontSize: 10 }} stroke="hsl(215, 16%, 47%)" />
              <Tooltip />
              <Bar dataKey="value" name="Impact">
                {customer.shapValues.sort((a, b) => Math.abs(b.value) - Math.abs(a.value)).map((entry, i) => (
                  <Cell key={i} fill={entry.direction === "positive" ? "hsl(0, 72%, 51%)" : "hsl(224, 76%, 48%)"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="flex gap-4 mt-2 text-xs text-muted-foreground justify-center">
            <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-destructive" /> Increases risk</span>
            <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-primary" /> Decreases risk</span>
          </div>
        </ChartContainer>
      </div>
    </>
  );
}
