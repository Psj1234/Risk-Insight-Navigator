// Mock data for Pre-Delinquency Early Warning Dashboard

const firstNames = ["James","Sarah","Michael","Emma","David","Olivia","Robert","Sophia","William","Isabella","John","Mia","Richard","Charlotte","Thomas","Amelia","Daniel","Emily","Matthew","Abigail","Charles","Evelyn","Joseph","Harper","Andrew","Ella","Christopher","Grace","George","Victoria","Edward","Lily","Henry","Chloe","Benjamin","Zoe","Samuel","Hannah","Alexander","Aria","Nathan","Lucy","Patrick","Nora","Simon","Stella","Peter","Layla","Mark","Riley"];
const lastNames = ["Smith","Johnson","Williams","Brown","Jones","Garcia","Miller","Davis","Rodriguez","Martinez","Hernandez","Lopez","Gonzalez","Wilson","Anderson","Thomas","Taylor","Moore","Jackson","Martin","Lee","Perez","Thompson","White","Harris","Sanchez","Clark","Ramirez","Lewis","Robinson","Walker","Young","Allen","King","Wright","Scott","Torres","Nguyen","Hill","Flores","Green","Adams","Nelson","Baker","Hall","Rivera","Campbell","Mitchell","Carter","Roberts"];

const signals = [
  "Salary credit delay shift",
  "Savings balance decline",
  "Credit utilization spike",
  "ATM withdrawal increase",
  "Missed utility payments",
  "Reduced discretionary spending",
  "Overdraft frequency increase",
  "Payment pattern irregularity",
  "Balance volatility increase",
  "Direct debit bounce",
];

const interventionTypes = [
  "Payment holiday offer",
  "EMI date shift",
  "Temporary EMI reduction",
  "Restructuring discussion",
  "Auto-debit retry scheduling",
];

