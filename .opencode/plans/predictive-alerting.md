# Plan: Predictive Alerting

**Impact: HIGH | Effort: HIGH (5-7 days)**
**Status: NOT STARTED**
**Dependencies: ML Anomaly Detection (plan exists)**

---

## Goal
Forecast metric trends and alert before threshold breach.

## Current State
- Anomaly detection detects current anomalies
- No forecasting capability
- No proactive alerting
- No trend analysis

## Design

### Architecture
```
Metrics Collector → Time Series DB → Forecasting Engine → Alert Generator
                      (Redis)          (ARIMA/Prophet)      (alert-noc)
```

### Forecasting Approach
- **ARIMA**: AutoRegressive Integrated Moving Average for short-term forecasts
- **Prophet**: Facebook's time series forecasting for daily/weekly patterns
- **Ensemble**: Combine both for more robust predictions

### Forecasting Flow
1. Collect metrics per service (CPU, memory, latency, error rate)
2. Store in Redis time series (last 7 days)
3. Train forecasting model hourly
4. Forecast next 30 minutes
5. Alert if forecast exceeds threshold with >80% confidence

## Implementation

### Backend

#### 1. Create forecasting plugin
- File: `plugins/forecasting/main.py` (NEW)
- FastAPI app with background forecasting loop
- Port: 8008 (internal)

#### 2. Create forecasting models
- File: `plugins/forecasting/models.py` (NEW)
```python
from statsmodels.tsa.arima.model import ARIMA
from prophet import Prophet
import numpy as np

class ForecastingEngine:
    def __init__(self):
        self.arima_models = {}
        self.prophet_models = {}
    
    def train_arima(self, service_name: str, metric: str, data: list):
        """Train ARIMA model on historical data."""
        model = ARIMA(data, order=(5, 1, 0))
        self.arima_models[f"{service_name}:{metric}"] = model.fit()
    
    def train_prophet(self, service_name: str, metric: str, data: list):
        """Train Prophet model on historical data."""
        df = pd.DataFrame({'ds': timestamps, 'y': data})
        model = Prophet(daily_seasonality=True)
        model.fit(df)
        self.prophet_models[f"{service_name}:{metric}"] = model
    
    def forecast_arima(self, service_name: str, metric: str, steps: int = 30) -> dict:
        """Forecast next N minutes using ARIMA."""
        key = f"{service_name}:{metric}"
        if key not in self.arima_models:
            return {"forecast": [], "confidence": []}
        
        model = self.arima_models[key]
        forecast = model.forecast(steps=steps)
        conf_int = model.get_forecast(steps=steps).conf_int()
        
        return {
            "forecast": forecast.tolist(),
            "confidence_lower": conf_int[:, 0].tolist(),
            "confidence_upper": conf_int[:, 1].tolist()
        }
    
    def forecast_prophet(self, service_name: str, metric: str, steps: int = 30) -> dict:
        """Forecast next N minutes using Prophet."""
        key = f"{service_name}:{metric}"
        if key not in self.prophet_models:
            return {"forecast": [], "confidence": []}
        
        model = self.prophet_models[key]
        future = model.make_future_dataframe(periods=steps, freq='T')
        prediction = model.predict(future)
        
        return {
            "forecast": prediction['yhat'].tolist()[-steps:],
            "confidence_lower": prediction['yhat_lower'].tolist()[-steps:],
            "confidence_upper": prediction['yhat_upper'].tolist()[-steps:]
        }
    
    def forecast_ensemble(self, service_name: str, metric: str, steps: int = 30) -> dict:
        """Combine ARIMA and Prophet forecasts."""
        arima = self.forecast_arima(service_name, metric, steps)
        prophet = self.forecast_prophet(service_name, metric, steps)
        
        # Weighted average (ARIMA: 0.4, Prophet: 0.6)
        ensemble = {
            "forecast": [a * 0.4 + p * 0.6 for a, p in zip(arima["forecast"], prophet["forecast"])],
            "confidence_lower": [a * 0.4 + p * 0.6 for a, p in zip(arima["confidence_lower"], prophet["confidence_lower"])],
            "confidence_upper": [a * 0.4 + p * 0.6 for a, p in zip(arima["confidence_upper"], prophet["confidence_upper"])]
        }
        
        return ensemble
```

#### 3. Create API endpoints
- File: `plugins/forecasting/router.py` (NEW)
- `GET /api/v1/forecast/{service}` — get forecast for a service
- `POST /api/v1/forecast/train` — trigger training
- `GET /api/v1/forecast/history/{service}` — get forecast history
- `GET /api/v1/forecast/alerts` — get predictive alerts

#### 4. Add to docker-compose
- File: `docker-compose.yml`
- Add `forecasting-engine` service:
  ```yaml
  forecasting-engine:
    build: ./plugins/forecasting
    ports:
      - "8008:8008"
    environment:
      - REDIS_URL=redis://:changeme@redis:6379/0
      - ALERT_NOC_URL=http://alert-noc:8005
    depends_on:
      - redis
      - alert-noc
  ```

#### 5. Add proxy route to API gateway
- File: `core_platform/main.py`
- Add route: `/api/v1/forecast/{path}` → `http://forecasting-engine:8008`

### Frontend

#### 6. Create Forecasting page
- File: `ui/src/pages/Forecasting.tsx` (NEW)
- Service selector dropdown
- Metric selector (CPU, Memory, Latency, Error Rate)
- Forecast chart (line chart with confidence interval)
- Threshold line (red dashed)
- "Train Model" button
- "Forecast Now" button
- Predictive alerts list

#### 7. Add to routing
- File: `ui/src/App.tsx`
- Add route: `/forecast` → `Forecasting`

#### 8. Add to navigation
- File: `ui/src/components/Sidebar.tsx`
- Add "Forecast" nav item with chart icon

#### 9. Add forecast cards to Dashboard
- File: `ui/src/pages/Dashboard.tsx`
- Add forecast summary cards per service
- Show "CPU will exceed 90% in 15 minutes" alerts

#### 10. Add to Docs page
- File: `ui/src/pages/Docs.tsx`
- Add "Predictive Alerting" section

## Files to Create/Modify
- `plugins/forecasting/` — NEW: entire plugin directory
  - `main.py` — FastAPI app
  - `models.py` — ARIMA/Prophet forecasting models
  - `router.py` — API endpoints
  - `config.py` — configuration
  - `Dockerfile` — container build
- `docker-compose.yml` — add forecasting-engine service
- `core_platform/main.py` — add proxy route
- `ui/src/pages/Forecasting.tsx` — NEW: forecasting page
- `ui/src/pages/Dashboard.tsx` — add forecast cards
- `ui/src/App.tsx` — add route
- `ui/src/components/Sidebar.tsx` — add nav item
- `ui/src/pages/Docs.tsx` — add documentation

## Verification
1. Navigate to /forecast
2. Select a service and metric
3. Click "Train Model" → model trains on 7 days of data
4. Click "Forecast Now" → see forecast chart
5. Threshold line shows when metric will breach
6. Confidence interval shows uncertainty
7. Predictive alert appears when forecast exceeds threshold
8. Dashboard shows forecast summary cards
