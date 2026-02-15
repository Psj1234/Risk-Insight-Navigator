import { useState } from "react";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { ChartContainer } from "@/components/dashboard/ChartContainer";
import { featureImportance, customers, type Customer } from "@/lib/mockData";
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
import { AlertTriangle, Info } from "lucide-react";

export default function ExplainabilityPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const selectedCustomer = selectedId ? customers.find(c => c.id === selectedId) : null;

  const openPrediction = (c: Customer) => {
    setSelectedId(c.id);
    setModalOpen(true);
  };

  const topFlagged = customers.filter(c => c.riskScore >= 50).sort((a, b) => b.riskScore - a.riskScore).slice(0, 20);

  // Decision tree mock
  const treeNodes = [
    { id: 1, label: "Salary Delay > 3 days?", yes: 2, no: 3, depth: 0 },
    { id: 2, label: "Credit Util > 70%?", yes: 4, no: 5, depth: 1 },
    { id: 3, label: "Low Risk", yes: null, no: null, depth: 1, leaf: true, risk: "Low" },
    { id: 4, label: "High Risk", yes: null, no: null, depth: 2, leaf: true, risk: "High" },
    { id: 5, label: "Savings < £2000?", yes: 6, no: 7, depth: 2 },
    { id: 6, label: "Moderate Risk", yes: null, no: null, depth: 3, leaf: true, risk: "Moderate" },
    { id: 7, label: "Early Stress", yes: null, no: null, depth: 3, leaf: true, risk: "Early Stress" },
  ];

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
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={featureImportance} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(214, 32%, 91%)" />
              <XAxis type="number" tick={{ fontSize: 11 }} stroke="hsl(215, 16%, 47%)" />
              <YAxis type="category" dataKey="feature" width={150} tick={{ fontSize: 11 }} stroke="hsl(215, 16%, 47%)" />
              <Tooltip formatter={(val: number) => `${(val * 100).toFixed(0)}%`} />
              <Bar dataKey="importance" name="Importance" radius={[0, 4, 4, 0]}>
                {featureImportance.map((_, i) => (
                  <Cell key={i} fill={`hsl(224, ${76 - i * 6}%, ${48 + i * 4}%)`} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartContainer>

        {/* Decision Tree */}
        <ChartContainer title="Simplified Decision Tree" subtitle="Illustrative model logic path">
          <div className="overflow-x-auto py-4">
            <div className="flex flex-col items-center gap-2 min-w-[600px]">
              {[0, 1, 2, 3].map(depth => {
                const nodesAtDepth = treeNodes.filter(n => n.depth === depth);
                return (
                  <div key={depth} className="flex gap-8 justify-center items-center">
                    {nodesAtDepth.map(node => (
                      <div
                        key={node.id}
                        className={`px-4 py-2 rounded-lg text-xs font-medium border text-center ${
                          (node as any).leaf
                            ? (node as any).risk === "High" ? "bg-destructive/10 text-destructive border-destructive/20"
                            : (node as any).risk === "Moderate" ? "bg-warning/10 text-warning border-warning/20"
                            : (node as any).risk === "Early Stress" ? "bg-primary/10 text-primary border-primary/20"
                            : "bg-success/10 text-success border-success/20"
                            : "bg-card text-foreground border-border card-shadow"
                        }`}
                      >
                        {node.label}
                        {!(node as any).leaf && (
                          <div className="flex justify-center gap-6 mt-1 text-[10px] text-muted-foreground">
                            <span>↙ Yes</span>
                            <span>↘ No</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        </ChartContainer>

        {/* Individual Prediction */}
        <ChartContainer title="Individual Prediction Explorer" subtitle="Select a customer to see their prediction breakdown">
          <div className="flex items-center gap-4 mb-4">
            <Select onValueChange={v => { setSelectedId(v); setModalOpen(true); }}>
              <SelectTrigger className="w-72">
                <SelectValue placeholder="Select a customer..." />
              </SelectTrigger>
              <SelectContent>
                {topFlagged.map(c => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.id} — {c.name} (Score: {c.riskScore})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {topFlagged.slice(0, 8).map(c => (
              <button
                key={c.id}
                onClick={() => openPrediction(c)}
                className="bg-muted/50 border border-border rounded-lg p-3 text-left hover:bg-muted transition-colors"
              >
                <p className="text-xs font-mono text-muted-foreground">{c.id}</p>
                <p className="text-sm font-medium text-foreground mt-0.5">{c.name}</p>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-lg font-bold text-foreground">{c.riskScore}</span>
                  <Badge variant={c.riskCategory === "High" ? "destructive" : "secondary"} className="text-[10px]">
                    {c.riskCategory}
                  </Badge>
                </div>
              </button>
            ))}
          </div>
        </ChartContainer>

        {/* Prediction Modal */}
        <Dialog open={modalOpen} onOpenChange={setModalOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Prediction Breakdown — {selectedCustomer?.id}</DialogTitle>
              <DialogDescription>{selectedCustomer?.name} · {selectedCustomer?.accountType}</DialogDescription>
            </DialogHeader>
            {selectedCustomer && (
              <div className="space-y-4">
                <div className="flex gap-4">
                  <div className="bg-muted rounded-md p-3 flex-1 text-center">
                    <p className="text-xs text-muted-foreground">Risk Score</p>
                    <p className="text-2xl font-bold text-foreground">{selectedCustomer.riskScore}</p>
                  </div>
                  <div className="bg-muted rounded-md p-3 flex-1 text-center">
                    <p className="text-xs text-muted-foreground">Category</p>
                    <p className="text-sm font-semibold text-foreground mt-1">{selectedCustomer.riskCategory}</p>
                  </div>
                  <div className="bg-muted rounded-md p-3 flex-1 text-center">
                    <p className="text-xs text-muted-foreground">Top Signal</p>
                    <p className="text-sm font-semibold text-foreground mt-1">{selectedCustomer.topSignal}</p>
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-semibold text-foreground mb-2">SHAP Feature Contributions</h4>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={selectedCustomer.shapValues.sort((a, b) => Math.abs(b.value) - Math.abs(a.value))} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(214, 32%, 91%)" />
                      <XAxis type="number" tick={{ fontSize: 10 }} stroke="hsl(215, 16%, 47%)" />
                      <YAxis type="category" dataKey="feature" width={130} tick={{ fontSize: 10 }} stroke="hsl(215, 16%, 47%)" />
                      <Tooltip />
                      <Bar dataKey="value" name="Impact">
                        {selectedCustomer.shapValues.sort((a, b) => Math.abs(b.value) - Math.abs(a.value)).map((entry, i) => (
                          <Cell key={i} fill={entry.direction === "positive" ? "hsl(0, 72%, 51%)" : "hsl(224, 76%, 48%)"} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="bg-muted/50 border border-border rounded-md p-3 flex items-start gap-2">
                  <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                  <p className="text-xs text-muted-foreground">
                    This prediction is generated by the pre-delinquency model and is advisory only.
                    All intervention decisions require human approval by the assigned risk officer.
                  </p>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
}
