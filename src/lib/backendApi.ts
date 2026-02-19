/**
 * Backend API Integration
 * Communicates with Pre-Delinquency Early Warning Engine FastAPI backend
 * 
 * Automatic customer data retrieval from banking records.
 * NO manual feature input required.
 */

const API_BASE_URL = "http://localhost:8000";
const REQUEST_TIMEOUT_MS = 8000;
export const CUSTOMER_SAMPLE_LIMIT = 200;

async function fetchWithTimeout(input: RequestInfo, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  let timeoutId: number | undefined;

  const timeoutPromise = new Promise<Response>((_, reject) => {
    timeoutId = window.setTimeout(() => {
      controller.abort();
      reject(new Error("REQUEST_TIMEOUT"));
    }, REQUEST_TIMEOUT_MS);
  });

  try {
    return await Promise.race([
      fetch(input, {
        ...init,
        signal: controller.signal,
      }),
      timeoutPromise,
    ]);
  } finally {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
  }
}

export interface PredictionRequest {
  customer_id: string;
}

export interface PredictionResponse {
  customer_id: string;
  risk_probability: number;
  risk_category: "LOW" | "MEDIUM" | "HIGH";
  top_risk_drivers: Record<string, number>;
  model_version: string;
  prediction_timestamp: string;
}

export interface HealthResponse {
  status: string;
  model_loaded: boolean;
  customer_data_loaded: boolean;
  model_version: string;
  total_customers: number;
}

export interface CustomerData {
  customer_id: string;
  avg_salary_day_6m: number;
  current_salary_day: number;
  salary_delay_days: number;
  savings_6m_avg: number;
  current_savings: number;
  savings_drop_pct: number;
  discretionary_spend_6m_avg: number;
  current_discretionary_spend: number;
  discretionary_drop_pct: number;
  utility_payment_shift_days: number;
  atm_withdrawal_increase_pct: number;
  credit_utilization_pct: number;
  past_emi_delays_6m: number;
  historical_stability_index: number;
  historical_category: number;
}

export interface PortfolioSummary {
  low_risk_count: number;
  medium_risk_count: number;
  high_risk_count: number;
  total_customers: number;
  generated_at: string;
}

export interface RiskTrendPoint {
  week: string;
  avg_risk_score: number;
  delinquency_probability: number;
}

export interface FeatureImportancePoint {
  feature_name: string;
  importance_score: number;
}

export interface HeatmapRow {
  cohort: string;
  bucket0_20: number;
  bucket20_40: number;
  bucket40_60: number;
  bucket60_80: number;
  bucket80_100: number;
}

export interface CustomerRiskItem {
  customer_id: string;
  risk_probability: number;
  risk_category: "LOW" | "MEDIUM" | "HIGH";
}

export interface CustomerDrilldown {
  customer_id: string;
  behavioural_score: number;
  liquidity_score: number;
  delinquency_probability: number;
  contributing_features: Record<string, number>;
}

/**
 * Check backend health status
 */
function normalizeFetchError(error: unknown, fallback: string): Error {
  if (error instanceof DOMException && error.name === "AbortError") {
    return new Error("Backend request timed out. Ensure FastAPI is running on http://localhost:8000");
  }
  if (error instanceof Error && error.message === "REQUEST_TIMEOUT") {
    return new Error("Backend request timed out. Ensure FastAPI is running on http://localhost:8000");
  }
  return new Error(fallback);
}

