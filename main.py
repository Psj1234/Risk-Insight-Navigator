"""
Pre-Delinquency Early Warning Engine
Behavioural Drift-Based Financial Stress Detection System

Production-grade FastAPI backend for predicting probability of delinquency 2-4 weeks in advance.
Automatically retrieves customer behavioral data from banking records and generates risk insights.

Model provides risk decision support. Final intervention decisions remain human-controlled.

Technology Stack: FastAPI, scikit-learn/XGBoost, SHAP, pandas, numpy
"""

import joblib
import pandas as pd
import numpy as np
from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, ConfigDict
from typing import Dict, Optional, List
from datetime import datetime
import shap
import logging
import os
import time

# Configure logging for production monitoring
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ============================================================================
# MODEL CONFIGURATION
# ============================================================================
MODEL_VERSION = "1.0"
MODEL_PATH = "./delinquency_model.pkl"
CUSTOMER_DATA_PATH = "./customer_data.csv"

# Feature list must match training dataset feature order
REQUIRED_FEATURES = [
    "Avg_Salary_Day_6M",
    "Current_Salary_Day",
    "Salary_Delay_Days",
    "Savings_6M_Avg",
    "Current_Savings",
    "Savings_Drop_%",
    "Discretionary_Spend_6M_Avg",
    "Current_Discretionary_Spend",
    "Discretionary_Drop_%",
    "Utility_Payment_Shift_Days",
    "ATM_Withdrawal_Increase_%",
    "Credit_Utilization_%",
    "Past_EMI_Delays_6M",
    "Historical_Stability_Index",
    "Historical_Category"
]

# Risk classification thresholds based on delinquency probability
RISK_THRESHOLDS = {
    "LOW": (0.00, 0.40),
    "MEDIUM": (0.40, 0.70),
    "HIGH": (0.70, 1.01)
}

# ============================================================================
# PYDANTIC SCHEMAS
# ============================================================================

class PredictionRequest(BaseModel):
    """Input schema for automatic delinquency risk prediction endpoint."""
    customer_id: str = Field(..., description="Unique customer identifier from banking records")

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "customer_id": "CUST_00001"
            }
        }
    )


class CustomerDataResponse(BaseModel):
    """Output schema for customer behavioral data."""
    customer_id: str
    avg_salary_day_6m: float
    current_salary_day: float
    salary_delay_days: float
    savings_6m_avg: float
    current_savings: float
    savings_drop_pct: float
    discretionary_spend_6m_avg: float
    current_discretionary_spend: float
    discretionary_drop_pct: float
    utility_payment_shift_days: float
    atm_withdrawal_increase_pct: float
    credit_utilization_pct: float
    past_emi_delays_6m: float
    historical_stability_index: float
    historical_category: int


class PredictionResponse(BaseModel):
    """Output schema for delinquency risk prediction endpoint."""
    customer_id: str = Field(..., description="Customer identifier")
    risk_probability: float = Field(..., description="Predicted probability of delinquency (0-1)")
    risk_category: str = Field(..., description="Risk classification: LOW, MEDIUM, or HIGH")
    top_risk_drivers: Dict[str, float] = Field(..., description="Top 5 contributing features with impact scores")
    model_version: str = Field(..., description="Version of the prediction model")
    prediction_timestamp: str = Field(..., description="ISO 8601 timestamp of prediction")


class HealthResponse(BaseModel):
    """Output schema for health check endpoint."""
    status: str = Field(..., description="System operational status")
    model_loaded: bool = Field(..., description="Model initialization status")
    customer_data_loaded: bool = Field(..., description="Customer data loading status")
    model_version: str = Field(..., description="Version of loaded model")
    total_customers: int = Field(..., description="Total customers in banking records")


# ============================================================================
# APPLICATION INITIALIZATION
# ============================================================================

app = FastAPI(
    title="Pre-Delinquency Early Warning Engine",
    description="Behavioural Drift-Based Financial Stress Detection System",
    version=MODEL_VERSION
)

# Add CORS middleware for banking dashboard integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global instances (loaded once at startup)
model = None
explainer = None
customer_data_df = None
model_loaded_status = False
customer_data_loaded_status = False
prediction_cache = None
prediction_cache_timestamp = 0.0
feature_minmax = {}

