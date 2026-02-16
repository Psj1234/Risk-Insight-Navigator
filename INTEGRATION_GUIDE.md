# Backend-Frontend Integration Guide

## Pre-Delinquency Early Warning Engine
### Behavioural Drift-Based Financial Stress Detection System

---

## 🚀 Quick Start

### 1. Backend Setup

#### Install Python Dependencies
```bash
pip install -r requirements.txt
```

#### Place Model File
Ensure `model.pkl` exists in the project root:
```
c:\Users\tatva\Hackathon\Delinquency_engine\risk-insight-navigator\model.pkl
```

#### Start FastAPI Backend
```bash
uvicorn main:app --reload
```

Backend runs on: **http://localhost:8000**

**Check Backend Health:**
```bash
curl http://localhost:8000
```

Expected response:
```json
{
  "status": "operational",
  "model_loaded": true,
  "model_version": "1.0"
}
```

---

### 2. Frontend Setup

#### Install Frontend Dependencies
```bash
bun install
```
(or use `npm install` or `yarn install`)

#### Start Frontend Development Server
```bash
bun run dev
```

Frontend runs on: **http://localhost:5173**

---

## 🎯 Integration Architecture

### API Communication Flow

```
Frontend (React/TypeScript)
    ↓
    POST /predict
    http://localhost:8000/predict
    ↓
Backend (FastAPI)
    ↓
    Load Model (model.pkl)
    Generate Prediction
    SHAP Explainability
    ↓
    JSON Response
    ↓
Frontend Displays Results
```

---

## 📡 API Endpoints

### 1. Health Check
**GET** `http://localhost:8000/`

**Response:**
```json
{
  "status": "operational",
  "model_loaded": true,
  "model_version": "1.0"
}
```

### 2. Predict Risk
**POST** `http://localhost:8000/predict`

**Request:**
```json
{
  "Avg_Salary_Day_6M": 30,
  "Current_Salary_Day": 34,
  "Salary_Delay_Days": 4,
  "Savings_6M_Avg": 120000,
  "Current_Savings": 82000,
  "Savings_Drop_%": 31,
  "Discretionary_Spend_6M_Avg": 15000,
  "Current_Discretionary_Spend": 9000,
  "Discretionary_Drop_%": 40,
  "Utility_Payment_Shift_Days": 6,
  "ATM_Withdrawal_Increase_%": 52,
  "Credit_Utilization_%": 68,
  "Past_EMI_Delays_6M": 2,
  "Historical_Stability_Index": 0.42,
  "Historical_Category": 1
}
```

**Response:**
```json
{
  "risk_probability": 0.82,
  "risk_category": "HIGH",
  "top_risk_drivers": {
    "Past_EMI_Delays_6M": 0.31,
    "Salary_Delay_Days": 0.22,
    "Savings_Drop_%": 0.18,
    "Credit_Utilization_%": 0.12
  },
  "model_version": "1.0",
  "prediction_timestamp": "2026-02-16T10:30:45.123456Z"
}
```

---

## 🎨 Frontend Features

### Risk Prediction Page
- **Route:** `http://localhost:5173/prediction`
- **Features:**
  - Input form for all 15 customer features
  - Real-time backend prediction
  - Risk probability display (0-100%)
  - Risk category classification (LOW/MEDIUM/HIGH)
  - SHAP-based feature importance visualization
  - Top 5 contributing risk drivers
  - Audit trail with prediction timestamp

### Navigation
- Click "Risk Prediction" in left sidebar
- Or navigate to `/prediction`

---

## 🔄 Risk Classification Logic

| Risk Category | Probability Range |
|---------------|-------------------|
| **LOW** | 0% - 39% |
| **MEDIUM** | 40% - 69% |
| **HIGH** | 70% - 100% |

---

## ⚙️ CORS Configuration

Backend is configured to accept requests from all origins:
```python
CORSMiddleware(
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

This allows frontend to call backend from any port.

---

## 🔐 Compliance Notes

**Model provides risk decision support. Final intervention decisions remain human-controlled.**

The system is designed as an Enterprise Decision Support System, not an automated decision system.

---

## 📊 File Structure

```
risk-insight-navigator/
├── main.py                           # FastAPI backend
├── model.pkl                         # Pre-trained ML model
├── requirements.txt                  # Python dependencies
├── package.json                      # Node dependencies
├── src/
│   ├── lib/
│   │   ├── backendApi.ts            # API client
│   │   ├── mockData.ts
│   │   └── utils.ts
│   ├── pages/
│   │   ├── PredictionPage.tsx        # NEW: Risk prediction UI
│   │   ├── DashboardPage.tsx
│   │   ├── RiskExplorerPage.tsx
│   │   ├── PortfolioDriftPage.tsx
│   │   ├── AlertsPage.tsx
│   │   └── ExplainabilityPage.tsx
│   ├── components/
│   │   └── dashboard/
│   │       ├── DashboardSidebar.tsx  # UPDATED: Added navigation link
│   │       ├── DashboardLayout.tsx
│   │       ├── DashboardHeader.tsx
│   │       └── ...
│   ├── App.tsx                       # UPDATED: Added route
│   └── main.tsx
```

---

## 🐛 Troubleshooting

### Backend Connection Failed
**Error:** "Unable to connect to backend. Ensure FastAPI server is running on http://localhost:8000"

**Solution:**
1. Ensure backend is running: `uvicorn main:app --reload`
2. Verify backend URL: http://localhost:8000
3. Check firewall settings

### Model Not Loaded
**Error:** "Model not available. Service initialization in progress."

**Solution:**
1. Ensure `model.pkl` exists in project root
2. Check file permissions
3. Restart backend: `uvicorn main:app --reload`

### Python Dependency Issues
**Error:** `ModuleNotFoundError: No module named 'fastapi'`

**Solution:**
```bash
pip install -r requirements.txt
```

---

## 🎯 Features Integrated

✅ Backend FastAPI service with model loading
✅ CORS enabled for cross-origin requests
✅ SHAP explainability with top 5 features
✅ Risk classification (LOW/MEDIUM/HIGH)
✅ API client (`backendApi.ts`)
✅ Prediction page with input form
✅ Results visualization with charts
✅ Risk drivers bar chart
✅ Feature contribution scores
✅ Navigation sidebar integration
✅ Error handling and loading states
✅ Compliance messaging

---

## 📝 Environment Requirements

- Python 3.8+
- Node.js 16+ / Bun
- 512MB RAM minimum
- 100MB disk space for model

---

## 🚀 Deployment Ready

The system is production-grade and ready for deployment with:
- Proper error handling
- Logging infrastructure
- CORS configuration
- Response validation
- Model versioning
- Compliance messaging

---

For questions or issues, refer to backend logs:

```bash
# Enable debug logging
uvicorn main:app --reload --log-level debug
```
