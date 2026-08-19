from unittest.mock import patch, AsyncMock, MagicMock
from httpx import AsyncClient
from plugins.infra_simulator.main import app
from plugins.infra_simulator.topology import INFRA_DEVICES, SERVICE_MAP
from plugins.infra_simulator.log_emitter import _format_log
from plugins.infra_simulator.alert_rules import build_alert_payload, trigger_alert


async def test_health():
    async with AsyncClient(app=app, base_url="http://test") as client:
        resp = await client.get("/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "healthy"
        assert data["devices"] == len(INFRA_DEVICES)


async def test_status():
    async with AsyncClient(app=app, base_url="http://test") as client:
        resp = await client.get("/status")
        assert resp.status_code == 200
        data = resp.json()
        assert "running" in data
        assert data["device_count"] == len(INFRA_DEVICES)


def test_topology_has_all_device_types():
    types = {d.device_type for d in INFRA_DEVICES}
    assert types == {"switch", "router", "physical_server", "container", "pod"}


def test_topology_has_expected_count():
    assert len(INFRA_DEVICES) == 21


def test_service_map_covers_all_devices():
    for device in INFRA_DEVICES:
        assert device.name in SERVICE_MAP, f"{device.name} missing from SERVICE_MAP"


def test_format_log_produces_string():
    device = INFRA_DEVICES[0]
    from plugins.infra_simulator.log_emitter import SWITCH_LOGS
    severity, template = SWITCH_LOGS[0]
    result = _format_log(template, device)
    assert isinstance(result, str)
    assert len(result) > 0


def test_build_alert_payload_structure():
    device = INFRA_DEVICES[0]
    alert_rule = {"trigger": "test_trigger", "severity": "critical", "name_tpl": "Test Alert - {device}"}
    payload = build_alert_payload(device, alert_rule)
    assert payload["severity"] == "critical"
    assert device.name in payload["name"]
    assert payload["labels"]["device.name"] == device.name
    assert payload["labels"]["source"] == "infra-simulator"
    assert "service" in payload


def test_alert_payload_all_device_types():
    for device in INFRA_DEVICES:
        alert_rule = {"trigger": "test", "severity": "high", "name_tpl": "Test - {device}"}
        payload = build_alert_payload(device, alert_rule)
        assert payload["team"] == device.team
        assert payload["labels"]["device.type"] == device.device_type


@patch("plugins.infra_simulator.alert_rules.httpx.AsyncClient")
async def test_trigger_alert_posts_to_noc(mock_client_cls):
    mock_post = AsyncMock()
    mock_post.__aenter__ = AsyncMock(return_value=mock_post)
    mock_post.__aexit__ = AsyncMock(return_value=False)
    mock_client_cls.return_value = mock_post
    mock_post.post = AsyncMock()

    device = INFRA_DEVICES[0]
    await trigger_alert(device, "http://alert-noc:8005")
    mock_post.post.assert_called_once()
    call_args = mock_post.post.call_args
    assert "alerts" in call_args[0][0]


def test_device_properties_populated():
    for device in INFRA_DEVICES:
        assert isinstance(device.properties, dict)
        if device.device_type == "physical_server":
            assert "os" in device.properties or device.os is not None