PREDICTION_CACHE_TTL_SECONDS = 300


class PortfolioSummaryResponse(BaseModel):
    low_risk_count: int
    medium_risk_count: int
    high_risk_count: int
    total_customers: int
    generated_at: str


class RiskTrendPoint(BaseModel):
    week: str
    avg_risk_score: float
    delinquency_probability: float


class FeatureImportancePoint(BaseModel):
    feature_name: str
    importance_score: float


class HeatmapRow(BaseModel):
    cohort: str
    bucket0_20: int
    bucket20_40: int
    bucket40_60: int
    bucket60_80: int
    bucket80_100: int


class CustomerRiskItem(BaseModel):
    customer_id: str
    risk_probability: float
    risk_category: str


class CustomerDrilldownResponse(BaseModel):
    customer_id: str
    behavioural_score: float
    liquidity_score: float
    delinquency_probability: float
    contributing_features: Dict[str, float]


def load_model():
    """
    Load pre-trained model and initialize SHAP explainer.
    This function runs once at application startup to avoid repeated disk I/O.
    """
    global model, explainer, model_loaded_status
    try:
        if not os.path.exists(MODEL_PATH):
            logger.warning(f"Model file not found at {MODEL_PATH}")
            model_loaded_status = False
            return
        
        logger.info(f"Loading model from {MODEL_PATH}")
        model = joblib.load(MODEL_PATH)
        
        # Initialize SHAP TreeExplainer for model interpretability
        explainer = shap.TreeExplainer(model)
        model_loaded_status = True
        logger.info("Model and SHAP explainer successfully loaded")
    except Exception as e:
        logger.error(f"Error loading model: {str(e)}")
        model_loaded_status = False


def load_customer_data():
    """
    Load customer behavioral data from CSV at startup.
    Data represents financial behavior automatically collected from banking systems.
    This avoids repeated file I/O and ensures data consistency.
    """
    global customer_data_df, customer_data_loaded_status
    try:
        if not os.path.exists(CUSTOMER_DATA_PATH):
            logger.warning(f"Customer data file not found at {CUSTOMER_DATA_PATH}")
            customer_data_loaded_status = False
            customer_data_df = pd.DataFrame()
            return
        
        logger.info(f"Loading customer behavioral data from {CUSTOMER_DATA_PATH}")
        customer_data_df = pd.read_csv(CUSTOMER_DATA_PATH)
        
        # Validate that all required features are present
        missing_features = set(REQUIRED_FEATURES) - set(customer_data_df.columns)
        if missing_features:
            logger.error(f"Missing required features in customer data: {missing_features}")
            customer_data_loaded_status = False
            return
        
        # Normalize Historical_Category to numeric if provided as labels
        if "Historical_Category" in customer_data_df.columns:
            category_map = {
                "low": 0,
                "medium": 1,
                "high": 2
            }
            if customer_data_df["Historical_Category"].dtype == object:
                normalized = (
                    customer_data_df["Historical_Category"]
                    .astype(str)
                    .str.strip()
                    .str.lower()
                    .map(category_map)
                )
                numeric_categories = pd.to_numeric(normalized, errors="coerce")
                if numeric_categories.isna().any():
                    logger.warning("Unknown Historical_Category values found; defaulting to 0")
                customer_data_df["Historical_Category"] = numeric_categories.fillna(0)

        # Set Customer_ID (or similar column) as index for fast lookup
        if "Cust_ID" in customer_data_df.columns:
            customer_data_df.set_index("Cust_ID", inplace=True)
        elif "Customer_ID" in customer_data_df.columns:
            customer_data_df.set_index("Customer_ID", inplace=True)

        # Store min/max for feature normalization
        feature_minmax.clear()
        for feature in REQUIRED_FEATURES:
            if feature in customer_data_df.columns:
                feature_minmax[feature] = (
                    float(customer_data_df[feature].min()),
                    float(customer_data_df[feature].max())
                )
        
        customer_data_loaded_status = True
        logger.info(f"Successfully loaded {len(customer_data_df)} customer records")
    except Exception as e:
        logger.error(f"Error loading customer data: {str(e)}")
        customer_data_loaded_status = False


