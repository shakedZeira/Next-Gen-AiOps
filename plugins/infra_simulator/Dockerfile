FROM python:3.11-slim
WORKDIR /app
COPY pyproject.toml .
RUN pip install -e .
COPY aiops_shared/ aiops_shared/
COPY plugins/infra_simulator/ plugins/infra_simulator/
CMD ["uvicorn", "plugins.infra_simulator.main:app", "--host", "0.0.0.0", "--port", "8006"]
