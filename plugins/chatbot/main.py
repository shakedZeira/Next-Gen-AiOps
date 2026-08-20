from contextlib import asynccontextmanager

from fastapi import FastAPI

from plugins.chatbot.router import router


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield

app = FastAPI(title="ChatBot", lifespan=lifespan)
app.include_router(router, prefix="/api/v1/chatbot")

@app.get("/health")
async def health():
    return {"status": "healthy"}