def classify_risk(probability: float) -> str:
    """
    Convert predicted delinquency probability into risk category.
    
    Args:
        probability: Delinquency probability from model (0-1)
    
    Returns:
        Risk category: "LOW", "MEDIUM", or "HIGH"
    """
    for category, (lower, upper) in RISK_THRESHOLDS.items():
        if lower <= probability < upper:
            return category
    return "HIGH"  # Default to HIGH if probability >= 0.70


def get_shap_explanations(features_df: pd.DataFrame) -> Dict[str, float]:
    """
    Generate SHAP-based feature importance for model prediction explainability.
    
    Args:
        features_df: Input features as pandas DataFrame
    
    Returns:
        Dictionary of top 5 contributing features with normalized impact scores
    """
    try:
        # Calculate SHAP values for input sample
        shap_values = explainer.shap_values(features_df)
        
        # For binary classification, extract contribution for positive class (delinquency)
        # shap_values is typically [values_class_0, values_class_1] for binary
        if isinstance(shap_values, list):
            shap_values = shap_values[1]  # Use high-risk class explanations
        
        # Calculate absolute mean contribution per feature
        feature_importance = np.abs(shap_values[0]).flatten()
        
        # Create feature-importance mapping
        importance_dict = dict(zip(REQUIRED_FEATURES, feature_importance))
        
        # Sort by importance and return top 5 features with normalized scores
        sorted_features = sorted(importance_dict.items(), key=lambda x: x[1], reverse=True)[:5]
        
        # Normalize to probability scale for business interpretability
        total_importance = sum([score for _, score in sorted_features])
        normalized_features = {
            name: round(score / total_importance, 3) if total_importance > 0 else 0.0
            for name, score in sorted_features
        }
        
        return normalized_features
    except Exception as e:
        logger.error(f"Error generating SHAP explanations: {str(e)}")
        return {}


def normalize_feature(feature: str, value: float) -> float:
    min_val, max_val = feature_minmax.get(feature, (0.0, 0.0))
    if max_val <= min_val:
        return 0.0
    return (value - min_val) / (max_val - min_val)


def get_prediction_cache() -> pd.DataFrame:
    global prediction_cache, prediction_cache_timestamp

    now = time.time()
    if prediction_cache is not None and (now - prediction_cache_timestamp) < PREDICTION_CACHE_TTL_SECONDS:
        return prediction_cache

    if not model_loaded_status or not customer_data_loaded_status or customer_data_df is None or customer_data_df.empty:
        raise HTTPException(
            status_code=503,
            detail="Model or customer data not available. Service initialization in progress."
        )

    features_df = customer_data_df[REQUIRED_FEATURES].copy()
    probabilities = model.predict_proba(features_df)[:, 1]
    risk_categories = [classify_risk(float(prob)) for prob in probabilities]

    prediction_cache = pd.DataFrame({
        "risk_probability": probabilities,
        "risk_category": risk_categories,
    }, index=customer_data_df.index)

    prediction_cache_timestamp = now
    return prediction_cache


def get_customer_ids(limit: Optional[int]) -> List[str]:
    if customer_data_df is None or customer_data_df.empty:
        return []
    customer_ids = customer_data_df.index.tolist()
    if limit is not None:
        return customer_ids[:limit]
    return customer_ids


# ============================================================================
# API ENDPOINTS
# ============================================================================

@app.on_event("startup")
async def startup_event():
    """Load model and customer data at application startup (runs once, not per request)."""
    load_model()
    load_customer_data()


@app.get("/", response_model=HealthResponse)
async def health_check() -> HealthResponse:
    """
    Health check endpoint for system monitoring and deployment verification.
    
    Returns:
        System status, model initialization, and data loading confirmation
    """
    return HealthResponse(
        status="operational" if (model_loaded_status and customer_data_loaded_status) else "degraded",
        model_loaded=model_loaded_status,
        customer_data_loaded=customer_data_loaded_status,
        model_version=MODEL_VERSION,
        total_customers=len(customer_data_df) if customer_data_df is not None else 0
    )


