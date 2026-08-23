FROM python:3.11-slim
WORKDIR /app

RUN pip install --no-cache-dir \
    "pysnmp>=7.1,<8" \
    "cryptography>=43" \
    fastapi \
    "uvicorn[standard]" \
    httpx \
    "redis>=5.0.0" \
    pydantic-settings

COPY plugins/__init__.py plugins/__init__.py
COPY plugins/snmp_receiver/ plugins/snmp_receiver/

EXPOSE 162/udp 8016/tcp
CMD ["uvicorn", "plugins.snmp_receiver.main:app", "--host", "0.0.0.0", "--port", "8016"]
