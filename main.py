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
from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, ConfigDict
from typing import Dict, Optional, List
from datetime import datetime
import shap
import logging
import os

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
async def list_customers() -> List[str]:
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
    
    return customer_data_df.index.tolist()


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
        logger.error(f"Customer {request.customer_id} not found in banking records")
        raise HTTPException(
            status_code=404,
            detail=f"Customer {request.customer_id} not found in banking records."
        )
    except Exception as e:
        logger.error(f"Prediction error: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Prediction failed. Please check customer ID and try again."
        )


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