@app.get("/customers", response_model=List[str])
async def list_customers(limit: Optional[int] = Query(default=None, ge=1, le=500)) -> List[str]:
    """
    List all customer IDs available in the banking system.
    Enables dashboard to query risk for specific customers.
    
    Returns:
        List of all customer identifiers
    """
    if not customer_data_loaded_status or customer_data_df is None or customer_data_df.empty:
        logger.error("Customer data not available")
        raise HTTPException(
            status_code=503,
            detail="Customer data not available. Service initialization in progress."
        )
    
    return get_customer_ids(limit)


@app.get("/customers/risk-list", response_model=List[CustomerRiskItem])
async def list_customers_with_risk(
    limit: Optional[int] = Query(default=None, ge=1, le=500)
) -> List[CustomerRiskItem]:
    """Return customer IDs with current risk probability and category."""
    cache = get_prediction_cache()
    results = []
    customer_ids = get_customer_ids(limit) if limit is not None else cache.index.tolist()
    for customer_id in customer_ids:
        row = cache.loc[customer_id]
        results.append(CustomerRiskItem(
            customer_id=str(customer_id),
            risk_probability=round(float(row["risk_probability"]), 3),
            risk_category=row["risk_category"]
        ))
    return results


@app.get("/customer/{customer_id}", response_model=CustomerDataResponse)
async def get_customer_data(customer_id: str) -> CustomerDataResponse:
    """
    Retrieve customer behavioral banking data.
    This data is automatically collected from banking systems, not manually entered.
    
    Args:
        customer_id: Unique customer identifier
    
    Returns:
        Customer's behavioral financial data
    
    Raises:
        HTTPException: If customer not found
    """
    if not customer_data_loaded_status or customer_data_df is None or customer_data_df.empty:
        raise HTTPException(
            status_code=503,
            detail="Customer data not available."
        )
    
    try:
        customer_row = customer_data_df.loc[customer_id]
    except KeyError:
        logger.error(f"Customer {customer_id} not found in banking records")
        raise HTTPException(
            status_code=404,
            detail=f"Customer {customer_id} not found in banking records."
        )
    
    return CustomerDataResponse(
        customer_id=customer_id,
        avg_salary_day_6m=float(customer_row["Avg_Salary_Day_6M"]),
        current_salary_day=float(customer_row["Current_Salary_Day"]),
        salary_delay_days=float(customer_row["Salary_Delay_Days"]),
        savings_6m_avg=float(customer_row["Savings_6M_Avg"]),
        current_savings=float(customer_row["Current_Savings"]),
        savings_drop_pct=float(customer_row["Savings_Drop_%"]),
        discretionary_spend_6m_avg=float(customer_row["Discretionary_Spend_6M_Avg"]),
        current_discretionary_spend=float(customer_row["Current_Discretionary_Spend"]),
        discretionary_drop_pct=float(customer_row["Discretionary_Drop_%"]),
        utility_payment_shift_days=float(customer_row["Utility_Payment_Shift_Days"]),
        atm_withdrawal_increase_pct=float(customer_row["ATM_Withdrawal_Increase_%"]),
        credit_utilization_pct=float(customer_row["Credit_Utilization_%"]),
        past_emi_delays_6m=float(customer_row["Past_EMI_Delays_6M"]),
        historical_stability_index=float(customer_row["Historical_Stability_Index"]),
        historical_category=int(customer_row["Historical_Category"])
    )


