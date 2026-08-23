import hashlib
import time

import httpx
from fastapi import APIRouter

router = APIRouter()

SLO_TARGETS = {
    "E-Commerce Platform": {
        "tier": "gold",
        "availability": {"target": 99.95, "sli_base": 99.97},
        "latency_p99": {"target": 200, "sli_base": 145},
        "error_rate": {"target": 1.0, "sli_base": 0.6},
    },
    "Payment Gateway": {
        "tier": "gold",
        "availability": {"target": 99.99, "sli_base": 99.93},
        "latency_p99": {"target": 500, "sli_base": 310},
        "error_rate": {"target": 0.5, "sli_base": 0.8},
    },
    "Inventory Service": {
        "tier": "silver",
        "availability": {"target": 99.9, "sli_base": 99.96},
        "latency_p99": {"target": 300, "sli_base": 85},
        "error_rate": {"target": 2.0, "sli_base": 0.4},
    },
    "Notification Service": {
        "tier": "bronze",
        "availability": {"target": 99.5, "sli_base": 99.98},
        "latency_p99": {"target": 500, "sli_base": 42},
        "error_rate": {"target": 3.0, "sli_base": 0.15},
    },
    "Order Processing": {
        "tier": "gold",
        "availability": {"target": 99.95, "sli_base": 99.98},
        "latency_p99": {"target": 250, "sli_base": 92},
        "error_rate": {"target": 1.0, "sli_base": 0.5},
    },
    "Analytics Pipeline": {
        "tier": "silver",
        "availability": {"target": 99.0, "sli_base": 99.94},
        "latency_p99": {"target": 1000, "sli_base": 155},
        "error_rate": {"target": 2.0, "sli_base": 0.3},
    },
    "Auth Service": {
        "tier": "gold",
        "availability": {"target": 99.99, "sli_base": 99.99},
        "latency_p99": {"target": 100, "sli_base": 28},
        "error_rate": {"target": 0.5, "sli_base": 0.1},
    },
    "Network Infrastructure": {
        "tier": "gold",
        "availability": {"target": 99.99, "sli_base": 99.99},
        "latency_p99": {"target": 50, "sli_base": 12},
        "error_rate": {"target": 0.1, "sli_base": 0.02},
    },
}

_ERROR_BUDGET_MINUTES_MONTH = 30 * 24 * 60


def _jitter(service: str, sli_type: str, seed_extra: str = "") -> float:
    h = hashlib.md5(f"{service}:{sli_type}:{int(time.time()) // 30}:{seed_extra}".encode()).hexdigest()
    return (int(h[:8], 16) / 0xFFFFFFFF) * 0.4 - 0.2


def _compute_sli(service: str, targets: dict, active_alerts: int, total_alerts: int) -> dict:
    avail_base = targets["availability"]["sli_base"]
    latency_base = targets["latency_p99"]["sli_base"]
    error_base = targets["error_rate"]["sli_base"]

    alert_penalty = min(active_alerts * 0.15, 2.0)
    avail = max(90.0, avail_base - alert_penalty + _jitter(service, "avail"))
    latency = max(1, latency_base * (1 + alert_penalty * 0.3) + _jitter(service, "latency") * latency_base * 0.1)
    error_rate = max(0.0, error_base + alert_penalty * 0.3 + _jitter(service, "error") * 0.3)

    budget_total = _ERROR_BUDGET_MINUTES_MONTH * (1 - targets["availability"]["target"] / 100)
    consumed = min(total_alerts * 2.5, budget_total * 0.8)
    budget_remaining = max(0, budget_total - consumed)
    budget_pct = (budget_remaining / budget_total * 100) if budget_total > 0 else 100

    if budget_pct > 50:
        budget_status = "healthy"
    elif budget_pct > 25:
        budget_status = "warning"
    elif budget_pct > 0:
        budget_status = "critical"
    else:
        budget_status = "exhausted"

    return {
        "service": service,
        "tier": targets["tier"],
        "slis": {
            "availability": {
                "name": "Availability",
                "value": round(avail, 3),
                "target": targets["availability"]["target"],
                "unit": "%",
                "met": avail >= targets["availability"]["target"],
            },
            "latency_p99": {
                "name": "Latency P99",
                "value": round(latency, 1),
                "target": targets["latency_p99"]["target"],
                "unit": "ms",
                "met": latency <= targets["latency_p99"]["target"],
            },
            "error_rate": {
                "name": "Error Rate",
                "value": round(error_rate, 2),
                "target": targets["error_rate"]["target"],
                "unit": "%",
                "met": error_rate <= targets["error_rate"]["target"],
            },
        },
        "error_budget": {
            "total_minutes": round(budget_total, 1),
            "remaining_minutes": round(budget_remaining, 1),
            "remaining_pct": round(budget_pct, 1),
            "status": budget_status,
        },
        "active_alerts": active_alerts,
    }


async def _get_alert_counts() -> dict[str, tuple[int, int]]:
    counts: dict[str, tuple[int, int]] = {}
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(5.0)) as client:
            resp = await client.get("http://alert-noc:8005/api/v1/alerts")
            if resp.status_code == 200:
                alerts = resp.json()
                for a in alerts:
                    svc = a.get("service", "unknown")
                    active, total = counts.get(svc, (0, 0))
                    total += 1
                    if a.get("status") == "active":
                        active += 1
                    counts[svc] = (active, total)
    except Exception:
        pass
    return counts


@router.get("/slo")
async def list_slos():
    alert_counts = await _get_alert_counts()
    results = []
    for service, targets in SLO_TARGETS.items():
        active, total = alert_counts.get(service, (0, 0))
        results.append(_compute_sli(service, targets, active, total))
    return results


@router.get("/slo/{service}")
async def get_service_slo(service: str):
    matched = None
    for name in SLO_TARGETS:
        if name.lower().replace(" ", "-") == service.lower().replace(" ", "-") or name.lower() == service.lower():
            matched = name
            break
    if not matched:
        return {"error": f"Service '{service}' not found"}

    alert_counts = await _get_alert_counts()
    active, total = alert_counts.get(matched, (0, 0))
    return _compute_sli(matched, SLO_TARGETS[matched], active, total)
