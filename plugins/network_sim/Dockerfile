FROM python:3.11-slim

WORKDIR /app

COPY pyproject.toml .
RUN pip install -e . 2>/dev/null || pip install fastapi uvicorn httpx sqlalchemy asyncpg pydantic

COPY plugins/network_sim/ plugins/network_sim/

EXPOSE 8013

CMD ["uvicorn", "plugins.network_sim.main:app", "--host", "0.0.0.0", "--port", "8013"]
