FROM python:3.11-slim
WORKDIR /app
COPY pyproject.toml .
RUN pip install -e .
COPY aiops_shared/ aiops_shared/
COPY plugins/chatbot/ plugins/chatbot/
CMD ["uvicorn", "plugins.chatbot.main:app", "--host", "0.0.0.0", "--port", "8004"]
