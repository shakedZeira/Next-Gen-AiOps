FROM python:3.11-slim
WORKDIR /app
COPY pyproject.toml .
RUN pip install -e .
COPY aiops_shared/ aiops_shared/
COPY plugins/alert_noc/ plugins/alert_noc/
CMD ["uvicorn", "plugins.alert_noc.main:app", "--host", "0.0.0.0", "--port", "8005"]
