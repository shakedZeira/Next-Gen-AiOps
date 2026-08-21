# Plan: Capacity Planning

**Impact: MEDIUM-HIGH | Effort: HIGH (5-7 days)**
**Status: NOT STARTED**
**Dependencies: None**

---

## Goal
Trend analysis for CPU/memory/disk/network forecasting.

## Current State
- No capacity metrics collection
- No trend analysis
- No capacity alerts
- No scaling recommendations

## Design

### Metrics to Collect
| Resource | Metric | Source |
|----------|--------|--------|
| CPU | Usage %, Cores | Node exporter / OTel |
| Memory | Usage %, Total GB | Node exporter / OTel |
| Disk | Usage %, IOPS | Node exporter / OTel |
| Network | Bandwidth, Packets/s | Node exporter / OTel |

### Forecasting Approach
- **Linear Regression**: Simple trend extrapolation
- **Prophet**: Facebook's time series forecasting for daily/weekly patterns
- **Capacity Thresholds**:
  - Warning: 70% usage
  - Critical: 85% usage
  - Exhausted: 95% usage

### Capacity Alerts
- "CPU will be exhausted in 14 days"
- "Memory usage trending up 2% per day"
- "Disk IOPS capacity reached 80%"

## Implementation

### Backend

#### 1. Create capacity planner plugin
- File: `plugins/capacity_planner/main.py` (NEW)
- FastAPI app with capacity analysis
- Port: 8011 (internal)

#### 2. Create capacity model
- File: `aiops_shared/models/capacity.py` (NEW)
```python
class CapacityMetric(Base):
    __tablename__ = "capacity_metric"
    
    id = Column(String, primary_key=True)
    service = Column(String, nullable=False)
    resource_type = Column(String)  # cpu, memory, disk, network
    usage_percent = Column(Float)
    total_capacity = Column(Float)
    used_capacity = Column(Float)
    timestamp = Column(DateTime)
```

#### 3. Add migration
- File: `db/migrations/010_create_capacity_metric.sql` (NEW)
```sql
CREATE TABLE IF NOT EXISTS capacity_metric (
  id VARCHAR(255) PRIMARY KEY,
  service VARCHAR(255) NOT NULL,
  resource_type VARCHAR(50),
  usage_percent FLOAT,
  total_capacity FLOAT,
  used_capacity FLOAT,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_capacity_service ON capacity_metric(service);
CREATE INDEX idx_capacity_timestamp ON capacity_metric(timestamp DESC);
```

#### 4. Create capacity analyzer
- File: `plugins/capacity_planner/analyzer.py` (NEW)
```python
class CapacityAnalyzer:
    def __init__(self, db_session):
        self.db = db_session
    
    async def analyze_service(self, service: str) -> dict:
        """Analyze capacity for a service."""
        metrics = await self._get_historical_metrics(service)
        
        analysis = {}
        for resource_type in ['cpu', 'memory', 'disk', 'network']:
            resource_metrics = [m for m in metrics if m.resource_type == resource_type]
            if not resource_metrics:
                continue
            
            # Calculate trend
            trend = self._calculate_trend(resource_metrics)
            
            # Forecast exhaustion
            days_to_exhaustion = self._forecast_exhaustion(resource_metrics)
            
            analysis[resource_type] = {
                "current_usage": resource_metrics[-1].usage_percent,
                "trend": trend,  # "increasing", "decreasing", "stable"
                "days_to_exhaustion": days_to_exhaustion,
                "recommendation": self._get_recommendation(resource_metrics[-1].usage_percent, days_to_exhaustion)
            }
        
        return analysis
    
    def _calculate_trend(self, metrics: list) -> str:
        """Calculate if usage is increasing, decreasing, or stable."""
        if len(metrics) < 2:
            return "stable"
        
        # Simple linear regression
        x = list(range(len(metrics)))
        y = [m.usage_percent for m in metrics]
        
        # Calculate slope
        n = len(x)
        sum_x = sum(x)
        sum_y = sum(y)
        sum_xy = sum(xi * yi for xi, yi in zip(x, y))
        sum_x2 = sum(xi ** 2 for xi in x)
        
        slope = (n * sum_xy - sum_x * sum_y) / (n * sum_x2 - sum_x ** 2)
        
        if slope > 0.1:
            return "increasing"
        elif slope < -0.1:
            return "decreasing"
        else:
            return "stable"
    
    def _forecast_exhaustion(self, metrics: list) -> int:
        """Forecast days until capacity exhaustion."""
        if len(metrics) < 2:
            return -1  # Unknown
        
        # Simple extrapolation
        current = metrics[-1].usage_percent
        trend = self._calculate_trend(metrics)
        
        if trend == "stable":
            return -1  # Never exhausted
        elif trend == "increasing":
            # Calculate days to reach 95%
            daily_increase = (metrics[-1].usage_percent - metrics[0].usage_percent) / len(metrics)
            if daily_increase <= 0:
                return -1
            days = (95 - current) / daily_increase
            return int(days)
        else:
            return -1  # Decreasing, never exhausted
    
    def _get_recommendation(self, current_usage: float, days_to_exhaustion: int) -> str:
        """Get capacity recommendation."""
        if current_usage > 95:
            return "IMMEDIATE: Scale up or optimize"
        elif current_usage > 85:
            return "URGENT: Plan scaling within 7 days"
        elif current_usage > 70:
            return "WARNING: Monitor closely, plan scaling"
        elif days_to_exhaustion > 0 and days_to_exhaustion < 30:
            return f"TREND: Will reach 95% in {days_to_exhaustion} days"
        else:
            return "HEALTHY: No action needed"
```

