# Plan: ML Anomaly Detection

**Impact: HIGH | Effort: MEDIUM (3-4 days)**
**Status: NOT STARTED**
**Dependencies: None**

---

## Goal
Detect anomalies in service metrics using Isolation Forest algorithm.

## Current State
- `plugins/rca_engine/anomaly_detector.py` exists with simple std-dev threshold
- No real ML model training
- No historical metric storage
- No anomaly scoring

## Design

### Architecture
```
Metrics Collector → Time Series DB → Anomaly Detector → Alert Generator
                      (Redis)          (Isolation Forest)    (alert-noc)
```

### Anomaly Detection Flow
1. Collect metrics per service (CPU, memory, latency, error rate, throughput)
2. Store in Redis time series (last 24 hours)
3. Train Isolation Forest on historical data
4. Score new metrics in real-time
5. Anomaly score > threshold → generate alert

### ML Pipeline
- **Training**: Train model every hour on last 24h of data
- **Inference**: Score new metrics every 30 seconds
- **Model Storage**: Save trained models to Redis (serialized with pickle)

## Implementation

### Backend

#### 1. Create anomaly detector plugin
- File: `plugins/anomaly_detector/main.py` (NEW)
- FastAPI app with background training loop
- Port: 8006 (internal)

#### 2. Create ML model
- File: `plugins/anomaly_detector/detector.py` (NEW)
```python
from sklearn.ensemble import IsolationForest
import numpy as np
import pickle

class AnomalyDetector:
    def __init__(self):
        self.models = {}  # service_name -> trained model
        self.feature_names = ['cpu_usage', 'memory_usage', 'latency_p99', 'error_rate', 'throughput']
    
    def train(self, service_name: str, historical_data: np.ndarray):
        """Train Isolation Forest on historical metrics."""
        model = IsolationForest(
            n_estimators=100,
            contamination=0.05,  # Expect 5% anomalies
            random_state=42
        )
        model.fit(historical_data)
        self.models[service_name] = model
    
    def predict(self, service_name: str, current_metrics: np.ndarray) -> dict:
        """Predict if current metrics are anomalous."""
        if service_name not in self.models:
            return {"anomaly": False, "score": 0.0, "confidence": 0.0}
        
        model = self.models[service_name]
        score = model.score_samples(current_metrics.reshape(1, -1))[0]
        prediction = model.predict(current_metrics.reshape(1, -1))[0]
        
        # Convert score to confidence (0-100%)
        confidence = min(100, max(0, (score + 0.5) * 100))
        
        return {
            "anomaly": prediction == -1,
            "score": float(score),
            "confidence": confidence,
            "features": dict(zip(self.feature_names, current_metrics.tolist()))
        }
    
    def save(self, service_name: str):
        """Save model to Redis."""
        # Serialize model to bytes
        model_bytes = pickle.dumps(self.models[service_name])
        # Store in Redis
        # redis.set(f"anomaly_model:{service_name}", model_bytes)
    
    def load(self, service_name: str):
        """Load model from Redis."""
        # model_bytes = redis.get(f"anomaly_model:{service_name}")
        # if model_bytes:
        #     self.models[service_name] = pickle.loads(model_bytes)
```

#### 3. Create metrics collector
- File: `plugins/anomaly_detector/collector.py` (NEW)
```python
class MetricsCollector:
    def __init__(self, redis):
        self.redis = redis
    
    async def collect(self, service_name: str, metrics: dict):
        """Store metrics in Redis time series."""
        timestamp = int(time.time())
        key = f"metrics:{service_name}"
        
        # Store as Redis sorted set (timestamp -> metrics JSON)
        await self.redis.zadd(key, {json.dumps(metrics): timestamp})
        
        # Trim to last 24 hours
        cutoff = timestamp - 86400
        await self.redis.zremrangebyscore(key, 0, cutoff)
    
    async def get_historical(self, service_name: str, hours: int = 24) -> list:
        """Get historical metrics for training."""
        cutoff = int(time.time()) - (hours * 3600)
        data = await self.redis.zrangebyscore(f"metrics:{service_name}", cutoff, "+inf")
        return [json.loads(d) for d in data]
```

#### 4. Create API endpoints
- File: `plugins/anomaly_detector/router.py` (NEW)
- `POST /api/v1/anomaly/detect` — detect anomaly for a service
- `GET /api/v1/anomaly/models` — list trained models
- `POST /api/v1/anomaly/train` — trigger training for a service
- `GET /api/v1/anomaly/history/{service}` — get anomaly history

#### 5. Add to docker-compose
- File: `docker-compose.yml`
- Add `anomaly-detector` service:
  ```yaml
  anomaly-detector:
    build: ./plugins/anomaly_detector
    ports:
      - "8006:8006"
    environment:
      - REDIS_URL=redis://:changeme@redis:6379/0
      - OLLAMA_URL=http://ollama:11434
    depends_on:
      - redis
      - ollama
  ```

#### 6. Add proxy route to API gateway
- File: `core_platform/main.py`
- Add route: `/api/v1/anomaly/{path}` → `http://anomaly-detector:8006`

### Frontend

#### 7. Create Anomaly Detection page
- File: `ui/src/pages/AnomalyDetection.tsx` (NEW)
- Service selector dropdown
- Anomaly score gauge (0-100%)
- Anomaly timeline (when anomalies occurred)
- Feature importance chart (which metrics contributed)
- "Train Model" button
- "Detect Now" button

#### 8. Add to routing
- File: `ui/src/App.tsx`
- Add route: `/anomaly` → `AnomalyDetection`

#### 9. Add to navigation
- File: `ui/src/components/Sidebar.tsx`
- Add "Anomaly" nav item with brain icon

#### 10. Add anomaly score to Dashboard
- File: `ui/src/pages/Dashboard.tsx`
- Add anomaly score card per service
- Show trend (improving/worsening)

#### 11. Add to Docs page
- File: `ui/src/pages/Docs.tsx`
- Add "ML Anomaly Detection" section

## Files to Create/Modify
- `plugins/anomaly_detector/` — NEW: entire plugin directory
  - `main.py` — FastAPI app
  - `detector.py` — Isolation Forest model
  - `collector.py` — metrics collector
  - `router.py` — API endpoints
  - `config.py` — configuration
  - `Dockerfile` — container build
- `docker-compose.yml` — add anomaly-detector service
- `core_platform/main.py` — add proxy route
- `ui/src/pages/AnomalyDetection.tsx` — NEW: anomaly page
- `ui/src/pages/Dashboard.tsx` — add anomaly cards
- `ui/src/App.tsx` — add route
- `ui/src/components/Sidebar.tsx` — add nav item
- `ui/src/pages/Docs.tsx` — add documentation

## Verification
1. Navigate to /anomaly
2. Select a service
3. Click "Train Model" → model trains on historical data
4. Click "Detect Now" → shows anomaly score
5. Trigger high CPU alert → anomaly score increases
6. Timeline shows when anomalies occurred
7. Dashboard shows anomaly score per service
