FROM python:3.11-slim
WORKDIR /app
COPY pyproject.toml .
RUN pip install -e .
COPY aiops_shared/ aiops_shared/
COPY plugins/agent_monitor/ plugins/agent_monitor/
CMD ["uvicorn", "plugins.agent_monitor.main:app", "--host", "0.0.0.0", "--port", "8002"]
