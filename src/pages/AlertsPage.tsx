import { useEffect, useState } from "react";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { CUSTOMER_SAMPLE_LIMIT, getCustomerDrilldown, getCustomerRiskList, type CustomerDrilldown, type CustomerRiskItem } from "@/lib/backendApi";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ChevronDown, ChevronRight, Send, CheckCircle } from "lucide-react";
import { toast } from "sonner";

const FIXED_TO_EMAIL = "sohamjagushte2@gmail.com";

type InterventionStatus = "none" | "offered" | "accepted" | "declined";

const interventionOptions = [
  "Payment holiday offer",
  "EMI date shift",
  "Temporary EMI reduction",
  "Restructuring discussion",
  "Auto-debit retry scheduling",
];

const riskBadgeColor = (cat: string) => {
  if (cat === "HIGH") return "bg-destructive/10 text-destructive border-destructive/20";
  if (cat === "MEDIUM") return "bg-warning/10 text-warning border-warning/20";
  return "bg-muted text-muted-foreground";
};

const statusBadge = (s: InterventionStatus) => {
  const map: Record<InterventionStatus, { label: string; cls: string }> = {
    none: { label: "Pending Review", cls: "bg-muted text-muted-foreground" },
    offered: { label: "Offer Sent", cls: "bg-primary/10 text-primary" },
    accepted: { label: "Accepted", cls: "bg-success/10 text-success" },
    declined: { label: "Declined", cls: "bg-destructive/10 text-destructive" },
  };
  const { label, cls } = map[s];
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cls}`}>{label}</span>;
};

export default function AlertsPage() {
  const [riskFilter, setRiskFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerRiskItem | null>(null);
  const [drilldownMap, setDrilldownMap] = useState<Record<string, CustomerDrilldown>>({});
  const [selectedIntervention, setSelectedIntervention] = useState(interventionOptions[0]);
  const [officerNotes, setOfficerNotes] = useState("");
  const [interventionStatuses, setInterventionStatuses] = useState<Record<string, InterventionStatus>>({});
  const [isSending, setIsSending] = useState(false);
  const [customers, setCustomers] = useState<CustomerRiskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);

    getCustomerRiskList(CUSTOMER_SAMPLE_LIMIT)
      .then((response) => {
        if (!isMounted) return;
        console.log("Alerts customer list", response);
        setCustomers(response);
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

  const alertCustomers = customers
    .filter(c => c.risk_probability >= 0.3)
    .sort((a, b) => b.risk_probability - a.risk_probability)
    .filter(c => riskFilter === "all" || c.risk_category === riskFilter)
    .filter(c => {
      const status = interventionStatuses[c.customer_id] || "none";
      return statusFilter === "all" || status === statusFilter;
    });

  const getStatus = (c: CustomerRiskItem) => interventionStatuses[c.customer_id] || "none";

  const ensureDrilldown = async (customerId: string) => {
    if (drilldownMap[customerId]) return;
    try {
      const detail = await getCustomerDrilldown(customerId);
      setDrilldownMap((prev) => ({ ...prev, [customerId]: detail }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load drilldown");
    }
  };

  const getTopSignal = (customerId: string) => {
    const features = drilldownMap[customerId]?.contributing_features;
    return features ? Object.keys(features)[0] : "Loading";
  };

  const handleSendOffer = async () => {
    if (!selectedCustomer || isSending) return;
    setIsSending(true);
    try {
      const response = await fetch("/api/send-intervention", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: selectedCustomer.customer_id,
          customerName: selectedCustomer.customer_id,
          topSignal: drilldownMap[selectedCustomer.customer_id]?.contributing_features ? Object.keys(drilldownMap[selectedCustomer.customer_id].contributing_features)[0] : "N/A",
          selectedIntervention,
          officerNotes,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Email send failed");
      }

      setInterventionStatuses(prev => ({ ...prev, [selectedCustomer.customer_id]: "offered" }));
      setEmailModalOpen(false);
      setOfficerNotes("");
      toast.success(`Intervention offer sent to ${selectedCustomer.customer_id}`, {
        description: `Type: ${selectedIntervention} · To: ${FIXED_TO_EMAIL}`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Email send failed";
      toast.error("Unable to send intervention email", {
        description: message,
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleMarkReviewed = (customer: CustomerRiskItem) => {
    setInterventionStatuses(prev => ({ ...prev, [customer.customer_id]: "none" }));
    toast.info(`${customer.customer_id} marked as reviewed — no action taken.`);
  };

  return (
    <>
      <DashboardHeader title="Pre-Delinquency Alerts & Interventions" subtitle="Monitor flagged customers and manage interventions" />
      <div className="flex-1 overflow-auto p-6 space-y-4">
        {/* Filters */}
        <div className="bg-card rounded-lg p-4 card-shadow border border-border flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-foreground">Risk Category:</label>
            <Select value={riskFilter} onValueChange={setRiskFilter}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="HIGH">High</SelectItem>
                <SelectItem value="MEDIUM">Medium</SelectItem>
                <SelectItem value="LOW">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-foreground">Status:</label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="none">Pending</SelectItem>
                <SelectItem value="offered">Offered</SelectItem>
                <SelectItem value="accepted">Accepted</SelectItem>
                <SelectItem value="declined">Declined</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <span className="text-sm text-muted-foreground ml-auto">{alertCustomers.length} customers</span>
        </div>

        {/* Alert Table */}
        <div className="bg-card rounded-lg card-shadow border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8"></TableHead>
                <TableHead>Customer ID</TableHead>
                <TableHead className="text-center">Risk Probability</TableHead>
                <TableHead>Top Signal</TableHead>
                <TableHead>Risk Category</TableHead>
                <TableHead>Intervention Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-sm text-muted-foreground">Loading customers...</TableCell>
                </TableRow>
              ) : error ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-sm text-destructive">{error}</TableCell>
                </TableRow>
              ) : alertCustomers.map(c => (
                <>
                  <TableRow
                    key={c.customer_id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => {
                      const nextId = expandedId === c.customer_id ? null : c.customer_id;
                      setExpandedId(nextId);
                      if (nextId) {
                        ensureDrilldown(nextId);
                      }
                    }}
                  >
                    <TableCell>
                      {expandedId === c.customer_id ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                    </TableCell>
                    <TableCell className="font-mono text-sm">{c.customer_id}</TableCell>
                    <TableCell className="text-center font-bold text-sm">{(c.risk_probability * 100).toFixed(1)}%</TableCell>
                    <TableCell className="text-sm">{getTopSignal(c.customer_id)}</TableCell>
                    <TableCell>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${riskBadgeColor(c.risk_category)}`}>
                        {c.risk_category}
                      </span>
                    </TableCell>
                    <TableCell>{statusBadge(getStatus(c))}</TableCell>
                  </TableRow>
                  {expandedId === c.customer_id && (
                    <TableRow key={`${c.customer_id}-expanded`}>
                      <TableCell colSpan={6} className="bg-muted/30 p-5">
                        <div className="space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Signal Explanation */}
                            <div>
                              <h4 className="text-sm font-semibold text-foreground mb-2">Signal Explanation</h4>
                              <p className="text-sm text-muted-foreground">
                                Primary signal: <strong>{getTopSignal(c.customer_id)}</strong>. Risk score reflects current behavioural and liquidity patterns.
                              </p>
                            </div>

                            {/* Intervention Control Panel */}
                            <div className="bg-card border border-border rounded-lg p-4">
                              <h4 className="text-sm font-semibold text-foreground mb-3">Intervention Control Panel</h4>
                              <div className="space-y-3">
                                <div>
                                  <label className="text-xs font-medium text-muted-foreground">Select Intervention</label>
                                  <Select value={selectedIntervention} onValueChange={setSelectedIntervention}>
                                    <SelectTrigger className="mt-1">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {interventionOptions.map(o => (
                                        <SelectItem key={o} value={o}>{o}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div>
                                  <label className="text-xs font-medium text-muted-foreground">Officer Notes</label>
                                  <Textarea
                                    className="mt-1 text-sm"
                                    placeholder="Add review notes..."
                                    value={officerNotes}
                                    onChange={e => setOfficerNotes(e.target.value)}
                                    rows={2}
                                  />
                                </div>
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    onClick={() => {
                                      setSelectedCustomer(c);
                                      setEmailModalOpen(true);
                                    }}
                                  >
                                    <Send className="h-3.5 w-3.5 mr-1.5" />
                                    Send Offer to Customer
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleMarkReviewed(c)}
                                  >
                                    <CheckCircle className="h-3.5 w-3.5 mr-1.5" />
                                    Mark as Reviewed
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* History */}
                          {(c as { interventionHistory?: { date: string; type: string; status: string; officerNotes: string; }[] }).interventionHistory?.length ? (
                            <div>
                              <h4 className="text-sm font-semibold text-foreground mb-2">Intervention History</h4>
                              {(c as { interventionHistory?: { date: string; type: string; status: string; officerNotes: string; }[] }).interventionHistory?.map((h, i) => (
                                <div key={i} className="text-xs text-muted-foreground border-l-2 border-border pl-3 py-1">
                                  <span className="font-medium text-foreground">{h.date}</span> — {h.type} ({h.status}): {h.officerNotes}
                                </div>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </>
                  ))}
            </TableBody>
          </Table>
        </div>

        {/* Email Preview Modal */}
        <Dialog open={emailModalOpen} onOpenChange={setEmailModalOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Email Preview</DialogTitle>
              <DialogDescription>Review the intervention email before sending</DialogDescription>
            </DialogHeader>
            {selectedCustomer && (
              <div className="space-y-3 text-sm">
                <div className="bg-muted rounded-md p-4 space-y-2">
                  <div><strong>To:</strong> {FIXED_TO_EMAIL}</div>
                  <div><strong>Subject:</strong> Support Options Available — {selectedCustomer.customer_id}</div>
                  <hr className="border-border" />
                  <div className="space-y-2 text-muted-foreground">
                    <p>Dear {selectedCustomer.customer_id},</p>
                    <p>
                      We have noticed some changes in your financial activity and would like to offer support.
                      Our analysis indicates potential financial stress signals related to{" "}
                      <strong>{getTopSignal(selectedCustomer.customer_id).toLowerCase()}</strong>.
                    </p>
                    <p>
                      We would like to offer you the following support option:{" "}
                      <strong>{selectedIntervention}</strong>.
                    </p>
                    <p>
                      Please contact your relationship manager to discuss this further.
                      We are here to help you manage your finances effectively.
                    </p>
                    <p>Kind regards,<br />Financial Support Team</p>
                  </div>
                </div>
                {officerNotes && (
                  <div>
                    <p className="text-xs text-muted-foreground"><strong>Officer Notes:</strong> {officerNotes}</p>
                  </div>
                )}
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setEmailModalOpen(false)} disabled={isSending}>Cancel</Button>
              <Button onClick={handleSendOffer} disabled={isSending}>
                <Send className="h-3.5 w-3.5 mr-1.5" />
                {isSending ? "Sending..." : "Confirm & Send"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
}
