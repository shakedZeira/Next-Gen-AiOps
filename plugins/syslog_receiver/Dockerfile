FROM python:3.11-slim
WORKDIR /app
COPY pyproject.toml .
RUN pip install -e .
COPY aiops_shared/ aiops_shared/
COPY plugins/syslog_receiver/ plugins/syslog_receiver/
EXPOSE 514/udp 514/tcp
CMD ["uvicorn", "plugins.syslog_receiver.main:app", "--host", "0.0.0.0", "--port", "8014"]