export async function checkBackendHealth(): Promise<HealthResponse> {
  try {
    const response = await fetchWithTimeout(`${API_BASE_URL}/`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error("Backend health check failed:", error);
    throw normalizeFetchError(
      error,
      "Unable to connect to backend. Ensure FastAPI server is running on http://localhost:8000"
    );
  }
}

/**
 * Get list of all customers from banking records
 */
export async function getCustomerList(limit?: number): Promise<string[]> {
  try {
    const query = typeof limit === "number" ? `?limit=${encodeURIComponent(limit)}` : "";
    const response = await fetchWithTimeout(`${API_BASE_URL}/customers${query}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error("Failed to get customer list:", error);
    throw normalizeFetchError(error, "Unable to retrieve customer list from backend");
  }
}

/**
 * Get specific customer behavioral data from banking records
 */
export async function getCustomerData(customerId: string): Promise<CustomerData> {
  try {
    const response = await fetchWithTimeout(`${API_BASE_URL}/customer/${customerId}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || `HTTP ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error("Failed to get customer data:", error);
    if (error instanceof Error) {
      throw error;
    }
    throw normalizeFetchError(error, "Failed to retrieve customer data");
  }
}

/**
 * Send prediction request to backend
 * Backend automatically retrieves customer features from banking records
 */
export async function predictRisk(customerId: string): Promise<PredictionResponse> {
  try {
    const response = await fetchWithTimeout(`${API_BASE_URL}/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customer_id: customerId }),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || `HTTP ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error("Prediction request failed:", error);
    if (error instanceof Error) {
      throw error;
    }
    throw normalizeFetchError(error, "Prediction failed");
  }
}

export async function getPortfolioSummary(): Promise<PortfolioSummary> {
  try {
    const response = await fetchWithTimeout(`${API_BASE_URL}/portfolio/summary`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error("Portfolio summary request failed:", error);
    throw normalizeFetchError(error, "Failed to load portfolio summary");
  }
}

export async function getRiskTrend(): Promise<RiskTrendPoint[]> {
  try {
    const response = await fetchWithTimeout(`${API_BASE_URL}/portfolio/trend`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error("Risk trend request failed:", error);
    throw normalizeFetchError(error, "Failed to load risk trend data");
  }
}

export async function getFeatureImportance(): Promise<FeatureImportancePoint[]> {
  try {
    const response = await fetchWithTimeout(`${API_BASE_URL}/portfolio/feature-importance`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error("Feature importance request failed:", error);
    throw normalizeFetchError(error, "Failed to load feature importance");
  }
}

export async function getPortfolioHeatmap(): Promise<HeatmapRow[]> {
  try {
    const response = await fetchWithTimeout(`${API_BASE_URL}/portfolio/heatmap`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error("Portfolio heatmap request failed:", error);
    throw normalizeFetchError(error, "Failed to load heatmap data");
  }
}

export async function getCustomerRiskList(limit?: number): Promise<CustomerRiskItem[]> {
  try {
    const query = typeof limit === "number" ? `?limit=${encodeURIComponent(limit)}` : "";
    const response = await fetchWithTimeout(`${API_BASE_URL}/customers/risk-list${query}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error("Customer risk list request failed:", error);
    throw normalizeFetchError(error, "Failed to load customer risk list");
  }
}

export async function getCustomerDrilldown(customerId: string): Promise<CustomerDrilldown> {
  try {
    const response = await fetchWithTimeout(`${API_BASE_URL}/customer/${customerId}/drilldown`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || `HTTP ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error("Customer drilldown request failed:", error);
    if (error instanceof Error) {
      throw error;
    }
    throw normalizeFetchError(error, "Failed to load customer drilldown");
  }
}
/**
 * Predict risk and automatically send intervention email if risk exceeds threshold
 * Backend handles customer data retrieval, prediction, email generation, and sending
 */
export async function predictAndSendIntervention(customerId: string): Promise<{
  prediction: PredictionResponse;
  intervention: {
    threshold_exceeded: boolean;
    email_sent: boolean;
    email_subject: string | null;
    email_error: string | null;
  };
}> {
  try {
    const response = await fetchWithTimeout(`${API_BASE_URL}/predict-and-send-intervention`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customer_id: customerId }),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || `HTTP ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error("Prediction and intervention request failed:", error);
    if (error instanceof Error) {
      throw error;
    }
    throw normalizeFetchError(error, "Prediction and intervention failed");
  }
}