@app.get("/customer/{customer_id}/drilldown", response_model=CustomerDrilldownResponse)
async def get_customer_drilldown(customer_id: str) -> CustomerDrilldownResponse:
    """Return customer-level drilldown metrics for charts."""
    if not customer_data_loaded_status or customer_data_df is None or customer_data_df.empty:
        raise HTTPException(
            status_code=503,
            detail="Customer data not available."
        )

    try:
        customer_row = customer_data_df.loc[customer_id]
    except KeyError:
        raise HTTPException(
            status_code=404,
            detail=f"Customer {customer_id} not found in banking records."
        )

    cache = get_prediction_cache()
    probability = float(cache.loc[customer_id]["risk_probability"])

    behavioural_features = [
        "Salary_Delay_Days",
        "Savings_Drop_%",
        "Discretionary_Drop_%",
        "ATM_Withdrawal_Increase_%",
        "Credit_Utilization_%",
        "Past_EMI_Delays_6M",
        "Utility_Payment_Shift_Days",
    ]

    behavioural_scores = []
    for feature in behavioural_features:
        raw = float(customer_row[feature])
        adjusted = raw if raw > 0 else 0.0
        behavioural_scores.append(normalize_feature(feature, adjusted))

    behavioural_score = float(np.mean(behavioural_scores)) if behavioural_scores else 0.0

    liquidity_components = [
        1 - normalize_feature("Current_Savings", float(customer_row["Current_Savings"])),
        normalize_feature("Credit_Utilization_%", float(customer_row["Credit_Utilization_%"])),
        normalize_feature("Savings_Drop_%", max(0.0, float(customer_row["Savings_Drop_%"]))),
    ]
    liquidity_score = float(np.mean(liquidity_components)) if liquidity_components else 0.0

    features_df = pd.DataFrame([{feature: customer_row[feature] for feature in REQUIRED_FEATURES}])
    contributing_features = get_shap_explanations(features_df)

    return CustomerDrilldownResponse(
        customer_id=customer_id,
        behavioural_score=round(behavioural_score, 3),
        liquidity_score=round(liquidity_score, 3),
        delinquency_probability=round(probability, 3),
        contributing_features=contributing_features
    )


@app.get("/portfolio/summary", response_model=PortfolioSummaryResponse)
async def portfolio_summary() -> PortfolioSummaryResponse:
    """Return portfolio risk counts for charts."""
    cache = get_prediction_cache()
    counts = cache["risk_category"].value_counts()

    low_count = int(counts.get("LOW", 0))
    medium_count = int(counts.get("MEDIUM", 0))
    high_count = int(counts.get("HIGH", 0))

    return PortfolioSummaryResponse(
        low_risk_count=low_count,
        medium_risk_count=medium_count,
        high_risk_count=high_count,
        total_customers=int(len(cache)),
        generated_at=datetime.utcnow().isoformat() + "Z"
    )


@app.get("/portfolio/trend", response_model=List[RiskTrendPoint])
async def portfolio_trend() -> List[RiskTrendPoint]:
    """Return aggregated risk trend points based on current predictions."""
    cache = get_prediction_cache()
    probabilities = cache["risk_probability"].to_numpy()
    if len(probabilities) == 0:
        return []

    buckets = np.array_split(probabilities, 12)
    trend = []
    for index, bucket in enumerate(buckets, start=1):
        if bucket.size == 0:
            continue
        avg_prob = float(np.mean(bucket))
        trend.append(RiskTrendPoint(
            week=f"W{index}",
            avg_risk_score=round(avg_prob * 100, 2),
            delinquency_probability=round(avg_prob, 3)
        ))

    return trend


@app.get("/portfolio/feature-importance", response_model=List[FeatureImportancePoint])
async def portfolio_feature_importance() -> List[FeatureImportancePoint]:
    """Return global feature importance from the trained model."""
    if not model_loaded_status:
        raise HTTPException(
            status_code=503,
            detail="Model not available. Service initialization in progress."
        )

    importances = getattr(model, "feature_importances_", None)
    if importances is None:
        raise HTTPException(
            status_code=503,
            detail="Model does not expose feature importance."
        )

    total = float(np.sum(importances)) if float(np.sum(importances)) > 0 else 1.0
    results = []
    for name, value in zip(REQUIRED_FEATURES, importances):
        results.append(FeatureImportancePoint(
            feature_name=name,
            importance_score=round(float(value) / total, 4)
        ))

    return results


@app.get("/portfolio/heatmap", response_model=List[HeatmapRow])
async def portfolio_heatmap() -> List[HeatmapRow]:
    """Return portfolio heatmap buckets based on risk scores."""
    cache = get_prediction_cache()
    if cache.empty:
        return []

    risk_scores = (cache["risk_probability"] * 100).to_numpy()
    cohorts = np.array_split(risk_scores, 5)
    rows = []

    for index, cohort_scores in enumerate(cohorts, start=1):
        bucket0_20 = int(np.sum((cohort_scores >= 0) & (cohort_scores < 20)))
        bucket20_40 = int(np.sum((cohort_scores >= 20) & (cohort_scores < 40)))
        bucket40_60 = int(np.sum((cohort_scores >= 40) & (cohort_scores < 60)))
        bucket60_80 = int(np.sum((cohort_scores >= 60) & (cohort_scores < 80)))
        bucket80_100 = int(np.sum((cohort_scores >= 80) & (cohort_scores <= 100)))

        rows.append(HeatmapRow(
            cohort=f"Cohort {index}",
            bucket0_20=bucket0_20,
            bucket20_40=bucket20_40,
            bucket40_60=bucket40_60,
            bucket60_80=bucket60_80,
            bucket80_100=bucket80_100,
        ))

    return rows


