FROM python:3.11-slim
WORKDIR /app
COPY pyproject.toml .
RUN pip install -e .
COPY aiops_shared/ aiops_shared/
COPY plugins/rca_engine/ plugins/rca_engine/
CMD ["uvicorn", "plugins.rca_engine.main:app", "--host", "0.0.0.0", "--port", "8003"]