#### 5. Create API endpoints
- File: `plugins/capacity_planner/router.py` (NEW)
- `GET /api/v1/capacity/{service}` — get capacity analysis for a service
- `GET /api/v1/capacity` — get capacity overview for all services
- `GET /api/v1/capacity/alerts` — get capacity alerts
- `POST /api/v1/capacity/analyze` — trigger analysis

#### 6. Add to docker-compose
- File: `docker-compose.yml`
- Add `capacity-planner` service:
  ```yaml
  capacity-planner:
    build: ./plugins/capacity_planner
    ports:
      - "8011:8011"
    environment:
      - DATABASE_URL=postgresql+asyncpg://aiops:aiops@postgres:5432/aiops
      - REDIS_URL=redis://:changeme@redis:6379/0
    depends_on:
      - postgres
      - redis
  ```

#### 7. Add proxy route to API gateway
- File: `core_platform/main.py`
- Add route: `/api/v1/capacity/{path}` → `http://capacity-planner:8011`

### Frontend

#### 8. Create Capacity Planning page
- File: `ui/src/pages/CapacityPlanning.tsx` (NEW)
- Service selector dropdown
- Resource type selector (CPU, Memory, Disk, Network)
- Usage trend chart (line chart with trend line)
- Capacity forecast (when will reach 95%)
- Recommendations list
- Capacity alerts

#### 9. Add capacity cards to Dashboard
- File: `ui/src/pages/Dashboard.tsx`
- Add capacity summary cards per service
- Show "CPU: 75% (trending up)" badges
- Show "Memory: Will be exhausted in 14 days" alerts

#### 10. Add to routing
- File: `ui/src/App.tsx`
- Add route: `/capacity` → `CapacityPlanning`

#### 11. Add to navigation
- File: `ui/src/components/Sidebar.tsx`
- Add "Capacity" nav item with server icon

#### 12. Add to Docs page
- File: `ui/src/pages/Docs.tsx`
- Add "Capacity Planning" section

## Files to Create/Modify
- `plugins/capacity_planner/` — NEW: entire plugin directory
  - `main.py` — FastAPI app
  - `analyzer.py` — capacity analyzer
  - `router.py` — API endpoints
  - `config.py` — configuration
  - `Dockerfile` — container build
- `aiops_shared/models/capacity.py` — NEW: capacity model
- `db/migrations/010_create_capacity_metric.sql` — NEW: migration
- `docker-compose.yml` — add capacity-planner service
- `core_platform/main.py` — add proxy route
- `ui/src/pages/CapacityPlanning.tsx` — NEW: capacity page
- `ui/src/pages/Dashboard.tsx` — add capacity cards
- `ui/src/App.tsx` — add route
- `ui/src/components/Sidebar.tsx` — add nav item
- `ui/src/pages/Docs.tsx` — add documentation

## Verification
1. Navigate to /capacity
2. Select a service and resource type
3. See usage trend chart
4. Trend line shows increasing usage
5. Forecast shows "Will reach 95% in 14 days"
6. Recommendation shows "URGENT: Plan scaling within 7 days"
7. Dashboard shows capacity summary cards
8. Capacity alerts appear when usage exceeds thresholds