@app.post("/predict", response_model=PredictionResponse)
async def predict_delinquency_risk(request: PredictionRequest) -> PredictionResponse:
    """
    Main prediction endpoint for automatic delinquency risk assessment.
    
    Backend automatically retrieves customer behavioral data from banking records.
    Frontend sends only customer_id - NO manual feature input required.
    
    This endpoint:
    1. Retrieves customer's behavioral data from internal banking records
    2. Performs delinquency probability prediction
    3. Classifies risk into LOW/MEDIUM/HIGH categories
    4. Generates SHAP explanations for top contributing factors
    5. Returns structured decision-support output for banking admin
    
    Model provides risk decision support. Final intervention decisions remain human-controlled.
    
    Args:
        request: PredictionRequest with customer_id only
    
    Returns:
        PredictionResponse with probability, category, and explainability data
    
    Raises:
        HTTPException: If model/data not loaded or customer not found
    """
    # Validate model availability
    if not model_loaded_status:
        logger.error("Prediction requested but model not loaded")
        raise HTTPException(
            status_code=503,
            detail="Model not available. Service initialization in progress."
        )
    
    # Validate customer data availability
    if not customer_data_loaded_status or customer_data_df is None or customer_data_df.empty:
        logger.error("Prediction requested but customer data not loaded")
        raise HTTPException(
            status_code=503,
            detail="Customer data not available. Service initialization in progress."
        )
    
    try:
        # Automatically retrieve customer's behavioral data from banking records
        # This is NOT manual input - data comes from internal banking systems
        customer_row = customer_data_df.loc[request.customer_id]
        
        # Create DataFrame with only required features in correct order
        features_dict = {feature: customer_row[feature] for feature in REQUIRED_FEATURES}
        features_df = pd.DataFrame([features_dict])
        
        # Generate prediction using pre-trained model
        # predict_proba returns probabilities for both classes [prob_no_delinquency, prob_delinquency]
        prediction_probability = model.predict_proba(features_df)[0][1]
        
        # Classify probability into risk category
        risk_category = classify_risk(prediction_probability)
        
        # Generate SHAP-based explanations for model interpretability
        top_risk_drivers = get_shap_explanations(features_df)
        
        # Generate ISO 8601 timestamp for audit trail
        prediction_timestamp = datetime.utcnow().isoformat() + "Z"
        
        logger.info(f"Prediction completed for {request.customer_id}: {risk_category} risk (probability: {prediction_probability:.3f})")
        
        return PredictionResponse(
            customer_id=request.customer_id,
            risk_probability=round(prediction_probability, 3),
            risk_category=risk_category,
            top_risk_drivers=top_risk_drivers,
            model_version=MODEL_VERSION,
            prediction_timestamp=prediction_timestamp
        )
    
    except KeyError:
        logger.error(f"Customer not found in database: {request.customer_id}")
        raise HTTPException(
            status_code=404,
            detail=f"Customer {request.customer_id} not found in banking records"
        )
    except Exception as e:
        logger.error(f"Prediction error for {request.customer_id}: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Prediction failed: {str(e)}"
        )


