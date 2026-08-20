import socket

import pytest


def _is_port_open(host: str, port: int) -> bool:
    try:
        with socket.create_connection((host, port), timeout=2):
            return True
    except (OSError, ConnectionRefusedError):
        return False


requires_db = pytest.mark.skipif(
    not _is_port_open("localhost", 5432),
    reason="PostgreSQL not available"
)

requires_redis = pytest.mark.skipif(
    not _is_port_open("localhost", 6379),
    reason="Redis not available"
)
