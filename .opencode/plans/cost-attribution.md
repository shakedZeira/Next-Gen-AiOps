# Plan: Cost Attribution

**Impact: MEDIUM-HIGH | Effort: HIGH (5-7 days)**
**Status: NOT STARTED**
**Dependencies: None**

---

## Goal
Map infrastructure costs to services/teams.

## Current State
- No cost tracking
- No cost allocation
- No budget alerts
- No cost optimization recommendations

## Design

### Cost Categories
| Category | Description | Allocation Method |
|----------|-------------|-------------------|
| Compute | VMs, containers, serverless | Per-service usage |
| Storage | Databases, object storage | Per-service usage |
| Network | Bandwidth, load balancers | Per-service usage |
| Platform | Shared services (monitoring, logging) | Proportional allocation |

### Cost Allocation
- **Direct costs**: Allocate to specific service (e.g., dedicated database)
- **Shared costs**: Allocate proportionally (e.g., shared Kubernetes cluster)
- **Overhead costs**: Allocate evenly (e.g., monitoring, logging)

## Implementation

### Backend

#### 1. Create cost tracker plugin
- File: `plugins/cost_tracker/main.py` (NEW)
- FastAPI app with cost analysis
- Port: 8012 (internal)

#### 2. Create cost model
- File: `aiops_shared/models/cost.py` (NEW)
```python
class CostRecord(Base):
    __tablename__ = "cost_record"
    
    id = Column(String, primary_key=True)
    service = Column(String, nullable=False)
    cost_type = Column(String)  # compute, storage, network, platform
    amount = Column(Float)
    currency = Column(String, default="USD")
    period = Column(String)  # daily, monthly
    timestamp = Column(DateTime)
```

#### 3. Add migration
- File: `db/migrations/011_create_cost_record.sql` (NEW)
```sql
CREATE TABLE IF NOT EXISTS cost_record (
  id VARCHAR(255) PRIMARY KEY,
  service VARCHAR(255) NOT NULL,
  cost_type VARCHAR(50),
  amount FLOAT,
  currency VARCHAR(10) DEFAULT 'USD',
  period VARCHAR(20),
  timestamp TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_cost_service ON cost_record(service);
CREATE INDEX idx_cost_timestamp ON cost_record(timestamp DESC);
```

#### 4. Create cost analyzer
- File: `plugins/cost_tracker/analyzer.py` (NEW)
```python
class CostAnalyzer:
    def __init__(self, db_session):
        self.db = db_session
    
    async def analyze_service(self, service: str, period: str = "monthly") -> dict:
        """Analyze costs for a service."""
        costs = await self._get_costs(service, period)
        
        analysis = {
            "total_cost": sum(c.amount for c in costs),
            "breakdown": {},
            "trend": "stable",
            "recommendations": []
        }
        
        # Group by cost type
        for cost_type in ['compute', 'storage', 'network', 'platform']:
            type_costs = [c for c in costs if c.cost_type == cost_type]
            analysis["breakdown"][cost_type] = {
                "amount": sum(c.amount for c in type_costs),
                "percentage": (sum(c.amount for c in type_costs) / analysis["total_cost"] * 100) if analysis["total_cost"] > 0 else 0
            }
        
        # Calculate trend
        analysis["trend"] = self._calculate_trend(costs)
        
        # Generate recommendations
        analysis["recommendations"] = self._generate_recommendations(analysis)
        
        return analysis
    
    def _calculate_trend(self, costs: list) -> str:
        """Calculate cost trend."""
        if len(costs) < 2:
            return "stable"
        
        # Compare current month to previous month
        current = sum(c.amount for c in costs[-30:])
        previous = sum(c.amount for c in costs[-60:-30])
        
        if current > previous * 1.1:
            return "increasing"
        elif current < previous * 0.9:
            return "decreasing"
        else:
            return "stable"
    
    def _generate_recommendations(self, analysis: dict) -> list:
        """Generate cost optimization recommendations."""
        recommendations = []
        
        # Check if compute costs are high
        if analysis["breakdown"]["compute"]["percentage"] > 50:
            recommendations.append("Consider reserved instances for compute workloads")
        
        # Check if storage costs are high
        if analysis["breakdown"]["storage"]["percentage"] > 30:
            recommendations.append("Review storage lifecycle policies")
        
        # Check if costs are increasing
        if analysis["trend"] == "increasing":
            recommendations.append("Costs trending up - review resource utilization")
        
        return recommendations
```