@app.post("/predict-and-send-intervention")
async def predict_and_send_intervention(request: PredictionRequest) -> dict:
    """
    Automated prediction and intervention endpoint for admin-initiated actions.
    
    This endpoint combines prediction with automatic email generation and sending:
    1. Predicts customer risk using behavioral data
    2. Generates personalized intervention email based on risk level
    3. Automatically sends email if risk exceeds threshold (MEDIUM/HIGH)
    4. Returns prediction result and sending status
    
    Args:
        request: PredictionRequest with customer_id only
    
    Returns:
        dict with prediction data, email content, and sending status
    """
    # Step 1: Perform risk prediction
    prediction_response = await predict_delinquency_risk(request)
    
    # Step 2: Check if risk exceeds intervention threshold
    intervention_threshold = 0.4  # 40% probability = MEDIUM risk
    should_send_email = prediction_response.risk_probability >= intervention_threshold
    
    # Step 3: Generate intervention email content
    email_content = _generate_intervention_email(
        customer_id=prediction_response.customer_id,
        risk_probability=prediction_response.risk_probability,
        risk_category=prediction_response.risk_category,
        top_risk_drivers=prediction_response.top_risk_drivers
    )
    
    # Step 4: Send email if threshold exceeded
    email_sent = False
    email_error = None
    if should_send_email:
        try:
            email_sent = _send_intervention_email(
                customer_id=prediction_response.customer_id,
                email_subject=email_content["subject"],
                email_body=email_content["body"],
                email_html=email_content["html"]
            )
            if email_sent:
                logger.info(f"Intervention email sent for customer {prediction_response.customer_id}")
            else:
                email_error = "Email service unavailable"
                logger.warning(f"Failed to send intervention email for {prediction_response.customer_id}")
        except Exception as e:
            email_error = str(e)
            logger.error(f"Email sending error for {prediction_response.customer_id}: {str(e)}")
    
    return {
        "prediction": prediction_response.model_dump(),
        "intervention": {
            "threshold_exceeded": should_send_email,
            "email_sent": email_sent,
            "email_subject": email_content["subject"] if should_send_email else None,
            "email_error": email_error
        }
    }


def _generate_intervention_email(
    customer_id: str,
    risk_probability: float,
    risk_category: str,
    top_risk_drivers: Dict[str, float]
) -> Dict[str, str]:
    """
    Dynamically generate personalized intervention email based on risk prediction.
    
    Args:
        customer_id: Customer identifier
        risk_probability: Predicted delinquency probability (0-1)
        risk_category: Risk classification (LOW/MEDIUM/HIGH)
        top_risk_drivers: Top contributing features
    
    Returns:
        Dictionary with email subject, plain text body, and HTML body
    """
    risk_pct = risk_probability * 100
    
    # Risk-based salutation and tone
    if risk_category == "HIGH":
        greeting = "URGENT: Immediate Action Required"
        tone = "priority"
        action_word = "immediately"
    elif risk_category == "MEDIUM":
        greeting = "Important: Proactive Assistance Available"
        tone = "professional"
        action_word = "promptly"
    else:
        greeting = "Account Review Available"
        tone = "informational"
        action_word = "soon"
    
    # Map top features to business-friendly language
    risk_drivers_text = "\n".join([
        f"• {_format_feature_name(feature)}: {abs(value):.1%} impact"
        for feature, value in list(top_risk_drivers.items())[:3]
    ])
    
    subject = f"[{risk_category}] Delinquency Risk Assessment - Customer {customer_id}"
    
    plain_text = f"""
{greeting}

Dear Relationship Manager,

A behavioral analysis indicates a {risk_pct:.1f}% probability of delinquency for customer {customer_id} within the next 2-4 weeks.

Risk Level: {risk_category}

Top Risk Indicators:
{risk_drivers_text}

Recommended Actions:
1. Contact customer {action_word} to discuss account status
2. Offer restructuring options or assistance programs
3. Schedule a financial review session
4. Monitor account closely for further deterioration

This assessment is generated automatically by our Pre-Delinquency Early Warning System.
Final intervention decisions remain your responsibility as the assigned risk officer.

For questions or interventions, please log in to the dashboard.

Regards,
Risk Intelligence Team
    """
    
    html = f"""
    <html>
        <body style="font-family: Arial, sans-serif; color: #333;">
            <h2 style="color: {'#dc2626' if risk_category == 'HIGH' else '#ea580c' if risk_category == 'MEDIUM' else '#16a34a'};">
                [{risk_category}] Delinquency Risk Assessment
            </h2>
            
            <p><strong>Customer ID:</strong> {customer_id}</p>
            <p><strong>Risk Probability:</strong> <span style="font-size: 1.2em; font-weight: bold;">{risk_pct:.1f}%</span></p>
            <p><strong>Risk Level:</strong> <span style="color: {'#dc2626' if risk_category == 'HIGH' else '#ea580c' if risk_category == 'MEDIUM' else '#16a34a'}; font-weight: bold;">{risk_category}</span></p>
            
            <h3>Top Risk Indicators:</h3>
            <ul>
                {chr(10).join([f'<li>{_format_feature_name(feature)}: {abs(value):.1%} impact</li>' for feature, value in list(top_risk_drivers.items())[:3]])}
            </ul>
            
            <h3>Recommended Actions:</h3>
            <ol>
                <li>Contact customer {action_word} to discuss account status</li>
                <li>Offer restructuring options or assistance programs</li>
                <li>Schedule a financial review session</li>
                <li>Monitor account closely for further deterioration</li>
            </ol>
            
            <hr style="margin: 20px 0;">
            <p style="font-size: 0.9em; color: #666;">
                This assessment is automatically generated by the Pre-Delinquency Early Warning System.
                Final intervention decisions remain your responsibility as the assigned risk officer.
            </p>
        </body>
    </html>
    """
    
    return {
        "subject": subject,
        "body": plain_text.strip(),
        "html": html.strip()
    }