function rand(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randFloat(min: number, max: number, decimals = 2) {
  return parseFloat((Math.random() * (max - min) + min).toFixed(decimals));
}

function pickRandom<T>(arr: T[]): T {
  return arr[rand(0, arr.length - 1)];
}

function generateTimeSeries(days: number, baseValue: number, volatility: number, trend: number = 0) {
  const data: { date: string; value: number }[] = [];
  let value = baseValue;
  const now = new Date();
  for (let i = days; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    value += trend + (Math.random() - 0.5) * volatility;
    value = Math.max(0, value);
    data.push({ date: d.toISOString().split("T")[0], value: parseFloat(value.toFixed(2)) });
  }
  return data;
}

export type RiskCategory = "High" | "Moderate" | "Low" | "Early Stress";
export type InterventionStatus = "none" | "offered" | "accepted" | "declined";

export interface InterventionRecord {
  date: string;
  type: string;
  officerNotes: string;
  status: InterventionStatus;
}

export interface Customer {
  id: string;
  name: string;
  email: string;
  age: number;
  accountType: string;
  riskScore: number;
  riskCategory: RiskCategory;
  topSignal: string;
  interventionStatus: InterventionStatus;
  interventionHistory: InterventionRecord[];
  officerAssigned: string;
  monthlyIncome: number;
  outstandingBalance: number;
  creditUtilization: number;
  savingsBalance: number;
  riskScoreTrend: { date: string; value: number }[];
  savingsBalanceTrend: { date: string; value: number }[];
  salaryDelayTrend: { date: string; value: number }[];
  creditUtilizationTrend: { date: string; value: number }[];
  atmWithdrawalTrend: { date: string; value: number }[];
  shapValues: { feature: string; value: number; direction: "positive" | "negative" }[];
  deviations: { feature: string; current: number; baseline: number; deviation: number; signalStrength: "Strong" | "Moderate" | "Weak" }[];
  paymentHistory: { date: string; amount: number; status: "on-time" | "late" | "missed" }[];
  originationScore: number;
  daysPastDue: number;
  liquidityStressIndex: number;
}

function getRiskCategory(score: number): RiskCategory {
  if (score >= 75) return "High";
  if (score >= 50) return "Moderate";
  if (score >= 30) return "Early Stress";
  return "Low";
}

const officers = ["A. Thompson", "R. Patel", "M. Chen", "S. Williams", "J. Rodriguez", "K. Singh", "L. Brown", "D. Wilson"];

function generateCustomer(index: number): Customer {
  const firstName = pickRandom(firstNames);
  const lastName = pickRandom(lastNames);
  const riskScore = rand(5, 98);
  const riskCategory = getRiskCategory(riskScore);
  const topSignal = pickRandom(signals);
  const statuses: InterventionStatus[] = ["none", "none", "none", "offered", "accepted", "declined"];
  const interventionStatus = riskScore > 50 ? pickRandom(statuses) : "none";
  const monthlyIncome = rand(2000, 12000);
  const creditUtil = randFloat(0.1, 0.95);
  const savBal = rand(500, 50000);

  const history: InterventionRecord[] = [];
  if (interventionStatus !== "none") {
    history.push({
      date: new Date(Date.now() - rand(1, 30) * 86400000).toISOString().split("T")[0],
      type: pickRandom(interventionTypes),
      officerNotes: "Initial review conducted. Customer contacted.",
      status: interventionStatus,
    });
  }

  const shapFeatures = [
    { feature: "Salary Credit Delay", value: randFloat(-0.3, 0.8), direction: riskScore > 50 ? "positive" as const : "negative" as const },
    { feature: "Savings Decline Rate", value: randFloat(-0.2, 0.7), direction: riskScore > 40 ? "positive" as const : "negative" as const },
    { feature: "Credit Utilization", value: randFloat(-0.4, 0.6), direction: creditUtil > 0.6 ? "positive" as const : "negative" as const },
    { feature: "ATM Withdrawal Freq", value: randFloat(-0.3, 0.5), direction: riskScore > 60 ? "positive" as const : "negative" as const },
    { feature: "Payment Regularity", value: randFloat(-0.6, 0.3), direction: riskScore > 50 ? "positive" as const : "negative" as const },
    { feature: "Balance Volatility", value: randFloat(-0.2, 0.4), direction: riskScore > 45 ? "positive" as const : "negative" as const },
    { feature: "Overdraft Usage", value: randFloat(-0.3, 0.5), direction: riskScore > 55 ? "positive" as const : "negative" as const },
    { feature: "Discretionary Spend", value: randFloat(-0.5, 0.2), direction: "negative" as const },
  ];

  const deviations = [
    { feature: "Salary Credit Day", current: rand(1, 15), baseline: rand(1, 5), deviation: randFloat(0, 10), signalStrength: riskScore > 60 ? "Strong" as const : riskScore > 40 ? "Moderate" as const : "Weak" as const },
    { feature: "Savings Balance (£)", current: savBal, baseline: savBal + rand(1000, 5000), deviation: randFloat(-40, -5), signalStrength: riskScore > 50 ? "Strong" as const : "Moderate" as const },
    { feature: "Credit Utilization (%)", current: Math.round(creditUtil * 100), baseline: rand(20, 40), deviation: randFloat(5, 50), signalStrength: creditUtil > 0.7 ? "Strong" as const : "Weak" as const },
    { feature: "ATM Withdrawals/Month", current: rand(5, 25), baseline: rand(3, 8), deviation: randFloat(10, 80), signalStrength: riskScore > 55 ? "Moderate" as const : "Weak" as const },
    { feature: "Missed Payments (90d)", current: rand(0, 4), baseline: 0, deviation: randFloat(0, 100), signalStrength: riskScore > 65 ? "Strong" as const : "Weak" as const },
  ];

  const paymentHistory = Array.from({ length: 12 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - (11 - i));
    const statuses: ("on-time" | "late" | "missed")[] = riskScore > 60
      ? ["on-time", "on-time", "late", "late", "missed"]
      : ["on-time", "on-time", "on-time", "on-time", "late"];
    return {
      date: d.toISOString().split("T")[0],
      amount: rand(200, 1500),
      status: pickRandom(statuses),
    };
  });

  return {
    id: `CUS-${String(index + 1).padStart(5, "0")}`,
    name: `${firstName} ${lastName}`,
    email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@email.com`,
    age: rand(22, 68),
    accountType: pickRandom(["Personal Loan", "Mortgage", "Credit Card", "Auto Loan", "Overdraft"]),
    riskScore,
    riskCategory,
    topSignal,
    interventionStatus,
    interventionHistory: history,
    officerAssigned: pickRandom(officers),
    monthlyIncome,
    outstandingBalance: rand(5000, 200000),
    creditUtilization: creditUtil,
    savingsBalance: savBal,
    riskScoreTrend: generateTimeSeries(60, riskScore - rand(5, 20), 3, riskScore > 50 ? 0.15 : -0.05),
    savingsBalanceTrend: generateTimeSeries(60, savBal + rand(2000, 8000), 500, riskScore > 50 ? -80 : 20),
    salaryDelayTrend: generateTimeSeries(60, rand(0, 3), 1.5, riskScore > 50 ? 0.05 : 0),
    creditUtilizationTrend: generateTimeSeries(60, creditUtil * 100 - rand(5, 15), 3, riskScore > 50 ? 0.2 : -0.05),
    atmWithdrawalTrend: generateTimeSeries(60, rand(5, 10), 2, riskScore > 55 ? 0.1 : 0),
    shapValues: shapFeatures,
    deviations,
    paymentHistory,
    originationScore: rand(300, 850),
    daysPastDue: riskScore > 60 ? rand(0, 30) : 0,
    liquidityStressIndex: randFloat(0, 1),
  };
}

export const customers: Customer[] = Array.from({ length: 120 }, (_, i) => generateCustomer(i));

export const portfolioMetrics = {
  totalCustomers: customers.length,
  highRisk: customers.filter(c => c.riskCategory === "High").length,
  moderateRisk: customers.filter(c => c.riskCategory === "Moderate").length,
  earlyStress: customers.filter(c => c.riskCategory === "Early Stress").length,
  lowRisk: customers.filter(c => c.riskCategory === "Low").length,
};

export const weeklyRiskTrend = Array.from({ length: 12 }, (_, i) => {
  const d = new Date();
  d.setDate(d.getDate() - (11 - i) * 7);
  return {
    week: `W${i + 1}`,
    date: d.toISOString().split("T")[0],
    high: rand(15, 35),
    moderate: rand(20, 40),
    earlyStress: rand(10, 25),
    low: rand(30, 50),
  };
});

export const riskDistribution = [
  { name: "High", value: portfolioMetrics.highRisk, fill: "hsl(0, 72%, 51%)" },
  { name: "Moderate", value: portfolioMetrics.moderateRisk, fill: "hsl(38, 92%, 50%)" },
  { name: "Early Stress", value: portfolioMetrics.earlyStress, fill: "hsl(224, 76%, 48%)" },
  { name: "Low", value: portfolioMetrics.lowRisk, fill: "hsl(142, 72%, 37%)" },
];

export const cohortHeatmapData = [
  { cohort: "Q1 2024", bucket0_30: rand(60, 90), bucket30_50: rand(15, 30), bucket50_75: rand(5, 15), bucket75_100: rand(2, 8) },
  { cohort: "Q2 2024", bucket0_30: rand(55, 85), bucket30_50: rand(18, 35), bucket50_75: rand(8, 18), bucket75_100: rand(3, 10) },
  { cohort: "Q3 2024", bucket0_30: rand(50, 80), bucket30_50: rand(20, 38), bucket50_75: rand(10, 20), bucket75_100: rand(4, 12) },
  { cohort: "Q4 2024", bucket0_30: rand(45, 78), bucket30_50: rand(22, 40), bucket50_75: rand(12, 22), bucket75_100: rand(5, 14) },
  { cohort: "Q1 2025", bucket0_30: rand(48, 82), bucket30_50: rand(20, 35), bucket50_75: rand(8, 18), bucket75_100: rand(3, 10) },
];

export const featureImportance = [
  { feature: "Salary Credit Delay", importance: 0.28 },
  { feature: "Savings Decline Rate", importance: 0.22 },
  { feature: "Credit Utilization", importance: 0.18 },
  { feature: "Payment Regularity", importance: 0.12 },
  { feature: "ATM Withdrawal Freq", importance: 0.08 },
  { feature: "Balance Volatility", importance: 0.06 },
  { feature: "Overdraft Usage", importance: 0.04 },
  { feature: "Discretionary Spend", importance: 0.02 },
];

// Mock risk trend data with delinquency probability in 20-30% range
export const mockRiskTrend = Array.from({ length: 12 }, (_, i) => {
  // Generate values in 20-30% range with slight variations
  const baseValue = 25;
  const variation = (Math.random() - 0.5) * 8; // ±4% variation
  const delinquencyProb = Math.max(20, Math.min(30, baseValue + variation)) / 100;
  
  return {
    week: `W${i + 1}`,
    avg_risk_score: randFloat(48, 52, 1),
    delinquency_probability: parseFloat(delinquencyProb.toFixed(3)),
  };
});