#### 5. Create API endpoints
- File: `plugins/cost_tracker/router.py` (NEW)
- `GET /api/v1/costs/{service}` — get cost analysis for a service
- `GET /api/v1/costs` — get cost overview for all services
- `GET /api/v1/costs/budget` — get budget status
- `POST /api/v1/costs/analyze` — trigger analysis

#### 6. Seed cost data
- File: `db/seed_costs.py` (NEW)
- Create realistic cost data for all 8 services:
  - Payment Gateway: $500/month (compute: $300, storage: $100, network: $50, platform: $50)
  - E-Commerce Platform: $800/month (compute: $400, storage: $200, network: $100, platform: $100)
  - etc.

#### 7. Add to docker-compose
- File: `docker-compose.yml`
- Add `cost-tracker` service:
  ```yaml
  cost-tracker:
    build: ./plugins/cost_tracker
    ports:
      - "8012:8012"
    environment:
      - DATABASE_URL=postgresql+asyncpg://aiops:aiops@postgres:5432/aiops
      - REDIS_URL=redis://:changeme@redis:6379/0
    depends_on:
      - postgres
      - redis
  ```

#### 8. Add proxy route to API gateway
- File: `core_platform/main.py`
- Add route: `/api/v1/costs/{path}` → `http://cost-tracker:8012`

### Frontend

#### 9. Create Cost Dashboard page
- File: `ui/src/pages/CostDashboard.tsx` (NEW)
- Total cost summary card
- Cost breakdown pie chart (compute/storage/network/platform)
- Cost by service bar chart
- Cost trend line chart
- Budget status bar
- Recommendations list

#### 10. Add cost cards to Dashboard
- File: `ui/src/pages/Dashboard.tsx`
- Add cost summary card
- Show "Total: $5,200/month" badge
- Show "Budget: 78% used" warning

#### 11. Add to routing
- File: `ui/src/App.tsx`
- Add route: `/costs` → `CostDashboard`

#### 12. Add to navigation
- File: `ui/src/components/Sidebar.tsx`
- Add "Costs" nav item with dollar icon

#### 13. Add to Docs page
- File: `ui/src/pages/Docs.tsx`
- Add "Cost Attribution" section

## Files to Create/Modify
- `plugins/cost_tracker/` — NEW: entire plugin directory
  - `main.py` — FastAPI app
  - `analyzer.py` — cost analyzer
  - `router.py` — API endpoints
  - `config.py` — configuration
  - `Dockerfile` — container build
- `aiops_shared/models/cost.py` — NEW: cost model
- `db/migrations/011_create_cost_record.sql` — NEW: migration
- `db/seed_costs.py` — NEW: seed data
- `docker-compose.yml` — add cost-tracker service
- `core_platform/main.py` — add proxy route
- `ui/src/pages/CostDashboard.tsx` — NEW: cost dashboard
- `ui/src/pages/Dashboard.tsx` — add cost card
- `ui/src/App.tsx` — add route
- `ui/src/components/Sidebar.tsx` — add nav item
- `ui/src/pages/Docs.tsx` — add documentation

## Verification
1. Navigate to /costs
2. See total cost summary ($5,200/month)
3. See cost breakdown pie chart
4. See cost by service bar chart
5. See cost trend line chart
6. Budget status shows 78% used
7. Recommendations show optimization tips
8. Dashboard shows cost summary card