def _format_feature_name(feature: str) -> str:
    """Convert technical feature names to business-friendly format."""
    feature_map = {
        "Salary_Delay_Days": "Frequent Salary Credit Delays",
        "Past_EMI_Delays_6M": "Multiple EMI Delays (Last 6 Months)",
        "Credit_Utilization_%": "High Credit Card Utilization",
        "Savings_Drop_%": "Sudden Savings Decline",
        "Discretionary_Spend_Drop_%": "Reduced Spending Pattern",
        "Utility_Bill_Payment_Shift": "Irregular Bill Payments",
        "ATM_Withdrawal_Increase_%": "Increased Cash Withdrawals",
        "Historical_Stability_Index": "Account Instability",
    }
    return feature_map.get(feature, feature.replace("_", " "))


def _send_intervention_email(
    customer_id: str,
    email_subject: str,
    email_body: str,
    email_html: str
) -> bool:
    """
    Send intervention email through configured email service.
    
    Currently implements a logging-based stub. In production, integrate with:
    - SendGrid API
    - AWS SES
    - Microsoft Graph (for Outlook)
    - Internal banking email system
    
    Args:
        customer_id: Customer identifier for audit trail
        email_subject: Email subject line
        email_body: Plain text email body
        email_html: HTML formatted email body
    
    Returns:
        bool: True if email was sent successfully
    """
    try:
        # Log email for audit trail
        logger.info(f"[EMAIL SENT] Customer: {customer_id}, Subject: {email_subject}")
        logger.debug(f"[EMAIL BODY] {email_body[:200]}...")
        
        # TODO: Integrate with actual email service
        # Example SendGrid integration:
        # from sendgrid import SendGridAPIClient
        # from sendgrid.helpers.mail import Mail, Email, To, Content
        #
        # message = Mail(
        #     from_email=Email("noreply@bank.com"),
        #     to_emails=To(customer_email),
        #     subject=email_subject,
        #     plain_text_content=Content("text/plain", email_body),
        #     html_content=Content("text/html", email_html)
        # )
        # sg = SendGridAPIClient(os.environ.get('SENDGRID_API_KEY'))
        # response = sg.send(message)
        # return response.status_code == 202
        
        # Stub implementation: return True (email logged)
        return True
    
    except Exception as e:
        logger.error(f"Email sending failed for {customer_id}: {str(e)}")
        return False


# ============================================================================
# ERROR HANDLERS
# ============================================================================

@app.exception_handler(HTTPException)
async def http_exception_handler(request, exc):
    """Global error handler for HTTP exceptions."""
    logger.error(f"HTTP Exception: {exc.detail}")
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": exc.detail,
            "status_code": exc.status_code,
            "timestamp": datetime.utcnow().isoformat() + "Z"
        }
    )


# ============================================================================
# PRODUCTION DEPLOYMENT
# ============================================================================

if __name__ == "__main__":
    import uvicorn
    
    # Run with: uvicorn main:app --reload
    # Production: uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4
    uvicorn.run(
        app,
        host="127.0.0.1",
        port=8000,
        log_level="info"
    )
